import type { DocumentData } from "firebase/firestore";
import {
  arrayRemove,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import type { AppUser } from "./firebase";
import { getCurrentAppUser, getFirestoreInstance } from "./firebase";

import { generateCollaborationLinkData } from ".";

export type ReadPolicy = "public" | "members";
export type WritePolicy = "everyone" | "whitelist" | "owner";
export type BoardType = "personal" | "team";
export type TeamRole = "editor" | "viewer";
export type BotPolicy = "none" | "read" | "write";

export const DEFAULT_BOT_POLICY: BotPolicy = "write";

export type Board = {
  roomId: string;
  ownerUid: string;
  ownerEmail: string | null;
  title: string;
  type: BoardType;
  teamId: string | null;
  readPolicy: ReadPolicy;
  writePolicy: WritePolicy;
  editors: string[];
  botPolicy?: BotPolicy;
};

export type Team = {
  teamId: string;
  name: string;
  admins: string[];
  editorEmails: string[];
  viewerEmails: string[];
};

export const KNOWN_TEAM_IDS = ["chats-team"];

export type CreateBoardInput = {
  title: string;
  type?: BoardType;
  teamId?: string | null;
  readPolicy?: ReadPolicy;
  writePolicy?: WritePolicy;
  editors?: string[];
};

export const createBoard = async (
  input: CreateBoardInput,
): Promise<{ roomId: string; roomKey: string }> => {
  const user = getCurrentAppUser();
  if (!user) {
    throw new Error("Must be signed in to create a board");
  }
  const { roomId, roomKey } = await generateCollaborationLinkData();
  const db = getFirestoreInstance();

  const board = {
    ownerUid: user.uid,
    ownerEmail: user.email,
    title: input.title,
    type: input.type ?? "personal",
    teamId: input.teamId ?? null,
    readPolicy: input.readPolicy ?? "members",
    writePolicy: input.writePolicy ?? "owner",
    editors: input.editors ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "boards", roomId), board);
  await setDoc(doc(db, "boardKeys", roomId), { roomKey });

  return { roomId, roomKey };
};

export const loadBoard = async (
  roomId: string,
): Promise<{ board: Board; roomKey: string | null } | null> => {
  const db = getFirestoreInstance();
  const [snap, keySnap] = await Promise.all([
    getDoc(doc(db, "boards", roomId)),
    getDoc(doc(db, "boardKeys", roomId)),
  ]);
  if (!snap.exists()) {
    return null;
  }
  const board = { roomId, ...snap.data() } as Board;
  const roomKey = keySnap.exists()
    ? (keySnap.data().roomKey as string) ?? null
    : null;
  return { board, roomKey };
};

export const loadBoardKey = async (
  roomId: string,
): Promise<string | null> => {
  const db = getFirestoreInstance();
  const keySnap = await getDoc(doc(db, "boardKeys", roomId));
  return keySnap.exists() ? (keySnap.data().roomKey as string) ?? null : null;
};

const DOCUMENT_ID_IN_LIMIT = 10;

export const loadBoardKeys = async (
  roomIds: string[],
): Promise<Map<string, string | null>> => {
  const db = getFirestoreInstance();
  const result = new Map<string, string | null>();
  roomIds.forEach((id) => result.set(id, null));
  const chunks: string[][] = [];
  for (let i = 0; i < roomIds.length; i += DOCUMENT_ID_IN_LIMIT) {
    chunks.push(roomIds.slice(i, i + DOCUMENT_ID_IN_LIMIT));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      if (!chunk.length) {
        return;
      }
      const snaps = await getDocs(
        query(collection(db, "boardKeys"), where(documentId(), "in", chunk)),
      );
      snaps.forEach((d) =>
        result.set(d.id, (d.data().roomKey as string) ?? null),
      );
    }),
  );
  return result;
};

export const updateBoardPolicy = async (
  roomId: string,
  patch: Partial<
    Pick<Board, "readPolicy" | "writePolicy" | "editors" | "title" | "botPolicy">
  >,
) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "boards", roomId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

const docsToBoards = (snaps: { id: string; data: () => any }[]): Board[] =>
  snaps.map((d) => ({ roomId: d.id, ...d.data() } as Board));

export const listMyBoards = async (): Promise<Board[]> => {
  const user = getCurrentAppUser();
  if (!user) {
    return [];
  }
  const db = getFirestoreInstance();
  const snaps = await getDocs(
    query(collection(db, "boards"), where("ownerUid", "==", user.uid)),
  );
  return docsToBoards(snaps.docs);
};

export const listMyTeamIds = async (): Promise<string[]> => {
  const db = getFirestoreInstance();
  const found: string[] = [];
  for (const teamId of KNOWN_TEAM_IDS) {
    try {
      const snap = await getDoc(doc(db, "teams", teamId));
      if (snap.exists()) {
        found.push(teamId);
      }
    } catch {
      // not a member of this team — get() is denied by rules, skip it
    }
  }
  return found;
};

export const listMyTeams = async (): Promise<Team[]> => {
  const db = getFirestoreInstance();
  const snaps = await Promise.all(
    KNOWN_TEAM_IDS.map((teamId) =>
      getDoc(doc(db, "teams", teamId)).catch(() => null),
    ),
  );
  const teams: Team[] = [];
  snaps.forEach((snap, i) => {
    if (snap && snap.exists()) {
      teams.push({ teamId: KNOWN_TEAM_IDS[i], ...snap.data() } as Team);
    }
  });
  return teams;
};

export const listTeamBoards = async (teamIds: string[]): Promise<Board[]> => {
  if (!teamIds.length) {
    return [];
  }
  const db = getFirestoreInstance();
  const snaps = await getDocs(
    query(collection(db, "boards"), where("teamId", "in", teamIds)),
  );
  return docsToBoards(snaps.docs);
};

export const loadTeam = async (teamId: string): Promise<Team | null> => {
  const db = getFirestoreInstance();
  const snap = await getDoc(doc(db, "teams", teamId));
  return snap.exists() ? ({ teamId, ...snap.data() } as Team) : null;
};

export const setTeamMember = async (
  teamId: string,
  email: string,
  role: TeamRole,
) => {
  const db = getFirestoreInstance();
  const teamRef = doc(db, "teams", teamId);
  const snap = await getDoc(teamRef);
  const data: DocumentData = snap.data() ?? {};
  const editorEmails = new Set<string>(data.editorEmails ?? []);
  const viewerEmails = new Set<string>(data.viewerEmails ?? []);
  editorEmails.delete(email);
  viewerEmails.delete(email);
  (role === "editor" ? editorEmails : viewerEmails).add(email);
  await updateDoc(teamRef, {
    editorEmails: [...editorEmails],
    viewerEmails: [...viewerEmails],
  });
};

export const removeTeamMember = async (teamId: string, email: string) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "teams", teamId), {
    editorEmails: arrayRemove(email),
    viewerEmails: arrayRemove(email),
  });
};

export const canWriteBoard = (
  board: Board,
  user: AppUser | null,
  team: Team | null,
): boolean => {
  const email = user?.email ?? null;
  const isOwner = !!user && user.uid === board.ownerUid;
  const isWhitelisted = !!email && (board.editors ?? []).includes(email);
  const teamAdmin = !!team && !!email && (team.admins ?? []).includes(email);
  const teamEditor =
    teamAdmin ||
    (!!team && !!email && (team.editorEmails ?? []).includes(email));
  return (
    board.writePolicy === "everyone" ||
    isOwner ||
    teamAdmin ||
    (board.writePolicy === "whitelist" && isWhitelisted) ||
    teamEditor
  );
};
