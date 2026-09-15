import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { getCurrentAppUser, getFirestoreInstance } from "./firebase";

/**
 * A personal folder: lives under `users/{uid}/folders/{id}` and is visible
 * only to its owner. It groups boards the owner can see (own, invited, team)
 * without touching the boards' own ACL — the same board may sit in different
 * folders for different people.
 */
export type Folder = {
  id: string;
  name: string;
  boardIds: string[];
  createdAt: number;
  updatedAt: number;
};

export const FOLDER_NAME_MAX_LENGTH = 60;

const foldersCollection = (uid: string) =>
  collection(getFirestoreInstance(), "users", uid, "folders");

const folderDoc = (uid: string, id: string) =>
  doc(getFirestoreInstance(), "users", uid, "folders", id);

const requireUser = () => {
  const user = getCurrentAppUser();
  if (!user) {
    throw new Error("Must be signed in to manage folders");
  }
  return user;
};

const normalizeFolder = (id: string, data: any): Folder => ({
  id,
  name: "",
  boardIds: [],
  createdAt: 0,
  updatedAt: 0,
  ...data,
});

export const cleanFolderName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").slice(0, FOLDER_NAME_MAX_LENGTH);

export const sortFolders = (folders: Folder[]): Folder[] =>
  [...folders].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      a.createdAt - b.createdAt,
  );

export const listMyFolders = async (uid: string): Promise<Folder[]> => {
  const snaps = await getDocs(foldersCollection(uid));
  return sortFolders(
    snaps.docs.map((snap) => normalizeFolder(snap.id, snap.data())),
  );
};

export const createFolder = async (name: string): Promise<Folder> => {
  const user = requireUser();
  const now = Date.now();
  const ref = doc(foldersCollection(user.uid));
  const payload = {
    name: cleanFolderName(name),
    boardIds: [] as string[],
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
};

export const renameFolder = async (id: string, name: string) => {
  const user = requireUser();
  await updateDoc(folderDoc(user.uid, id), {
    name: cleanFolderName(name),
    updatedAt: Date.now(),
  });
};

/** Removes the folder only; the boards inside simply become unfiled. */
export const deleteFolder = async (id: string) => {
  const user = requireUser();
  await deleteDoc(folderDoc(user.uid, id));
};

/** The folder a board is filed in, or null when it is unfiled. */
export const folderIdOfBoard = (
  folders: Folder[],
  boardId: string,
): string | null =>
  folders.find((folder) => folder.boardIds.includes(boardId))?.id ?? null;

/**
 * Files a board into `targetFolderId` (or unfiles it when null). A board sits
 * in at most one folder, so every other folder that lists it is cleaned up in
 * the same batch.
 */
export const moveBoardToFolder = async (
  boardId: string,
  targetFolderId: string | null,
  folders: Folder[],
): Promise<void> => {
  const user = requireUser();
  const now = Date.now();
  const batch = writeBatch(getFirestoreInstance());
  let touched = false;
  for (const folder of folders) {
    const has = folder.boardIds.includes(boardId);
    if (folder.id === targetFolderId && !has) {
      batch.update(folderDoc(user.uid, folder.id), {
        boardIds: arrayUnion(boardId),
        updatedAt: now,
      });
      touched = true;
    } else if (folder.id !== targetFolderId && has) {
      batch.update(folderDoc(user.uid, folder.id), {
        boardIds: arrayRemove(boardId),
        updatedAt: now,
      });
      touched = true;
    }
  }
  if (touched) {
    await batch.commit();
  }
};

/** Pure counterpart of moveBoardToFolder for optimistic UI updates. */
export const applyMove = (
  folders: Folder[],
  boardId: string,
  targetFolderId: string | null,
): Folder[] =>
  folders.map((folder) => {
    const without = folder.boardIds.filter((id) => id !== boardId);
    return folder.id === targetFolderId
      ? { ...folder, boardIds: [...without, boardId] }
      : without.length === folder.boardIds.length
      ? folder
      : { ...folder, boardIds: without };
  });
