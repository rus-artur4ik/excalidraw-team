import {
  checkIcon,
  LoadIcon,
  PlusIcon,
} from "@excalidraw/excalidraw/components/icons";

import clsx from "clsx";
import { useState } from "react";

import { useAppT } from "../components/useAppT";

import { useDismissable } from "../components/useDismissable";

import type { Folder } from "../data/folders";

/** "Move to folder" trigger + menu, shown on every board card. */
export const FolderPickMenu = ({
  folders,
  currentId,
  onPick,
  onNewFolder,
  onOpenChange,
}: {
  folders: Folder[];
  currentId: string | null;
  onPick: (folderId: string | null) => void;
  onNewFolder: () => void;
  onOpenChange?: (open: boolean) => void;
}) => {
  const t = useAppT();
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const ref = useDismissable(open, () => setOpen(false));

  const choose = (folderId: string | null) => {
    setOpen(false);
    if (folderId !== currentId) {
      onPick(folderId);
    }
  };

  return (
    <div className="exa-folder-pick" ref={ref}>
      <button
        type="button"
        className={clsx("exa-icon-btn", { "exa-icon-btn--active": open })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.folders.moveTo")}
        title={t("app.folders.moveTo")}
        onClick={() => setOpen(!open)}
      >
        {LoadIcon}
      </button>
      {open && (
        <div className="exa-menu exa-folder-pick__menu" role="menu">
          {folders.map((folder) => {
            const selected = folder.id === currentId;
            return (
              <button
                key={folder.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={clsx("exa-menu__item", {
                  "exa-menu__item--selected": selected,
                })}
                onClick={() => choose(folder.id)}
              >
                <span className="exa-menu__check" aria-hidden="true">
                  {selected ? checkIcon : null}
                </span>
                <span className="exa-menu__label">
                  {folder.name || t("app.folders.untitled")}
                </span>
              </button>
            );
          })}
          {folders.length > 0 && <div className="exa-menu__sep" />}
          {currentId !== null && (
            <button
              type="button"
              role="menuitem"
              className="exa-menu__item"
              onClick={() => choose(null)}
            >
              <span className="exa-menu__check" aria-hidden="true" />
              <span className="exa-menu__label">
                {t("app.folders.removeFromFolder")}
              </span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="exa-menu__item"
            onClick={() => {
              setOpen(false);
              onNewFolder();
            }}
          >
            {PlusIcon}
            <span className="exa-menu__label">
              {t("app.folders.moveToNew")}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
