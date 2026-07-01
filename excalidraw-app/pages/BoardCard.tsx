import {
  LinkIcon,
  LockedIcon,
  settingsIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";

import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { loadBoardThumbnail } from "../data/boardThumbnail";
import { navigate } from "../router";

import { botPolicyLabelKey } from "./boardOptions";

import type { Board } from "../data/boards";
import type { MouseEvent, ReactNode } from "react";

const visibilityBadge = (
  board: Board,
): {
  icon: ReactNode;
  labelKey:
    | "app.visibility.teamShort"
    | "app.visibility.linkShort"
    | "app.visibility.privateShort";
} => {
  if (board.visibility === "team" || board.teamId) {
    return { icon: usersIcon, labelKey: "app.visibility.teamShort" };
  }
  if (board.visibility === "link" || board.readPolicy === "public") {
    return { icon: LinkIcon, labelKey: "app.visibility.linkShort" };
  }
  return { icon: LockedIcon, labelKey: "app.visibility.privateShort" };
};

export const BoardCard = ({
  board,
  canManage,
  onSettings,
  roomKey,
}: {
  board: Board;
  canManage: boolean;
  onSettings: () => void;
  roomKey: string | null;
}) => {
  const t = useAppT();
  const [thumb, setThumb] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(!!roomKey);

  useEffect(() => {
    if (!roomKey) {
      setLoadingThumb(false);
      return;
    }
    let active = true;
    setLoadingThumb(true);
    loadBoardThumbnail({ roomId: board.roomId, roomKey })
      .then((dataUrl) => {
        if (active) {
          setThumb(dataUrl);
        }
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (active) {
          setLoadingThumb(false);
        }
      });
    return () => {
      active = false;
    };
  }, [board.roomId, roomKey]);

  const title = board.title || t("app.common.untitled");
  const href = `/b/${board.roomId}`;
  const open = (event: MouseEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
  const vis = visibilityBadge(board);

  return (
    <li className={board.archived ? "exa-card exa-card--archived" : "exa-card"}>
      <a
        className="exa-card__open"
        href={href}
        onClick={open}
        aria-label={t("app.card.open", { title })}
      >
        <div className="exa-card__thumb">
          {thumb ? (
            <img className="exa-card__img" src={thumb} alt="" />
          ) : loadingThumb ? (
            <div className="exa-skeleton" />
          ) : (
            <span className="exa-card__placeholder">
              {t("app.card.noPreview")}
            </span>
          )}
        </div>
      </a>
      <div className="exa-card__body">
        <a
          className="exa-card__open exa-card__title"
          href={href}
          onClick={open}
          title={title}
        >
          {title}
        </a>
        <div className="exa-card__badges">
          {board.archived && (
            <span className="exa-badge exa-badge--archived">
              {t("app.card.archivedBadge")}
            </span>
          )}
          <span className="exa-badge">
            {vis.icon}
            {t(vis.labelKey)}
          </span>
          <span className="exa-badge">
            {t("app.card.bots", {
              policy: t(botPolicyLabelKey(board.botPolicy)),
            })}
          </span>
          {canManage && (
            <button
              type="button"
              className="exa-icon-btn exa-card__settings"
              onClick={onSettings}
              aria-label={t("app.card.settings")}
              title={t("app.card.settings")}
            >
              {settingsIcon}
            </button>
          )}
        </div>
      </div>
    </li>
  );
};
