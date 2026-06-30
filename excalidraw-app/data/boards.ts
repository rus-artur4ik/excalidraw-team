import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
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

export type Visibility = "private" | "team" | "link";
export type TeamRole = "admin" | "editor" | "viewer";
export type BotPolicy = "none" | "read" | "write";

export const DEFAULT_BOT_POLICY: BotPolicy = "write";
export const TEAM_ID = "chats-team";

export type Board = {
  roomId: string;
  ownerUid: string;
  ownerEmail: string | null;
  title: string;
  visibility?: Visibility;
  editors: string[];
  viewers: string[];
  botPolicy?: BotPolicy;
  readPolicy?: "public" | "members";
  writePolicy?: "everyone" | "whitelist" | "owner";
  teamId?: string | null;
};

export type Team = {
  teamId: string;
  name: string;
  admins: string[];
  editorEmails: string[];
  viewerEmails: string[];
};

export type CreateBoardInput = {
  title: string;
  visibility?: Visibility;
  editors?: string[];
  viewers?: string[];
  botPolicy?: BotPolicy;
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
    visibility: input.visibility ?? "private",
    editors: input.editors ?? [],
    viewers: input.viewers ?? [],
    botPolicy: input.botPolicy ?? DEFAULT_BOT_POLICY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "boards", roomId), board);
  await setDoc(doc(db, "boardKeys", roomId), { roomKey });

  return { roomId, roomKey };
};

const normalizeBoard = (roomId: string, data: any): Board => ({
  roomId,
  editors: [],
  viewers: [],
  ...data,
});

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
  const board = normalizeBoard(roomId, snap.data());
  const roomKey = keySnap.exists()
    ? (keySnap.data().roomKey as string) ?? null
    : null;
  return { board, roomKey };
};

export const loadBoardKeys = async (
  roomIds: string[],
): Promise<Map<string, string | null>> => {
  const db = getFirestoreInstance();
  const entries = await Promise.all(
    roomIds.map(async (id) => {
      const snap = await getDoc(doc(db, "boardKeys", id)).catch(() => null);
      const roomKey =
        snap && snap.exists() ? (snap.data().roomKey as string) ?? null : null;
      return [id, roomKey] as const;
    }),
  );
  return new Map(entries);
};

export const updateBoardAccess = async (
  roomId: string,
  patch: Partial<
    Pick<Board, "visibility" | "editors" | "viewers" | "title" | "botPolicy">
  >,
) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "boards", roomId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

const docsToBoards = (snaps: { id: string; data: () => any }[]): Board[] =>
  snaps.map((d) => normalizeBoard(d.id, d.data()));

const unionBoards = (...groups: Board[][]): Board[] => {
  const byId = new Map<string, Board>();
  for (const group of groups) {
    for (const board of group) {
      byId.set(board.roomId, board);
    }
  }
  return [...byId.values()];
};

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

export const listInvitedBoards = async (email: string): Promise<Board[]> => {
  const db = getFirestoreInstance();
  const [asEditor, asViewer] = await Promise.all([
    getDocs(
      query(
        collection(db, "boards"),
        where("editors", "array-contains", email),
      ),
    ),
    getDocs(
      query(
        collection(db, "boards"),
        where("viewers", "array-contains", email),
      ),
    ),
  ]);
  return unionBoards(docsToBoards(asEditor.docs), docsToBoards(asViewer.docs));
};

export const listTeamBoards = async (): Promise<Board[]> => {
  const db = getFirestoreInstance();
  const [byVisibility, legacyByTeamId] = await Promise.all([
    getDocs(query(collection(db, "boards"), where("visibility", "==", "team"))),
    getDocs(query(collection(db, "boards"), where("teamId", "==", TEAM_ID))),
  ]);
  return unionBoards(
    docsToBoards(byVisibility.docs),
    docsToBoards(legacyByTeamId.docs),
  );
};

export const loadTeam = async (): Promise<Team | null> => {
  const db = getFirestoreInstance();
  const snap = await getDoc(doc(db, "teams", TEAM_ID)).catch(() => null);
  return snap && snap.exists()
    ? ({ teamId: TEAM_ID, ...snap.data() } as Team)
    : null;
};

export const createTeam = async (name: string): Promise<Team> => {
  const user = getCurrentAppUser();
  if (!user?.email) {
    throw new Error("Must be signed in to create a team");
  }
  const team = {
    name: name.trim() || "Team",
    admins: [user.email],
    editorEmails: [] as string[],
    viewerEmails: [] as string[],
  };
  await setDoc(doc(getFirestoreInstance(), "teams", TEAM_ID), team);
  return { teamId: TEAM_ID, ...team };
};

export const setTeamMember = async (email: string, role: TeamRole) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "teams", TEAM_ID), {
    admins: role === "admin" ? arrayUnion(email) : arrayRemove(email),
    editorEmails: role === "editor" ? arrayUnion(email) : arrayRemove(email),
    viewerEmails: role === "viewer" ? arrayUnion(email) : arrayRemove(email),
  });
};

export const removeTeamMember = async (email: string) => {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, "teams", TEAM_ID), {
    admins: arrayRemove(email),
    editorEmails: arrayRemove(email),
    viewerEmails: arrayRemove(email),
  });
};

const has = (list: string[] | undefined, email: string | null): boolean =>
  !!email && !!list?.includes(email);

export const teamRoleOf = (
  team: Team | null,
  email: string | null,
): TeamRole | null => {
  if (has(team?.admins, email)) {
    return "admin";
  }
  if (has(team?.editorEmails, email)) {
    return "editor";
  }
  if (has(team?.viewerEmails, email)) {
    return "viewer";
  }
  return null;
};

const legacyCanWrite = (
  board: Board,
  email: string | null,
  team: Team | null,
): boolean => {
  const role = board.teamId ? teamRoleOf(team, email) : null;
  const teamEditor = role === "admin" || role === "editor";
  return (
    board.writePolicy === "everyone" ||
    (board.writePolicy === "whitelist" && has(board.editors, email)) ||
    (board.writePolicy !== "owner" && teamEditor)
  );
};

export const canWriteBoard = (
  board: Board,
  user: AppUser | null,
  team: Team | null,
): boolean => {
  const email = user?.email ?? null;
  if (!!user && user.uid === board.ownerUid) {
    return true;
  }
  if (board.visibility === undefined) {
    return legacyCanWrite(board, email, team);
  }
  if (board.visibility === "team") {
    const role = teamRoleOf(team, email);
    if (role === "admin" || role === "editor") {
      return true;
    }
  }
  return has(board.editors, email);
};
