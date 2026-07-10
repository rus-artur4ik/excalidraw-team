import { t } from "@excalidraw/excalidraw/i18n";
import Spinner from "@excalidraw/excalidraw/components/Spinner";
import clsx from "clsx";

import { useEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { useAtomValue } from "../app-jotai";
import { collabSceneLoadAtom } from "../collab/Collab";

import "./CollabLoadingOverlay.scss";

const SHOW_DELAY_MS = 250;

export const CollabLoadingOverlay = ({ theme }: { theme: Theme }) => {
  const load = useAtomValue(collabSceneLoadAtom);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!load.active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [load.active]);

  if (!load.active || !visible) {
    return null;
  }

  const percent =
    load.phase === "images" && load.total > 0
      ? Math.round((load.loaded / load.total) * 100)
      : null;

  return (
    <div
      className={clsx(
        "collab-loading-overlay",
        `collab-loading-overlay--${theme}`,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="collab-loading-overlay__box">
        <Spinner size="2rem" />
        <div className="collab-loading-overlay__label">
          {percent === null
            ? t("labels.loadingScene")
            : t("labels.loadingImages", { progress: percent })}
        </div>
        {percent !== null && (
          <div className="collab-loading-overlay__bar">
            <div
              className="collab-loading-overlay__bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
