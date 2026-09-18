import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore, atom } from "./app-jotai";
import { BOARD_LOAD_FONTS_WAIT_MS, BOARD_LOAD_MAX_MS } from "./app_constants";

/**
 * What opening a board waits for once the session is restored (the editor
 * only mounts after that, so sign-in is read from `authLoadingAtom`).
 */
export type BoardLoadStage = "access" | "scene" | "render" | "done";

export type BoardLoad = {
  /** 0 while no board is being opened */
  id: number;
  stage: BoardLoadStage;
  /** the loading screen should go away: done, failed, skipped or timed out */
  finished: boolean;
  title: string | null;
  /** encrypted scene size, known once it's downloaded */
  sceneBytes: number | null;
  /** non-deleted elements of the loaded scene */
  elementCount: number | null;
  /** images the first paint waits for; null until the scene is known */
  images: { loaded: number; total: number } | null;
};

const IDLE_BOARD_LOAD: BoardLoad = {
  id: 0,
  stage: "access",
  finished: false,
  title: null,
  sceneBytes: null,
  elementCount: null,
  images: null,
};

export const boardLoadAtom = atom<BoardLoad>(IDLE_BOARD_LOAD);

let lastBoardLoadId = 0;
let safetyTimer: number | undefined;

const hasPendingImages = (images: BoardLoad["images"]) =>
  !!images && images.loaded < images.total;

const updateBoardLoad = (id: number, patch: Partial<BoardLoad>) => {
  const current = appJotaiStore.get(boardLoadAtom);
  // a newer board (or none) is being opened now
  if (id === 0 || current.id !== id) {
    return;
  }
  const next = { ...current, ...patch };
  if (next.stage === "done" && !hasPendingImages(next.images)) {
    next.finished = true;
  }
  if (next.finished) {
    window.clearTimeout(safetyTimer);
  }
  appJotaiStore.set(boardLoadAtom, next);
};

/** Starts tracking a board being opened, for the loading screen. */
export const beginBoardLoad = () => {
  const id = ++lastBoardLoadId;
  window.clearTimeout(safetyTimer);
  // never leave the board covered if some stage hangs
  safetyTimer = window.setTimeout(
    () => updateBoardLoad(id, { finished: true }),
    BOARD_LOAD_MAX_MS,
  );
  appJotaiStore.set(boardLoadAtom, { ...IDLE_BOARD_LOAD, id });
};

export const endBoardLoad = () => {
  window.clearTimeout(safetyTimer);
  appJotaiStore.set(boardLoadAtom, IDLE_BOARD_LOAD);
};

/** Lets the user lift the loading screen while images are still loading. */
export const skipBoardLoadWait = () =>
  updateBoardLoad(appJotaiStore.get(boardLoadAtom).id, { finished: true });

/**
 * Reports progress of the board load running now. Bound to that load, so a
 * slow previous board can't advance the next board's loading screen.
 */
export const getBoardLoadHandle = () => {
  const { id } = appJotaiStore.get(boardLoadAtom);
  const update = (patch: Partial<BoardLoad>) => updateBoardLoad(id, patch);

  return {
    active: id !== 0,
    setTitle: (title: string) => update({ title }),
    loadingScene: () => update({ stage: "scene" }),
    sceneDownloaded: (bytes: number) => update({ sceneBytes: bytes }),
    sceneReady: (elementCount: number) =>
      update({ stage: "render", elementCount }),
    imagesProgress: (loaded: number, total: number) =>
      update({ images: { loaded, total } }),
    rendered: () => update({ stage: "done" }),
    fail: () => update({ finished: true }),
  };
};

export type BoardLoadHandle = ReturnType<typeof getBoardLoadHandle>;

// -----------------------------------------------------------------------------
// what the loading screen shows
// -----------------------------------------------------------------------------

export const BOARD_LOAD_STEPS = [
  "auth",
  "access",
  "scene",
  "render",
  "images",
] as const;

export type BoardLoadStep = typeof BOARD_LOAD_STEPS[number];
export type BoardLoadStepStatus = "pending" | "active" | "done";

const STAGE_ORDER: readonly BoardLoadStage[] = [
  "access",
  "scene",
  "render",
  "done",
];

export const getBoardLoadSteps = (
  load: BoardLoad,
  authLoading: boolean,
): Record<BoardLoadStep, BoardLoadStepStatus> => {
  // index into BOARD_LOAD_STEPS of the step in progress; images run alongside
  // rendering, so they're tracked on their own
  const current = authLoading ? 0 : STAGE_ORDER.indexOf(load.stage) + 1;
  const status = (index: number): BoardLoadStepStatus =>
    index < current ? "done" : index === current ? "active" : "pending";

  return {
    auth: status(0),
    access: status(1),
    scene: status(2),
    render: status(3),
    images: !load.images
      ? "pending"
      : hasPendingImages(load.images)
      ? "active"
      : "done",
  };
};

/** share of the progress bar each step fills */
const STEP_WEIGHT: Record<BoardLoadStep, number> = {
  auth: 0.05,
  access: 0.1,
  scene: 0.35,
  render: 0.2,
  images: 0.3,
};

/** how long the bar takes to creep through a step it can't measure */
const STEP_CREEP_MS: Record<BoardLoadStep, number> = {
  auth: 2000,
  access: 3000,
  scene: 8000,
  render: 5000,
  images: 5000,
};

/** part of an unmeasured step the bar creeps into before it waits */
const CREEP_SHARE = 0.85;

/**
 * Fills the bar step by step. `creep` is set while the step in progress has no
 * measurable progress, so the bar can ease through it instead of standing still.
 */
export const getBoardLoadProgress = (
  load: BoardLoad,
  steps: Record<BoardLoadStep, BoardLoadStepStatus>,
): { value: number; creep: { to: number; ms: number } | null } => {
  let value = 0;
  for (const step of BOARD_LOAD_STEPS) {
    const weight = STEP_WEIGHT[step];
    if (steps[step] === "done") {
      value += weight;
    } else if (step === "images" && load.images) {
      return {
        value: Math.min(
          1,
          value + (weight * load.images.loaded) / load.images.total,
        ),
        creep: null,
      };
    } else {
      return {
        value,
        creep: { to: value + weight * CREEP_SHARE, ms: STEP_CREEP_MS[step] },
      };
    }
  }
  return { value: 1, creep: null };
};

// -----------------------------------------------------------------------------

const nextFrame = () =>
  new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

/**
 * Resolves once the editor has applied the initial scene and painted it, so a
 * large board isn't revealed as a blank canvas that fills in later. Resolves
 * false if cancelled first.
 */
export const waitForScenePaint = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  isCancelled: () => boolean,
) => {
  // `initialData` is applied asynchronously; until then the editor is loading
  while (excalidrawAPI.getAppState().isLoading) {
    await nextFrame();
    if (isCancelled()) {
      return false;
    }
  }
  // text first paints in a fallback face and repaints once scene fonts arrive
  await Promise.race([
    "fonts" in document ? document.fonts.ready : null,
    new Promise((resolve) =>
      window.setTimeout(resolve, BOARD_LOAD_FONTS_WAIT_MS),
    ),
  ]);
  // the static canvas renders on the next frame; one more to have it on screen
  await nextFrame();
  await nextFrame();
  return !isCancelled();
};
