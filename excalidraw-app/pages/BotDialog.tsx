import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import clsx from "clsx";

import { useMemo, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { AppDialog } from "../components/AppDialog";
import { createBot, deleteBot, updateBot } from "../data/bots";
import { stopBot } from "../data/mcpTokens";

import { BotConnectPanel } from "./BotConnectPanel";

import type { Bot, BotBoardBinding } from "../data/bots";
import type { Board } from "../data/boards";

export const BOT_EMOJIS = [
  "🤖",
  "👾",
  "🐙",
  "🦊",
  "🐳",
  "🦉",
  "🐝",
  "🚀",
  "✨",
  "🧠",
  "📐",
  "🎨",
] as const;

export const BOT_COLORS = [
  "#6965db",
  "#e64980",
  "#f08c00",
  "#66a80f",
  "#0c8599",
  "#7048e8",
  "#e8590c",
  "#495057",
] as const;

type BindingRole = "read" | "write";

const bindingsFromBot = (bot: Bot | null): Map<string, BindingRole> =>
  new Map((bot?.boards ?? []).map((b) => [b.boardId, b.role]));

const bindingsKey = (bindings: Map<string, BindingRole>): string =>
  [...bindings.entries()]
    .map(([id, role]) => `${id}:${role}`)
    .sort()
    .join("|");

export const BotDialog = ({
  bot,
  boards,
  onClose,
  onSaved,
  onDeleted,
}: {
  bot: Bot | null;
  boards: Board[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) => {
  const t = useAppT();

  const baseline = useMemo(
    () => ({
      name: bot?.name ?? "",
      emoji: bot?.avatar?.value ?? BOT_EMOJIS[0],
      color: bot?.color ?? BOT_COLORS[0],
      enabled: !bot?.disabled,
      bindingsKey: bindingsKey(bindingsFromBot(bot)),
    }),
    [bot],
  );

  const [name, setName] = useState(baseline.name);
  const [emoji, setEmoji] = useState<string>(baseline.emoji);
  const [color, setColor] = useState<string>(baseline.color);
  const [enabled, setEnabled] = useState(baseline.enabled);
  const [bindings, setBindings] = useState<Map<string, BindingRole>>(
    bindingsFromBot(bot),
  );
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const roleChoices = [
    {
      value: "read" as const,
      label: t("app.bot.read"),
      ariaLabel: t("app.bot.read"),
    },
    {
      value: "write" as const,
      label: t("app.bot.write"),
      ariaLabel: t("app.bot.write"),
    },
  ];

  const dirty =
    name.trim() !== baseline.name.trim() ||
    emoji !== baseline.emoji ||
    color !== baseline.color ||
    enabled !== baseline.enabled ||
    bindingsKey(bindings) !== baseline.bindingsKey;

  const requestClose = () => {
    if (busy) {
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const toggleBoard = (boardId: string) =>
    setBindings((prev) => {
      const next = new Map(prev);
      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.set(boardId, "write");
      }
      return next;
    });

  const setBoardRole = (boardId: string, role: BindingRole) =>
    setBindings((prev) => new Map(prev).set(boardId, role));

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    const boardBindings: BotBoardBinding[] = [...bindings.entries()].map(
      ([boardId, role]) => ({ boardId, role }),
    );
    const patch = {
      name: name.trim() || t("app.bots.untitledBot"),
      avatar: { kind: "emoji" as const, value: emoji },
      color,
      boards: boardBindings,
      disabled: !enabled,
    };
    try {
      if (bot) {
        await updateBot(bot.id, patch);
        if (patch.disabled) {
          await stopBot(bot.id).catch((error) => console.error(error));
        }
      } else {
        await createBot(patch);
      }
      onSaved();
    } catch (error) {
      console.error(error);
      setSaveError(t("app.bots.saveError"));
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!bot) {
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await stopBot(bot.id).catch((error) => console.error(error));
      await deleteBot(bot.id);
      onDeleted();
    } catch (error) {
      console.error(error);
      setSaveError(t("app.bots.deleteError"));
      setBusy(false);
    }
  };

  return (
    <>
      <AppDialog
        title={bot ? t("app.bots.editTitle") : t("app.bots.createTitle")}
        size="regular"
        closeOnBackdrop={!busy}
        onClose={requestClose}
      >
        <div className="exa-bot-preview">
          <span
            className="exa-bot-avatar exa-bot-avatar--lg"
            style={{ background: color }}
            aria-hidden="true"
          >
            {emoji}
          </span>
          <span className="exa-bot-preview__name">
            {name.trim() || t("app.bots.untitledBot")}
          </span>
        </div>

        <div className="exa-section">
          <TextField
            label={t("app.bots.name")}
            value={name}
            placeholder={t("app.bots.namePlaceholder")}
            onChange={setName}
          />
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.bots.avatar")}</span>
          <div className="exa-swatches">
            {BOT_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                className={clsx("exa-swatch", {
                  "exa-swatch--active": option === emoji,
                })}
                aria-label={option}
                aria-pressed={option === emoji}
                onClick={() => setEmoji(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.bots.color")}</span>
          <div className="exa-swatches">
            {BOT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={clsx("exa-color-swatch", {
                  "exa-color-swatch--active": option === color,
                })}
                style={{ background: option }}
                aria-label={option}
                aria-pressed={option === color}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.bots.boards")}</span>
          {boards.length === 0 ? (
            <p className="exa-hint">{t("app.bots.noBoards")}</p>
          ) : (
            <div className="exa-people">
              {boards.map((board) => {
                const role = bindings.get(board.roomId);
                return (
                  <div key={board.roomId} className="exa-binding-row">
                    <label className="exa-binding-row__check">
                      <input
                        type="checkbox"
                        checked={role !== undefined}
                        onChange={() => toggleBoard(board.roomId)}
                      />
                      <span className="exa-binding-row__title">
                        {board.title || t("app.common.untitled")}
                      </span>
                    </label>
                    {role !== undefined && (
                      <RadioGroup
                        name={`bot-board-${board.roomId}`}
                        value={role}
                        choices={roleChoices}
                        onChange={(next) => setBoardRole(board.roomId, next)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.bots.status")}</span>
          <label className="exa-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span className="exa-switch__track" aria-hidden="true">
              <span className="exa-switch__thumb" />
            </span>
            <span>
              {enabled ? t("app.bots.enabled") : t("app.bots.disabled")}
            </span>
          </label>
        </div>

        {bot && <BotConnectPanel botId={bot.id} />}

        {bot && (
          <div className="exa-section exa-danger-zone">
            <span className="exa-label exa-danger-zone__title">
              {t("app.settings.dangerZone")}
            </span>
            <p className="exa-hint">{t("app.bots.deleteHint")}</p>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.bots.delete")}
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        )}

        {saveError && (
          <p className="exa-error-text" role="alert">
            {saveError}
          </p>
        )}

        <div className="exa-dialog-footer">
          <FilledButton
            variant="outlined"
            color="muted"
            label={t("app.common.cancel")}
            disabled={busy}
            onClick={requestClose}
          />
          <FilledButton
            label={t("app.common.save")}
            status={busy ? "loading" : undefined}
            disabled={busy}
            onClick={save}
          />
        </div>
      </AppDialog>

      {confirmDiscard && (
        <AppConfirm
          title={t("app.bots.discardTitle")}
          message={t("app.bots.discardMessage")}
          confirmLabel={t("app.settings.discardConfirm")}
          cancelLabel={t("app.settings.discardCancel")}
          danger
          onConfirm={onClose}
          onClose={() => setConfirmDiscard(false)}
        />
      )}

      {confirmDelete && bot && (
        <AppConfirm
          title={t("app.bots.deleteTitle")}
          message={t("app.bots.deleteMessage", {
            name: bot.name || t("app.bots.untitledBot"),
          })}
          confirmLabel={t("app.bots.delete")}
          danger
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
};
