import { Bytes, doc, getDoc, setDoc } from "firebase/firestore";

import { getNonDeletedElements } from "@excalidraw/element";
import {
  decryptData,
  encryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { exportToCanvas } from "@excalidraw/utils/export";

import { getFirestoreInstance } from "./firebase";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

const THUMBNAIL_MAX_WIDTH = 320;
const THUMBNAIL_MAX_HEIGHT = 200;
const THUMBNAIL_ID_SUFFIX = "~thumb";

type StoredThumbnail = {
  ciphertext: Bytes;
  iv: Bytes;
  sceneVersion: number;
};

const thumbnailRef = (roomId: string) => {
  if (roomId.includes("~")) {
    throw new Error(`Unexpected "~" in collab room id: ${roomId}`);
  }
  return doc(getFirestoreInstance(), "scenes", `${roomId}${THUMBNAIL_ID_SUFFIX}`);
};

export const renderBoardThumbnail = async (
  elements: readonly OrderedExcalidrawElement[],
  appState: Pick<AppState, "viewBackgroundColor" | "exportWithDarkMode">,
  files: BinaryFiles,
): Promise<string | null> => {
  const nonDeleted = getNonDeletedElements(elements);
  if (!nonDeleted.length) {
    return null;
  }
  try {
    const canvas = await exportToCanvas({
      elements: nonDeleted,
      appState: {
        exportBackground: true,
        exportScale: 1,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor: appState.viewBackgroundColor,
      },
      files,
      exportPadding: 12,
      getDimensions: (width, height) => {
        const scale = Math.min(
          THUMBNAIL_MAX_WIDTH / width,
          THUMBNAIL_MAX_HEIGHT / height,
          1,
        );
        return {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          scale,
        };
      },
    });
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Failed to render board thumbnail:", error);
    return null;
  }
};

export const saveBoardThumbnail = async ({
  roomId,
  roomKey,
  dataUrl,
  sceneVersion,
}: {
  roomId: string;
  roomKey: string;
  dataUrl: string;
  sceneVersion: number;
}): Promise<void> => {
  const encoded = new TextEncoder().encode(dataUrl);
  const { encryptedBuffer, iv } = await encryptData(roomKey, encoded);
  const stored: StoredThumbnail = {
    ciphertext: Bytes.fromUint8Array(new Uint8Array(encryptedBuffer)),
    iv: Bytes.fromUint8Array(iv),
    sceneVersion,
  };
  await setDoc(thumbnailRef(roomId), stored);
};

export const loadBoardThumbnail = async ({
  roomId,
  roomKey,
}: {
  roomId: string;
  roomKey: string;
}): Promise<string | null> => {
  const snapshot = await getDoc(thumbnailRef(roomId));
  if (!snapshot.exists()) {
    return null;
  }
  const stored = snapshot.data() as Partial<StoredThumbnail>;
  if (!stored.ciphertext || !stored.iv) {
    return null;
  }
  try {
    const ciphertext = stored.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
    const iv = stored.iv.toUint8Array() as Uint8Array<ArrayBuffer>;
    const decrypted = await decryptData(iv, ciphertext, roomKey);
    return new TextDecoder("utf-8").decode(new Uint8Array(decrypted));
  } catch (error) {
    console.warn("Failed to decrypt board thumbnail:", error);
    return null;
  }
};
