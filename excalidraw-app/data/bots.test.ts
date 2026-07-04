import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBot, deleteBot, listMyBots, updateBot } from "./bots";

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  setDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  updateDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  deleteDoc: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
  getCurrentAppUser: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __col: true })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
  doc: vi.fn((_db: unknown, _col?: string, id?: string) => ({
    id: id ?? "generated-id",
  })),
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
}));

vi.mock("./firebase", () => ({
  getFirestoreInstance: () => ({ __db: true }),
  getCurrentAppUser: mocks.getCurrentAppUser,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAppUser.mockReturnValue({ uid: "u", email: "u@x.io" });
});

describe("listMyBots", () => {
  it("normalizes docs and defaults boards to []", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: "b1", data: () => ({ ownerUid: "u", name: "NoBoards" }) },
        {
          id: "b2",
          data: () => ({
            ownerUid: "u",
            name: "HasBoards",
            boards: [{ boardId: "x", role: "write" }],
          }),
        },
      ],
    });
    const bots = await listMyBots("u");
    expect(bots[0]).toMatchObject({ id: "b1", name: "NoBoards", boards: [] });
    expect(bots[1].boards).toEqual([{ boardId: "x", role: "write" }]);
  });
});

describe("createBot", () => {
  it("writes an owner-scoped doc and returns it with an id", async () => {
    const bot = await createBot({
      name: "Helper",
      avatar: { kind: "emoji", value: "🤖" },
      color: "#123456",
      boards: [{ boardId: "x", role: "read" }],
    });
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const payload = mocks.setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      ownerUid: "u",
      name: "Helper",
      boards: [{ boardId: "x", role: "read" }],
      disabled: false,
    });
    expect(bot).toMatchObject({ id: "generated-id", name: "Helper" });
  });

  it("refuses when signed out", async () => {
    mocks.getCurrentAppUser.mockReturnValue(null);
    await expect(
      createBot({
        name: "x",
        avatar: { kind: "emoji", value: "🤖" },
        color: "#000",
      }),
    ).rejects.toThrow("signed in");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});

describe("updateBot / deleteBot", () => {
  it("stamps updatedAt on patch and deletes by id", async () => {
    await updateBot("b1", { disabled: true });
    const patch = mocks.updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).toMatchObject({ disabled: true });
    expect(typeof patch.updatedAt).toBe("number");

    await deleteBot("b1");
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
  });
});
