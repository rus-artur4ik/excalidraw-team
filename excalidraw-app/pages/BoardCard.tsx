import {
  LinkIcon,
  LoadIcon,
  LockedIcon,
  settingsIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";

import clsx from "clsx";
import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { loadBoardThumbnail } from "../data/boardThumbnail";
import { navigate } from "../router";

import { FolderPickMenu } from "./FolderPickMenu";
import { BOARD_DRAG_TYPE } from "./folderView";
import { botPolicyLabelKey } from "./boardOptions";

import type { Board } from "../data/boards";
import type { Folder } from "../data/folders";
import type { DragEvent, MouseEvent, ReactNode } from "react";

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
  folders,
  folder,
  showFolder,
  onMoveToFolder,
  onNewFolder,
  onDragStateChange,
}: {
  board: Board;
  canManage: boolean;
  onSettings: () => void;
  roomKey: string | null;
  folders: Folder[];
  /** The folder this board is filed in, if any. */
  folder: Folder | null;
  /** Show the folder badge (hidden when the page is already inside it). */
  showFolder: boolean;
  onMoveToFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
  onDragStateChange: (dragging: boolean) => void;
}) => {
  const t = useAppT();
  const [thumb, setThumb] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(!!roomKey);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(BOARD_DRAG_TYPE, board.roomId);
    // Also expose the link so dropping outside the app still does something sane.
    event.dataTransfer.setData(
      "text/plain",
      `${window.location.origin}${href}`,
    );
    event.dataTransfer.effectAllowed = "copyMove";
    setDragging(true);
    onDragStateChange(true);
  };
  const onDragEnd = () => {
    setDragging(false);
    onDragStateChange(false);
  };

  return (
    <li
      className={clsx("exa-card", {
        "exa-card--archived": board.archived,
        "exa-card--dragging": dragging,
        "exa-card--menu-open": menuOpen,
      })}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
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
          {showFolder && folder && (
            <span
              className="exa-badge exa-badge--folder"
              title={t("app.folders.inFolder", {
                name: folder.name || t("app.folders.untitled"),
              })}
            >
              {LoadIcon}
              <span className="exa-badge__text">
                {folder.name || t("app.folders.untitled")}
              </span>
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
          <div className="exa-card__actions">
            <FolderPickMenu
              folders={folders}
              currentId={folder?.id ?? null}
              onPick={onMoveToFolder}
              onNewFolder={onNewFolder}
              onOpenChange={setMenuOpen}
            />
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
      </div>
    </li>
  );
};
