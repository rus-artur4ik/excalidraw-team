import { PlusIcon } from "@excalidraw/excalidraw/components/icons";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import Spinner from "@excalidraw/excalidraw/components/Spinner";

import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppHeader } from "../components/AppHeader";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { listMyBoards, listTeamBoards } from "../data/boards";
import { listMyBots, updateBot } from "../data/bots";
import { getBotStatus, listMcpTokens, stopBot } from "../data/mcpTokens";
import { navigate } from "../router";

import { BotDialog } from "./BotDialog";

import type { Board } from "../data/boards";
import type { Bot } from "../data/bots";
import type { BotStatus } from "../data/mcpTokens";

const unionBoards = (...groups: Board[][]): Board[] => {
  const byId = new Map<string, Board>();
  for (const group of groups) {
    for (const board of group) {
      byId.set(board.roomId, board);
    }
  }
  return [...byId.values()];
};

const BotCard = ({
  bot,
  status,
  tokenCount,
  toggling,
  onOpen,
  onToggle,
}: {
  bot: Bot;
  status: BotStatus | undefined;
  tokenCount: number | undefined;
  toggling: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) => {
  const t = useAppT();
  const enabled = !bot.disabled;

  const statusBadge = !enabled
    ? { key: "app.bots.disabled" as const, tone: "muted" }
    : status
    ? status.online
      ? { key: "app.bots.online" as const, tone: "online" }
      : { key: "app.bots.offline" as const, tone: "muted" }
    : null;

  return (
    <li className="exa-bot-card">
      <button type="button" className="exa-bot-card__open" onClick={onOpen}>
        <span
          className="exa-bot-avatar"
          style={{ background: bot.color }}
          aria-hidden="true"
        >
          {bot.avatar?.value}
        </span>
        <span className="exa-bot-card__info">
          <span className="exa-bot-card__name">
            {bot.name || t("app.bots.untitledBot")}
          </span>
          <span className="exa-bot-card__badges">
            <span className="exa-badge">
              {t(
                bot.boards.length === 1
                  ? "app.bots.boardCountOne"
                  : "app.bots.boardCount",
                { count: bot.boards.length },
              )}
            </span>
            {bot.canCreateBoards && (
              <span className="exa-badge">
                {t("app.bots.canCreateBoardsBadge")}
              </span>
            )}
            {tokenCount !== undefined && (
              <span className="exa-badge">
                {t(
                  tokenCount === 1
                    ? "app.bots.tokenCountOne"
                    : "app.bots.tokenCount",
                  { count: tokenCount },
                )}
              </span>
            )}
            {statusBadge && (
              <span
                className={
                  statusBadge.tone === "online"
                    ? "exa-badge exa-badge--online"
                    : "exa-badge"
                }
              >
                {t(statusBadge.key)}
              </span>
            )}
          </span>
        </span>
      </button>
      <label
        className="exa-switch exa-bot-card__toggle"
        title={enabled ? t("app.bots.enabled") : t("app.bots.disabled")}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={toggling}
          onChange={onToggle}
        />
        <span className="exa-switch__track" aria-hidden="true">
          <span className="exa-switch__thumb" />
        </span>
      </label>
    </li>
  );
};

export const BotsPage = () => {
  const t = useAppT();
  const { user, loading } = useAuth();
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [statuses, setStatuses] = useState<Map<string, BotStatus>>(new Map());
  const [tokenCounts, setTokenCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setBots([]);
      return;
    }
    let cancelled = false;
    setBots(null);
    setLoadError(false);
    (async () => {
      const [myBots, mine, teamBoards] = await Promise.all([
        listMyBots(user.uid),
        listMyBoards(),
        listTeamBoards().catch(() => [] as Board[]),
      ]);
      if (cancelled) {
        return;
      }
      setBoards(unionBoards(mine, teamBoards));
      setBots(myBots);
      const statusMap = new Map<string, BotStatus>();
      const countMap = new Map<string, number>();
      await Promise.all(
        myBots.map(async (bot) => {
          const [status, tokens] = await Promise.all([
            getBotStatus(bot.id).catch(() => null),
            listMcpTokens(bot.id).catch(() => null),
          ]);
          if (status) {
            statusMap.set(bot.id, status);
          }
          if (tokens) {
            countMap.set(bot.id, tokens.filter((tk) => !tk.revoked).length);
          }
        }),
      );
      if (!cancelled) {
        setStatuses(statusMap);
        setTokenCounts(countMap);
      }
    })().catch((error) => {
      console.error(error);
      if (!cancelled) {
        setLoadError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  const toggle = async (bot: Bot) => {
    const nextDisabled = !bot.disabled;
    setTogglingId(bot.id);
    try {
      await updateBot(bot.id, { disabled: nextDisabled });
      if (nextDisabled) {
        await stopBot(bot.id).catch((error) => console.error(error));
      }
      setBots((prev) =>
        (prev ?? []).map((item) =>
          item.id === bot.id ? { ...item, disabled: nextDisabled } : item,
        ),
      );
    } catch (error) {
      console.error(error);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="exa-page">
          <p className="exa-loading-text">{t("app.common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="exa-page">
          <p className="exa-empty">{t("app.bots.signInPrompt")}</p>
          <FilledButton
            variant="outlined"
            label={t("app.common.backToBoards")}
            onClick={() => navigate("/")}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader user={user} isAdmin={false} />

      <div className="exa-page">
        <div className="exa-page-head">
          <h1>{t("app.bots.title")}</h1>
          <div className="exa-page-head__actions">
            <FilledButton
              size="large"
              icon={PlusIcon}
              label={t("app.bots.newBot")}
              onClick={() => setCreating(true)}
            />
          </div>
        </div>

        {loadError ? (
          <div className="exa-error" role="alert">
            <span>{t("app.bots.loadError")}</span>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.common.retry")}
              onClick={reload}
            />
          </div>
        ) : bots === null ? (
          <div className="exa-shell-loading">
            <Spinner size={28} />
          </div>
        ) : bots.length === 0 ? (
          <p className="exa-empty">{t("app.bots.empty")}</p>
        ) : (
          <ul className="exa-bots-grid">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                status={statuses.get(bot.id)}
                tokenCount={tokenCounts.get(bot.id)}
                toggling={togglingId === bot.id}
                onOpen={() => setEditing(bot)}
                onToggle={() => toggle(bot)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <BotDialog
          bot={null}
          boards={boards}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
          onDeleted={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {editing && (
        <BotDialog
          bot={editing}
          boards={boards}
          onClose={() => {
            setEditing(null);
            reload();
          }}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onDeleted={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </AppShell>
  );
};
