import type { Folder } from "../data/folders";

/** Which slice of the boards list the home page is showing. */
export type FolderView =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "folder"; id: string };

export const ALL_VIEW: FolderView = { kind: "all" };
export const UNFILED_VIEW: FolderView = { kind: "unfiled" };

/** MIME type carried by a dragged board card. */
export const BOARD_DRAG_TYPE = "application/x-excalidraw-team-board";

const STORAGE_KEY = "excalidraw-team.home.folderView";

export const sameView = (a: FolderView, b: FolderView): boolean =>
  a.kind === b.kind &&
  (a.kind !== "folder" || b.kind !== "folder" || a.id === b.id);

export const boardInView = (
  view: FolderView,
  folderId: string | null,
): boolean => {
  switch (view.kind) {
    case "all":
      return true;
    case "unfiled":
      return folderId === null;
    case "folder":
      return folderId === view.id;
  }
};

/** Falls back to "all boards" when the selected folder no longer exists. */
export const resolveView = (view: FolderView, folders: Folder[]): FolderView =>
  view.kind === "folder" && !folders.some((folder) => folder.id === view.id)
    ? ALL_VIEW
    : view;

export const readStoredView = (): FolderView => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return ALL_VIEW;
    }
    const parsed = JSON.parse(raw);
    if (parsed?.kind === "unfiled") {
      return UNFILED_VIEW;
    }
    if (parsed?.kind === "folder" && typeof parsed.id === "string") {
      return { kind: "folder", id: parsed.id };
    }
  } catch {
    // ignore — a broken or unavailable storage just means "all boards"
  }
  return ALL_VIEW;
};

export const storeView = (view: FolderView) => {
  try {
    if (view.kind === "all") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    }
  } catch {
    // storage may be unavailable (private mode); the view is still applied
  }
};
