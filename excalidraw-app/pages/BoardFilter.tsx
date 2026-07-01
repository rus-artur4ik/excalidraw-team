import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useEffect, useRef, useState } from "react";

import { useAppT } from "../components/useAppT";

import { DEFAULT_BOT_POLICY } from "../data/boards";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";

import type { Board, BotPolicy, Visibility } from "../data/boards";

export type BoardStatusFilter = "active" | "archived";
export type BoardAccessFilter = "write" | "read";

export type BoardFilterValue = {
  status: BoardStatusFilter[];
  visibility: Visibility[];
  access: BoardAccessFilter[];
  bot: BotPolicy[];
};

export const DEFAULT_BOARD_FILTER: BoardFilterValue = {
  status: ["active"],
  visibility: ["private", "team", "link"],
  access: ["write", "read"],
  bot: ["none", "read", "write"],
};

const effectiveVisibility = (board: Board): Visibility => {
  if (board.visibility) {
    return board.visibility;
  }
  if (board.teamId) {
    return "team";
  }
  if (board.readPolicy === "public") {
    return "link";
  }
  return "private";
};

export const boardMatchesFilter = (
  board: Board,
  filter: BoardFilterValue,
  canWrite: boolean,
): boolean => {
  const status: BoardStatusFilter = board.archived ? "archived" : "active";
  if (!filter.status.includes(status)) {
    return false;
  }
  if (!filter.visibility.includes(effectiveVisibility(board))) {
    return false;
  }
  if (!filter.access.includes(canWrite ? "write" : "read")) {
    return false;
  }
  const bot = board.botPolicy ?? DEFAULT_BOT_POLICY;
  if (!filter.bot.includes(bot)) {
    return false;
  }
  return true;
};

const facetDeviation = (
  selected: readonly string[],
  defaults: readonly string[],
): number => {
  const defaultSet = new Set(defaults);
  const selectedSet = new Set(selected);
  return (
    selected.filter((item) => !defaultSet.has(item)).length +
    defaults.filter((item) => !selectedSet.has(item)).length
  );
};

const activeFacetCount = (filter: BoardFilterValue): number =>
  facetDeviation(filter.status, DEFAULT_BOARD_FILTER.status) +
  facetDeviation(filter.visibility, DEFAULT_BOARD_FILTER.visibility) +
  facetDeviation(filter.access, DEFAULT_BOARD_FILTER.access) +
  facetDeviation(filter.bot, DEFAULT_BOARD_FILTER.bot);

export const BoardFilter = ({
  value,
  onChange,
}: {
  value: BoardFilterValue;
  onChange: (next: BoardFilterValue) => void;
}) => {
  const t = useAppT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (group: keyof BoardFilterValue, item: string) => {
    const current = value[group] as string[];
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    onChange({ ...value, [group]: next } as BoardFilterValue);
  };

  const count = activeFacetCount(value);

  const group = (
    groupKey: keyof BoardFilterValue,
    title: string,
    items: ReadonlyArray<{ value: string; label: string }>,
    selected: string[],
  ) => (
    <div className="exa-filter__group">
      <span className="exa-filter__group-title">{title}</span>
      {items.map((item) => (
        <label key={item.value} className="exa-filter__option">
          <input
            type="checkbox"
            checked={selected.includes(item.value)}
            onChange={() => toggle(groupKey, item.value)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="exa-filter" ref={ref}>
      <FilledButton
        variant="outlined"
        color="muted"
        size="large"
        label={
          count > 0
            ? t("app.filter.buttonCount", { count })
            : t("app.filter.button")
        }
        onClick={() => setOpen((prev) => !prev)}
      />
      {open && (
        <div className="exa-menu exa-filter__menu" role="dialog">
          {group(
            "status",
            t("app.filter.status"),
            [
              { value: "active", label: t("app.filter.statusActive") },
              { value: "archived", label: t("app.filter.statusArchived") },
            ],
            value.status,
          )}
          {group(
            "visibility",
            t("app.filter.visibility"),
            VISIBILITY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            })),
            value.visibility,
          )}
          {group(
            "access",
            t("app.filter.access"),
            [
              { value: "write", label: t("app.filter.accessWrite") },
              { value: "read", label: t("app.filter.accessRead") },
            ],
            value.access,
          )}
          {group(
            "bot",
            t("app.filter.bot"),
            BOT_POLICY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            })),
            value.bot,
          )}
          <div className="exa-filter__footer">
            <button
              type="button"
              className="exa-filter__reset"
              disabled={count === 0}
              onClick={() => onChange(DEFAULT_BOARD_FILTER)}
            >
              {t("app.filter.reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
