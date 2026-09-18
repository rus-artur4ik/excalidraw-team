import { afterEach, describe, expect, it, vi } from "vitest";

import { appJotaiStore } from "./app-jotai";
import { BOARD_LOAD_MAX_MS } from "./app_constants";
import {
  beginBoardLoad,
  boardLoadAtom,
  endBoardLoad,
  getBoardLoadHandle,
  getBoardLoadProgress,
  getBoardLoadSteps,
  skipBoardLoadWait,
} from "./boardLoad";

import type { BoardLoad } from "./boardLoad";

const state = () => appJotaiStore.get(boardLoadAtom);

const load = (patch: Partial<BoardLoad> = {}): BoardLoad => ({
  id: 1,
  stage: "access",
  finished: false,
  title: null,
  sceneBytes: null,
  elementCount: null,
  images: null,
  ...patch,
});

afterEach(() => {
  endBoardLoad();
  vi.useRealTimers();
});

describe("board load", () => {
  it("finishes once the scene is painted and its images are in", () => {
    beginBoardLoad();
    const board = getBoardLoadHandle();
    board.setTitle("Roadmap");
    board.loadingScene();
    board.sceneDownloaded(2048);
    board.sceneReady(12);
    board.imagesProgress(0, 2);
    board.rendered();

    expect(state()).toMatchObject({
      stage: "done",
      finished: false,
      title: "Roadmap",
      sceneBytes: 2048,
      elementCount: 12,
    });

    board.imagesProgress(2, 2);
    expect(state().finished).toBe(true);
  });

  it("finishes on paint when there are no images to wait for", () => {
    beginBoardLoad();
    const board = getBoardLoadHandle();
    board.sceneReady(3);
    board.imagesProgress(0, 0);
    expect(state().finished).toBe(false);

    board.rendered();
    expect(state().finished).toBe(true);
  });

  it("ignores reports about a board that is no longer being opened", () => {
    beginBoardLoad();
    const previous = getBoardLoadHandle();
    beginBoardLoad();

    previous.sceneReady(99);
    previous.rendered();

    expect(state()).toMatchObject({
      stage: "access",
      elementCount: null,
      finished: false,
    });
  });

  it("reports nowhere when no board is being opened", () => {
    const board = getBoardLoadHandle();
    expect(board.active).toBe(false);

    board.rendered();
    expect(state().id).toBe(0);
  });

  it("stops waiting for images when the user skips them", () => {
    beginBoardLoad();
    const board = getBoardLoadHandle();
    board.imagesProgress(1, 5);
    board.rendered();
    expect(state().finished).toBe(false);

    skipBoardLoadWait();
    expect(state().finished).toBe(true);
  });

  it("lifts the screen when a stage hangs", () => {
    vi.useFakeTimers();
    beginBoardLoad();

    vi.advanceTimersByTime(BOARD_LOAD_MAX_MS - 1);
    expect(state().finished).toBe(false);
    vi.advanceTimersByTime(1);
    expect(state().finished).toBe(true);
  });
});

describe("loading screen steps", () => {
  it("shows sign-in first, then walks the stages", () => {
    expect(getBoardLoadSteps(load(), true)).toEqual({
      auth: "active",
      access: "pending",
      scene: "pending",
      render: "pending",
      images: "pending",
    });
    expect(getBoardLoadSteps(load({ stage: "scene" }), false)).toEqual({
      auth: "done",
      access: "done",
      scene: "active",
      render: "pending",
      images: "pending",
    });
  });

  it("loads images alongside rendering", () => {
    expect(
      getBoardLoadSteps(
        load({ stage: "render", images: { loaded: 1, total: 4 } }),
        false,
      ),
    ).toMatchObject({ render: "active", images: "active" });
    expect(
      getBoardLoadSteps(
        load({ stage: "render", images: { loaded: 0, total: 0 } }),
        false,
      ),
    ).toMatchObject({ render: "active", images: "done" });
  });

  it("creeps through a step it can't measure", () => {
    const board = load({ stage: "scene" });
    const { value, creep } = getBoardLoadProgress(
      board,
      getBoardLoadSteps(board, false),
    );

    expect(value).toBeCloseTo(0.15);
    expect(creep!.to).toBeGreaterThan(value);
    expect(creep!.to).toBeLessThan(0.5);
  });

  it("fills the image share by count once the scene is painted", () => {
    const board = load({ stage: "done", images: { loaded: 1, total: 2 } });
    const { value, creep } = getBoardLoadProgress(
      board,
      getBoardLoadSteps(board, false),
    );

    expect(value).toBeCloseTo(0.85);
    expect(creep).toBeNull();
  });

  it("is full when everything is done", () => {
    const board = load({ stage: "done", images: { loaded: 0, total: 0 } });
    expect(
      getBoardLoadProgress(board, getBoardLoadSteps(board, false)).value,
    ).toBeCloseTo(1);
  });
});
