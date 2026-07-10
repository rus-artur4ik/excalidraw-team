import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import { useEffect, useRef, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppDialog } from "../components/AppDialog";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_BOT_POLICY, createBoard } from "../data/boards";
import { listMyBots, updateBot } from "../data/bots";
import { navigate } from "../router";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";

import type { BotPolicy, Visibility } from "../data/boards";
import type { Bot, BotBoardBinding } from "../data/bots";

type BindingRole = "read" | "write";

export const CreateBoardDialog = ({
  allowTeam,
  onClose,
}: {
  allowTeam: boolean;
  onClose: () => void;
}) => {
  const t = useAppT();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(DEFAULT_BOT_POLICY);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botBindings, setBotBindings] = useState<Map<string, BindingRole>>(
    new Map(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Survives a failed bot-access grant so retrying doesn't create a second board.
  const createdRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    listMyBots(user.uid)
      .then((loaded) => {
        if (!cancelled) {
          setBots(loaded);
        }
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibilityChoices = VISIBILITY_OPTIONS.filter(
    (option) => option.value !== "team" || allowTeam,
  ).map((option) => ({
    value: option.value,
    label: t(option.labelKey),
    ariaLabel: t(option.labelKey),
  }));

  const hintKey = VISIBILITY_OPTIONS.find(
    (o) => o.value === visibility,
  )?.hintKey;

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

  const toggleBot = (botId: string) =>
    setBotBindings((prev) => {
      const next = new Map(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.set(botId, "write");
      }
      return next;
    });

  const setBotRole = (botId: string, role: BindingRole) =>
    setBotBindings((prev) => new Map(prev).set(botId, role));

  const grantSelectedBots = async (roomId: string) => {
    if (botPolicy === "none") {
      return;
    }
    const grants = [...botBindings.entries()].flatMap(([botId, role]) => {
      const bot = bots.find((candidate) => candidate.id === botId);
      if (!bot) {
        return [];
      }
      const boards: BotBoardBinding[] = [
        ...bot.boards.filter((binding) => binding.boardId !== roomId),
        { boardId: roomId, role },
      ];
      return [updateBot(botId, { boards })];
    });
    await Promise.all(grants);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    if (!createdRoomIdRef.current) {
      try {
        const { roomId } = await createBoard({
          title: title.trim() || t("app.common.untitled"),
          visibility,
          botPolicy,
        });
        createdRoomIdRef.current = roomId;
      } catch (err) {
        console.error(err);
        setError(t("app.create.error"));
        setBusy(false);
        return;
      }
    }
    try {
      await grantSelectedBots(createdRoomIdRef.current);
    } catch (err) {
      console.error(err);
      setError(t("app.create.botsError"));
      setBusy(false);
      return;
    }
    navigate(`/b/${createdRoomIdRef.current}`);
  };

  return (
    <AppDialog
      title={t("app.create.title")}
      size="small"
      closeOnBackdrop={!busy}
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div className="exa-section">
        <TextField
          label={t("app.create.name")}
          value={title}
          placeholder={t("app.common.untitled")}
          selectOnRender
          onChange={setTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void create();
            }
          }}
        />
      </div>

      <div className="exa-section">
        <span className="exa-label">{t("app.create.access")}</span>
        <RadioGroup
          name="create-visibility"
          value={visibility}
          choices={visibilityChoices}
          onChange={setVisibility}
        />
        {hintKey && <p className="exa-hint">{t(hintKey)}</p>}
      </div>

      <div className="exa-section">
        <span className="exa-label">{t("app.create.botAccess")}</span>
        <RadioGroup
          name="create-bot-policy"
          value={botPolicy}
          choices={BOT_POLICY_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            ariaLabel: t(option.labelKey),
          }))}
          onChange={setBotPolicy}
        />
      </div>

      {bots.length > 0 && (
        <div className="exa-section">
          <span className="exa-label">{t("app.create.bots")}</span>
          {botPolicy === "none" ? (
            <p className="exa-hint">{t("app.create.botsNoneHint")}</p>
          ) : (
            <div className="exa-people">
              {bots.map((bot) => {
                const role = botBindings.get(bot.id);
                return (
                  <div key={bot.id} className="exa-binding-row">
                    <label className="exa-binding-row__check">
                      <input
                        type="checkbox"
                        checked={role !== undefined}
                        onChange={() => toggleBot(bot.id)}
                      />
                      <span
                        className="exa-bot-avatar"
                        style={{ background: bot.color }}
                        aria-hidden="true"
                      >
                        {bot.avatar?.value ?? "🤖"}
                      </span>
                      <span className="exa-binding-row__title">
                        {bot.name || t("app.bots.untitledBot")}
                      </span>
                    </label>
                    {role !== undefined && (
                      <RadioGroup
                        name={`create-bot-${bot.id}`}
                        value={role}
                        choices={roleChoices}
                        onChange={(next) => setBotRole(bot.id, next)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="exa-error-text" role="alert">
          {error}
        </p>
      )}

      <div className="exa-dialog-footer">
        <FilledButton
          variant="outlined"
          color="muted"
          label={t("app.common.cancel")}
          disabled={busy}
          onClick={onClose}
        />
        <FilledButton
          label={t("app.common.create")}
          status={busy ? "loading" : undefined}
          disabled={busy}
          onClick={create}
        />
      </div>
    </AppDialog>
  );
};
