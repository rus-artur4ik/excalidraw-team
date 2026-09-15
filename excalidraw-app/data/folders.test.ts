import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyMove,
  cleanFolderName,
  createFolder,
  deleteFolder,
  folderIdOfBoard,
  listMyFolders,
  moveBoardToFolder,
  renameFolder,
  sortFolders,
} from "./folders";

import type { Folder } from "./folders";

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  setDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  updateDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  deleteDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(() => Promise.resolve(undefined)),
  getCurrentAppUser: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...path: string[]) => ({
    __col: path.join("/"),
  })),
  doc: vi.fn((target: any, ...path: string[]) =>
    path.length === 0
      ? { id: "generated-id", path: `${target.__col}/generated-id` }
      : { id: path[path.length - 1], path: path.join("/") },
  ),
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  writeBatch: vi.fn(() => ({
    update: mocks.batchUpdate,
    commit: mocks.batchCommit,
  })),
  arrayUnion: vi.fn((...items: unknown[]) => ({ __union: items })),
  arrayRemove: vi.fn((...items: unknown[]) => ({ __remove: items })),
}));

vi.mock("./firebase", () => ({
  getFirestoreInstance: () => ({ __db: true }),
  getCurrentAppUser: mocks.getCurrentAppUser,
}));

const folder = (id: string, boardIds: string[], name = id): Folder => ({
  id,
  name,
  boardIds,
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAppUser.mockReturnValue({ uid: "u", email: "u@x.io" });
});

describe("listMyFolders", () => {
  it("reads the user's subcollection, fills defaults and sorts by name", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: "f2", data: () => ({ name: "zeta", boardIds: ["b"] }) },
        { id: "f1", data: () => ({ name: "Alpha" }) },
      ],
    });
    const folders = await listMyFolders("u");
    expect(mocks.getDocs).toHaveBeenCalledWith({ __col: "users/u/folders" });
    expect(folders.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(folders[0]).toMatchObject({ name: "Alpha", boardIds: [] });
  });
});

describe("createFolder", () => {
  it("writes a cleaned name with an empty board list", async () => {
    const created = await createFolder("  My   folder ");
    const [ref, payload] = mocks.setDoc.mock.calls[0] as [any, any];
    expect(ref.path).toBe("users/u/folders/generated-id");
    expect(payload).toMatchObject({ name: "My folder", boardIds: [] });
    expect(created).toMatchObject({ id: "generated-id", name: "My folder" });
  });

  it("refuses when signed out", async () => {
    mocks.getCurrentAppUser.mockReturnValue(null);
    await expect(createFolder("x")).rejects.toThrow(/signed in/);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});

describe("renameFolder / deleteFolder", () => {
  it("targets the owner's folder doc", async () => {
    await renameFolder("f1", " New name ");
    const [ref, patch] = mocks.updateDoc.mock.calls[0] as [any, any];
    expect(ref.path).toBe("users/u/folders/f1");
    expect(patch.name).toBe("New name");

    await deleteFolder("f1");
    expect((mocks.deleteDoc.mock.calls[0] as any[])[0].path).toBe(
      "users/u/folders/f1",
    );
  });
});

describe("moveBoardToFolder", () => {
  it("adds to the target and removes from every other folder in one batch", async () => {
    const folders = [folder("a", ["b1"]), folder("b", []), folder("c", ["b1"])];
    await moveBoardToFolder("b1", "b", folders);
    const updates = mocks.batchUpdate.mock.calls.map(([ref, patch]: any[]) => [
      ref.id,
      patch.boardIds,
    ]);
    expect(updates).toEqual([
      ["a", { __remove: ["b1"] }],
      ["b", { __union: ["b1"] }],
      ["c", { __remove: ["b1"] }],
    ]);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
  });

  it("unfiles when the target is null", async () => {
    await moveBoardToFolder("b1", null, [folder("a", ["b1"]), folder("b", [])]);
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(1);
    expect((mocks.batchUpdate.mock.calls[0] as any[])[0].id).toBe("a");
  });

  it("skips the write when nothing changes", async () => {
    await moveBoardToFolder("b1", "a", [folder("a", ["b1"])]);
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });
});

describe("pure helpers", () => {
  it("folderIdOfBoard finds the containing folder", () => {
    const folders = [folder("a", ["x"]), folder("b", ["y"])];
    expect(folderIdOfBoard(folders, "y")).toBe("b");
    expect(folderIdOfBoard(folders, "z")).toBeNull();
  });

  it("applyMove mirrors the batch without mutating input", () => {
    const folders = [folder("a", ["x", "y"]), folder("b", [])];
    const next = applyMove(folders, "x", "b");
    expect(next[0].boardIds).toEqual(["y"]);
    expect(next[1].boardIds).toEqual(["x"]);
    expect(folders[0].boardIds).toEqual(["x", "y"]);
    expect(applyMove(folders, "x", null)[0].boardIds).toEqual(["y"]);
  });

  it("cleanFolderName trims, collapses spaces and caps length", () => {
    expect(cleanFolderName("  a   b ")).toBe("a b");
    expect(cleanFolderName("x".repeat(100))).toHaveLength(60);
  });

  it("sortFolders is case-insensitive and stable by creation time", () => {
    const sorted = sortFolders([
      { ...folder("1", [], "beta"), createdAt: 2 },
      { ...folder("2", [], "Beta"), createdAt: 1 },
      folder("3", [], "alpha"),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["3", "2", "1"]);
  });
});
