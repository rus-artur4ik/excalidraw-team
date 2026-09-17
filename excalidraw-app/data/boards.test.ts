import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOARD_DESCRIPTION_MAX_LENGTH,
  cleanBoardDescription,
  createBoard,
  updateBoardAccess,
} from "./boards";

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  updateDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  getCurrentAppUser: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => ({ __delete: true })),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __now: true })),
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  where: vi.fn(),
}));

vi.mock("./firebase", () => ({
  deleteBoardScenes: vi.fn(),
  deleteRoomFiles: vi.fn(),
  getCurrentAppUser: mocks.getCurrentAppUser,
  getFirestoreInstance: () => ({ __db: true }),
}));

vi.mock("./boardThumbnail", () => ({ deleteBoardThumbnail: vi.fn() }));

vi.mock(".", () => ({
  generateCollaborationLinkData: async () => ({
    roomId: "room1",
    roomKey: "key1",
  }),
}));

const boardWrite = () => {
  const call = mocks.setDoc.mock.calls.find(
    ([ref]) => (ref as { path: string }).path === "boards/room1",
  );
  return call?.[1] as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAppUser.mockReturnValue({ uid: "u", email: "u@x.io" });
});

describe("cleanBoardDescription", () => {
  it("collapses whitespace and line breaks into one trimmed paragraph", () => {
    expect(cleanBoardDescription("  Sprint\n\n plan \t notes ")).toBe(
      "Sprint plan notes",
    );
    expect(cleanBoardDescription("   ")).toBe("");
    expect(cleanBoardDescription(undefined)).toBe("");
  });

  it("caps a runaway description", () => {
    expect(cleanBoardDescription("x".repeat(1000))).toHaveLength(
      BOARD_DESCRIPTION_MAX_LENGTH,
    );
  });
});

describe("createBoard", () => {
  it("stores a cleaned description", async () => {
    await createBoard({ title: "Retro", description: "  What went\nwell " });
    expect(boardWrite()).toMatchObject({
      title: "Retro",
      description: "What went well",
    });
  });

  it("leaves the key out when the description is blank", async () => {
    await createBoard({ title: "Retro", description: "  " });
    expect(boardWrite()).not.toHaveProperty("description");
    await createBoard({ title: "Retro" });
    expect(boardWrite()).not.toHaveProperty("description");
  });
});

describe("updateBoardAccess", () => {
  it("saves a cleaned description", async () => {
    await updateBoardAccess("room1", { description: " New\nblurb " });
    expect(mocks.updateDoc.mock.calls[0][1]).toMatchObject({
      description: "New blurb",
    });
  });

  it("removes an emptied description instead of storing an empty string", async () => {
    await updateBoardAccess("room1", { description: " " });
    expect(mocks.updateDoc.mock.calls[0][1]).toMatchObject({
      description: { __delete: true },
    });
  });

  it("does not touch the description when the patch leaves it out", async () => {
    await updateBoardAccess("room1", { title: "Renamed" });
    expect(mocks.updateDoc.mock.calls[0][1]).not.toHaveProperty("description");
  });
});
