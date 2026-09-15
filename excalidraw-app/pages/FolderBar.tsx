import {
  DotsHorizontalIcon,
  LoadIcon,
  PlusIcon,
  TrashIcon,
  pencilIcon,
} from "@excalidraw/excalidraw/components/icons";

import clsx from "clsx";
import { useState } from "react";

import { useAppT } from "../components/useAppT";

import { useDismissable } from "../components/useDismissable";

import { BOARD_DRAG_TYPE, sameView } from "./folderView";

import type { Folder } from "../data/folders";
import type { FolderView } from "./folderView";
import type { DragEvent, ReactNode } from "react";

const acceptsBoard = (event: DragEvent) =>
  event.dataTransfer.types.includes(BOARD_DRAG_TYPE);

const Chip = ({
  icon,
  label,
  count,
  active,
  dropTarget,
  over,
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  trailing,
}: {
  icon?: ReactNode;
  label: string;
  count: number;
  active: boolean;
  dropTarget: boolean;
  over: boolean;
  onSelect: () => void;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent) => void;
  trailing?: ReactNode;
}) => (
  <div
    className={clsx("exa-chip-group", {
      "exa-chip-group--active": active,
      "exa-chip-group--drop": dropTarget,
      "exa-chip-group--over": over,
    })}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <button
      type="button"
      className="exa-chip"
      aria-pressed={active}
      onClick={onSelect}
    >
      {icon}
      <span className="exa-chip__label">{label}</span>
      <span className="exa-chip__count">{count}</span>
    </button>
    {trailing}
  </div>
);

const ActiveFolderMenu = ({
  onRename,
  onDelete,
}: {
  onRename: () => void;
  onDelete: () => void;
}) => {
  const t = useAppT();
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  return (
    <div className="exa-chip__more" ref={ref}>
      <button
        type="button"
        className="exa-icon-btn exa-icon-btn--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.folders.options")}
        title={t("app.folders.options")}
        onClick={() => setOpen((prev) => !prev)}
      >
        {DotsHorizontalIcon}
      </button>
      {open && (
        <div className="exa-menu exa-chip__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="exa-menu__item"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            {pencilIcon}
            {t("app.folders.rename")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="exa-menu__item exa-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {TrashIcon}
            {t("app.folders.delete")}
          </button>
        </div>
      )}
    </div>
  );
};

export const FolderBar = ({
  folders,
  view,
  counts,
  allCount,
  unfiledCount,
  dragging,
  onSelect,
  onDropBoard,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  view: FolderView;
  /** Visible boards per folder id (after the board filter). */
  counts: ReadonlyMap<string, number>;
  allCount: number;
  unfiledCount: number;
  /** A board card is being dragged — light up the drop targets. */
  dragging: boolean;
  onSelect: (view: FolderView) => void;
  onDropBoard: (boardId: string, folderId: string | null) => void;
  onCreate: () => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}) => {
  const t = useAppT();
  const [overKey, setOverKey] = useState<string | null>(null);

  const dropHandlers = (key: string, folderId: string | null) => ({
    onDragOver: (event: DragEvent) => {
      if (!acceptsBoard(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (overKey !== key) {
        setOverKey(key);
      }
    },
    onDragLeave: () => setOverKey((prev) => (prev === key ? null : prev)),
    onDrop: (event: DragEvent) => {
      if (!acceptsBoard(event)) {
        return;
      }
      event.preventDefault();
      setOverKey(null);
      const boardId = event.dataTransfer.getData(BOARD_DRAG_TYPE);
      if (boardId) {
        onDropBoard(boardId, folderId);
      }
    },
  });

  return (
    <nav
      className={clsx("exa-folders", { "exa-folders--dragging": dragging })}
      aria-label={t("app.folders.navLabel")}
    >
      <Chip
        label={t("app.folders.all")}
        count={allCount}
        active={view.kind === "all"}
        dropTarget={false}
        over={false}
        onSelect={() => onSelect({ kind: "all" })}
      />
      <Chip
        label={t("app.folders.unfiled")}
        count={unfiledCount}
        active={view.kind === "unfiled"}
        dropTarget={dragging}
        over={overKey === "unfiled"}
        onSelect={() => onSelect({ kind: "unfiled" })}
        {...dropHandlers("unfiled", null)}
      />
      {folders.map((folder) => {
        const folderView: FolderView = { kind: "folder", id: folder.id };
        const active = sameView(view, folderView);
        return (
          <Chip
            key={folder.id}
            icon={LoadIcon}
            label={folder.name || t("app.folders.untitled")}
            count={counts.get(folder.id) ?? 0}
            active={active}
            dropTarget={dragging}
            over={overKey === folder.id}
            onSelect={() => onSelect(folderView)}
            {...dropHandlers(folder.id, folder.id)}
            trailing={
              active ? (
                <ActiveFolderMenu
                  onRename={() => onRename(folder)}
                  onDelete={() => onDelete(folder)}
                />
              ) : null
            }
          />
        );
      })}
      <button
        type="button"
        className="exa-chip exa-chip--new"
        onClick={onCreate}
      >
        {PlusIcon}
        <span className="exa-chip__label">{t("app.folders.newFolder")}</span>
      </button>
    </nav>
  );
};
