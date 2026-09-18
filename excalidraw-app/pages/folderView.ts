import { useState } from "react";
import { flushSync } from "react-dom";

import { navigate } from "../router";

import type { DragEvent } from "react";

/** MIME type carried by a dragged board card. */
export const BOARD_DRAG_TYPE = "application/x-excalidraw-team-board";

/**
 * view-transition-name shared by a folder tile and the open folder's header,
 * so the browser morphs one into the other.
 */
export const FOLDER_MORPH_NAME = "exa-folder-morph";

const acceptsBoard = (event: DragEvent) =>
  event.dataTransfer.types.includes(BOARD_DRAG_TYPE);

/** Makes an element accept a dragged board card. */
export const useBoardDrop = (onDropBoard: (boardId: string) => void) => {
  const [over, setOver] = useState(false);
  return {
    over,
    dropHandlers: {
      onDragOver: (event: DragEvent) => {
        if (!acceptsBoard(event)) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        if (!acceptsBoard(event)) {
          return;
        }
        event.preventDefault();
        setOver(false);
        const boardId = event.dataTransfer.getData(BOARD_DRAG_TYPE);
        if (boardId) {
          onDropBoard(boardId);
        }
      },
    },
  };
};

const folderTile = (folderId: string) =>
  document.querySelector<HTMLElement>(
    `[data-folder-tile="${CSS.escape(folderId)}"]`,
  );

/**
 * Navigates between the folder grid and an open folder. Where the browser
 * supports view transitions, the folder's tile morphs into the folder header
 * (and back); elsewhere it is a plain navigation and only the CSS entrance
 * animations play.
 */
export const navigateWithFolderMorph = (to: string, folderId: string) => {
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!document.startViewTransition || reduceMotion) {
    navigate(to);
    return;
  }
  // The header carries the name through CSS; the tile only for the moment
  // it is captured, so the other tiles simply fade with the page.
  let tile = folderTile(folderId);
  tile?.style.setProperty("view-transition-name", FOLDER_MORPH_NAME);
  const transition = document.startViewTransition(() => {
    flushSync(() => navigate(to));
    tile = folderTile(folderId);
    // Back on the root: the header lands on this tile, which therefore
    // skips the entrance animation the other tiles play.
    tile?.setAttribute("data-folder-morph", "");
    tile?.style.setProperty("view-transition-name", FOLDER_MORPH_NAME);
  });
  transition.finished.finally(() =>
    tile?.style.removeProperty("view-transition-name"),
  );
};
