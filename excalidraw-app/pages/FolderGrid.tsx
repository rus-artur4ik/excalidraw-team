import {
  DotsHorizontalIcon,
  LoadIcon,
  TrashIcon,
  pencilIcon,
} from "@excalidraw/excalidraw/components/icons";
import { getLanguage } from "@excalidraw/excalidraw/i18n";

import clsx from "clsx";
import { useState } from "react";

import { useAppT } from "../components/useAppT";

import { useDismissable } from "../components/useDismissable";
import { folderPath } from "../router";

import { navigateWithFolderMorph, useBoardDrop } from "./folderView";

import type { Folder } from "../data/folders";
import type { MouseEvent } from "react";

const BOARD_COUNT_LABEL = {
  zero: "app.folders.boards_other",
  one: "app.folders.boards_one",
  two: "app.folders.boards_other",
  few: "app.folders.boards_few",
  many: "app.folders.boards_many",
  other: "app.folders.boards_other",
} as const;

const boardCountKey = (count: number) => {
  try {
    return BOARD_COUNT_LABEL[
      new Intl.PluralRules(getLanguage().code).select(count)
    ];
  } catch {
    return BOARD_COUNT_LABEL[count === 1 ? "one" : "other"];
  }
};

/** Leaves modified clicks (new tab, new window) to the browser. */
const isPlainClick = (event: MouseEvent) =>
  !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0;

const FolderMenu = ({
  onRename,
  onDelete,
  onOpenChange,
}: {
  onRename: () => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useAppT();
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange(next);
  };
  const ref = useDismissable(open, () => setOpen(false));
  return (
    <div className="exa-folder-tile__more" ref={ref}>
      <button
        type="button"
        className="exa-icon-btn exa-icon-btn--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.folders.options")}
        title={t("app.folders.options")}
        onClick={() => setOpen(!open)}
      >
        {DotsHorizontalIcon}
      </button>
      {open && (
        <div className="exa-menu" role="menu">
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

const FolderLabel = ({
  name,
  count,
  heading,
}: {
  name: string;
  count: number;
  heading?: boolean;
}) => {
  const t = useAppT();
  const Name = heading ? "h2" : "span";
  return (
    <>
      <span className="exa-folder-tile__icon" aria-hidden="true">
        {LoadIcon}
      </span>
      <span className="exa-folder-tile__text">
        <Name className="exa-folder-tile__name" title={name}>
          {name}
        </Name>
        <span className="exa-folder-tile__count">
          {t(boardCountKey(count), { count })}
        </span>
      </span>
    </>
  );
};

const FolderTile = ({
  folder,
  count,
  dragging,
  onDropBoard,
  onRename,
  onDelete,
}: {
  folder: Folder;
  count: number;
  dragging: boolean;
  onDropBoard: (boardId: string) => void;
  onRename: () => void;
  onDelete: () => void;
}) => {
  const t = useAppT();
  const { over, dropHandlers } = useBoardDrop(onDropBoard);
  const [menuOpen, setMenuOpen] = useState(false);
  const name = folder.name || t("app.folders.untitled");
  const href = folderPath(folder.id);
  return (
    <li
      className={clsx("exa-folder-tile", {
        "exa-folder-tile--drop": dragging,
        "exa-folder-tile--over": over,
        "exa-folder-tile--menu-open": menuOpen,
      })}
      data-folder-tile={folder.id}
      {...dropHandlers}
    >
      <a
        className="exa-folder-tile__open"
        href={href}
        onClick={(event) => {
          if (isPlainClick(event)) {
            event.preventDefault();
            navigateWithFolderMorph(href, folder.id);
          }
        }}
      >
        <FolderLabel name={name} count={count} />
      </a>
      <FolderMenu
        onRename={onRename}
        onDelete={onDelete}
        onOpenChange={setMenuOpen}
      />
    </li>
  );
};

/** The folders of the home page root, as tiles ahead of the boards. */
export const FolderGrid = ({
  folders,
  counts,
  dragging,
  onDropBoard,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  /** Visible boards per folder id (after the board filter). */
  counts: ReadonlyMap<string, number>;
  /** A board card is being dragged — light up the drop targets. */
  dragging: boolean;
  onDropBoard: (boardId: string, folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}) => (
  <ul
    className={clsx("exa-grid exa-grid--enter exa-folder-grid", {
      "exa-folder-grid--dragging": dragging,
    })}
  >
    {folders.map((folder) => (
      <FolderTile
        key={folder.id}
        folder={folder}
        count={counts.get(folder.id) ?? 0}
        dragging={dragging}
        onDropBoard={(boardId) => onDropBoard(boardId, folder.id)}
        onRename={() => onRename(folder)}
        onDelete={() => onDelete(folder)}
      />
    ))}
  </ul>
);

/**
 * "All boards › <folder>" above an open folder. The root link takes a dropped
 * board out of the folder; the folder itself is the tile it was opened from.
 */
export const FolderHeader = ({
  folder,
  count,
  dragging,
  onDropBoard,
  onRename,
  onDelete,
}: {
  folder: Folder;
  count: number;
  dragging: boolean;
  /** A board dropped on "All boards" leaves the folder. */
  onDropBoard: (boardId: string) => void;
  onRename: () => void;
  onDelete: () => void;
}) => {
  const t = useAppT();
  const { over, dropHandlers } = useBoardDrop(onDropBoard);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav
      className={clsx("exa-crumbs", { "exa-crumbs--dragging": dragging })}
      aria-label={t("app.folders.navLabel")}
    >
      <a
        className={clsx("exa-crumbs__root", {
          "exa-crumbs__root--drop": dragging,
          "exa-crumbs__root--over": over,
        })}
        href="/"
        onClick={(event) => {
          if (isPlainClick(event)) {
            event.preventDefault();
            navigateWithFolderMorph("/", folder.id);
          }
        }}
        {...dropHandlers}
      >
        {t("app.folders.all")}
      </a>
      <span className="exa-crumbs__sep" aria-hidden="true">
        ›
      </span>
      <div
        className={clsx("exa-folder-tile exa-folder-tile--head", {
          "exa-folder-tile--menu-open": menuOpen,
        })}
        aria-current="page"
      >
        <div className="exa-folder-tile__open">
          <FolderLabel
            name={folder.name || t("app.folders.untitled")}
            count={count}
            heading
          />
        </div>
        <FolderMenu
          onRename={onRename}
          onDelete={onDelete}
          onOpenChange={setMenuOpen}
        />
      </div>
    </nav>
  );
};
