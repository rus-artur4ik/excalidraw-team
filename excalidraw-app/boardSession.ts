import { atom } from "./app-jotai";

import type { Board } from "./data/boards";

export const boardViewOnlyAtom = atom(false);
export const currentBoardAtom = atom<Board | null>(null);
export const boardCanManageAtom = atom(false);
export const boardSettingsOpenAtom = atom(false);

export type SharedSceneRoom = { roomId: string; roomKey: string };
export const sharedSceneRoomAtom = atom<SharedSceneRoom | null>(null);
