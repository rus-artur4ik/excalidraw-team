import { atom } from "../app-jotai";

import type { AppUser } from "../data/firebase";

export const currentUserAtom = atom<AppUser | null>(null);
export const authLoadingAtom = atom<boolean>(true);
