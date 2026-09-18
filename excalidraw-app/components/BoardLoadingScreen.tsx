import { getLanguage } from "@excalidraw/excalidraw/i18n";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import { authLoadingAtom } from "../auth/atoms";
import {
  BOARD_LOAD_STEPS,
  beginBoardLoad,
  boardLoadAtom,
  endBoardLoad,
  getBoardLoadProgress,
  getBoardLoadSteps,
  skipBoardLoadWait,
} from "../boardLoad";

import { useAppLanguageReady } from "./useAppLanguageReady";
import { useAppT } from "./useAppT";
import { useResolvedTheme } from "./useResolvedTheme";

import "./BoardLoadingScreen.scss";

import type { BoardLoad, BoardLoadStep } from "../boardLoad";

// keep in sync with the leave transition in BoardLoadingScreen.scss
const LEAVE_MS = 220;

const STEP_LABEL = {
  auth: "app.boardLoading.auth",
  access: "app.boardLoading.access",
  scene: "app.boardLoading.scene",
  render: "app.boardLoading.render",
  images: "app.boardLoading.images",
} as const;

const ELEMENTS_LABEL = {
  zero: "app.boardLoading.elements_other",
  one: "app.boardLoading.elements_one",
  two: "app.boardLoading.elements_other",
  few: "app.boardLoading.elements_few",
  many: "app.boardLoading.elements_many",
  other: "app.boardLoading.elements_other",
} as const;

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(getLanguage().code, { maximumFractionDigits }).format(
    value,
  );

const pluralCategory = (count: number): keyof typeof ELEMENTS_LABEL => {
  try {
    return new Intl.PluralRules(getLanguage().code).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
};

const checkIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M4.5 8.25 6.9 10.6 11.5 5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const getStepDetails = (
  load: BoardLoad,
  t: ReturnType<typeof useAppT>,
): Partial<Record<BoardLoadStep, string>> => {
  const details: Partial<Record<BoardLoadStep, string>> = {};

  if (load.sceneBytes != null) {
    const megabytes = load.sceneBytes / 1024 / 1024;
    details.scene =
      megabytes >= 1
        ? t("app.boardLoading.sizeMb", { size: formatNumber(megabytes, 1) })
        : t("app.boardLoading.sizeKb", {
            size: formatNumber(Math.max(1, load.sceneBytes / 1024)),
          });
  }
  if (load.elementCount) {
    details.render = t(ELEMENTS_LABEL[pluralCategory(load.elementCount)], {
      count: formatNumber(load.elementCount),
    });
  }
  if (load.images) {
    details.images = load.images.total
      ? t("app.boardLoading.imagesProgress", {
          loaded: formatNumber(load.images.loaded),
          total: formatNumber(load.images.total),
        })
      : t("app.boardLoading.noImages");
  }
  return details;
};

/**
 * Covers a board from session restore until its scene is painted, listing
 * what's being waited on.
 */
export const BoardLoadingScreen = () => {
  const t = useAppT();
  const load = useAtomValue(boardLoadAtom);
  const authLoading = useAtomValue(authLoadingAtom);
  const theme = useResolvedTheme();
  const langReady = useAppLanguageReady();

  // stays mounted for the whole visit, so one load spans sign-in and editor
  useLayoutEffect(() => {
    beginBoardLoad();
    return endBoardLoad;
  }, []);

  // the bar starts creeping from where it's first drawn
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const [hiddenLoadId, setHiddenLoadId] = useState(0);
  useEffect(() => {
    if (!load.finished) {
      return;
    }
    const timer = window.setTimeout(() => setHiddenLoadId(load.id), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [load.finished, load.id]);

  // before the load is begun (first render) the idle state is what it'll be
  if (load.id !== 0 && hiddenLoadId === load.id) {
    return null;
  }

  const steps = getBoardLoadSteps(load, authLoading);
  const details = getStepDetails(load, t);
  const progress = getBoardLoadProgress(load, steps);
  const creep = armed && !load.finished ? progress.creep : null;

  // the scene is on screen and only images are left: let it show through
  const revealed = steps.render === "done";
  const currentStep = BOARD_LOAD_STEPS.find((step) => steps[step] === "active");

  return (
    <div
      className={clsx("excalidraw", "board-loader", {
        "theme--dark": theme === "dark",
        "board-loader--revealed": revealed,
        "board-loader--leaving": load.finished,
      })}
      aria-busy={!load.finished}
    >
      {langReady && (
        <div className="board-loader__card">
          <div className="board-loader__eyebrow">
            {t("app.boardLoading.heading")}
          </div>
          <div
            className={clsx("board-loader__title", {
              "board-loader__title--known": load.title != null,
            })}
            title={load.title ?? undefined}
          >
            {load.title != null &&
              (load.title.trim() || t("app.common.untitled"))}
          </div>

          <ol className="board-loader__steps">
            {BOARD_LOAD_STEPS.map((step) => (
              <li
                key={step}
                className={clsx(
                  "board-loader__step",
                  `board-loader__step--${steps[step]}`,
                )}
              >
                <span className="board-loader__icon" aria-hidden="true">
                  {steps[step] === "done" && checkIcon}
                </span>
                <span className="board-loader__label">
                  {t(STEP_LABEL[step])}
                </span>
                {details[step] && (
                  <span className="board-loader__detail">{details[step]}</span>
                )}
              </li>
            ))}
          </ol>

          <div
            className="board-loader__bar"
            role="progressbar"
            aria-label={t("app.boardLoading.heading")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.value * 100)}
          >
            <div
              className="board-loader__bar-fill"
              style={{
                transform: `scaleX(${creep ? creep.to : progress.value})`,
                transitionDuration: `${creep ? creep.ms : 300}ms`,
              }}
            />
          </div>

          {revealed && steps.images === "active" && !load.finished && (
            <button
              type="button"
              className="board-loader__skip"
              onClick={skipBoardLoadWait}
            >
              {t("app.boardLoading.skipImages")}
            </button>
          )}

          <span className="visually-hidden" aria-live="polite">
            {currentStep ? t(STEP_LABEL[currentStep]) : ""}
          </span>
        </div>
      )}
    </div>
  );
};
