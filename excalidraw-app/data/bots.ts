import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { getCurrentAppUser, getFirestoreInstance } from "./firebase";

export type BotAvatar = { kind: "emoji"; value: string };

export type BotBoardBinding = { boardId: string; role: "read" | "write" };

export type Bot = {
  id: string;
  ownerUid: string;
  name: string;
  avatar: BotAvatar;
  color: string;
  boards: BotBoardBinding[];
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type CreateBotInput = {
  name: string;
  avatar: BotAvatar;
  color: string;
  boards?: BotBoardBinding[];
  disabled?: boolean;
};

export type BotPatch = Partial<
  Pick<Bot, "name" | "avatar" | "color" | "boards" | "disabled">
>;

const normalizeBot = (id: string, data: any): Bot => ({
  id,
  boards: [],
  ...data,
});

export const listMyBots = async (uid: string): Promise<Bot[]> => {
  const db = getFirestoreInstance();
  const snaps = await getDocs(
    query(collection(db, "bots"), where("ownerUid", "==", uid)),
  );
  return snaps.docs.map((snap) => normalizeBot(snap.id, snap.data()));
};

export const createBot = async (input: CreateBotInput): Promise<Bot> => {
  const user = getCurrentAppUser();
  if (!user) {
    throw new Error("Must be signed in to create a bot");
  }
  const db = getFirestoreInstance();
  const now = Date.now();
  const ref = doc(collection(db, "bots"));
  const payload = {
    ownerUid: user.uid,
    name: input.name,
    avatar: input.avatar,
    color: input.color,
    boards: input.boards ?? [],
    disabled: input.disabled ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
};

export const updateBot = async (id: string, patch: BotPatch) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "bots", id), {
    ...patch,
    updatedAt: Date.now(),
  });
};

export const deleteBot = async (id: string) => {
  const db = getFirestoreInstance();
  await deleteDoc(doc(db, "bots", id));
};
