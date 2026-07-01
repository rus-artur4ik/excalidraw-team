import { ExcalLogo, PlusIcon } from "@excalidraw/excalidraw/components/icons";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppHeader } from "../components/AppHeader";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import {
  canWriteBoard,
  listInvitedBoards,
  listMyBoards,
  listTeamBoards,
  loadBoardKeys,
  loadTeam,
  teamRoleOf,
} from "../data/boards";

import { BoardCard } from "./BoardCard";
import {
  BoardFilter,
  boardMatchesFilter,
  DEFAULT_BOARD_FILTER,
} from "./BoardFilter";
import { BoardSettingsDialog } from "./BoardSettings";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { McpConfigDialog } from "./McpConfigDialog";

import type { BoardFilterValue } from "./BoardFilter";
import type { Board, Team } from "../data/boards";

const SkeletonCard = () => (
  <li className="exa-card" aria-hidden="true">
    <div className="exa-card__thumb">
      <div className="exa-skeleton" />
    </div>
    <div className="exa-card__body">
      <span className="exa-skeleton-pill" style={{ width: "60%" }} />
      <span className="exa-skeleton-pill" style={{ width: "40%" }} />
    </div>
  </li>
);

const unionById = (...groups: Board[][]): Board[] => {
  const byId = new Map<string, Board>();
  for (const group of groups) {
    for (const board of group) {
      byId.set(board.roomId, board);
    }
  }
  return [...byId.values()];
};

export const HomePage = () => {
  const t = useAppT();
  const { user, loading, signIn } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [roomKeys, setRoomKeys] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingsBoard, setSettingsBoard] = useState<Board | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [filter, setFilter] = useState<BoardFilterValue>(DEFAULT_BOARD_FILTER);

  useEffect(() => {
    if (!user) {
      setBoards([]);
      setIsAdmin(false);
      setIsTeamMember(false);
      setLoadingBoards(false);
      return;
    }
    let cancelled = false;
    setLoadingBoards(true);
    setLoadError(false);
    (async () => {
      const loadedTeam = await loadTeam();
      const role = teamRoleOf(loadedTeam, user.email);
      const [mine, invited, teamBoards] = await Promise.all([
        listMyBoards(),
        user.email ? listInvitedBoards(user.email) : Promise.resolve([]),
        role ? listTeamBoards() : Promise.resolve([]),
      ]);
      if (cancelled) {
        return;
      }
      const list = unionById(mine, invited, teamBoards);
      setBoards(list);
      setTeam(loadedTeam);
      setIsAdmin(role === "admin");
      setIsTeamMember(!!role);
      const keys = await loadBoardKeys(list.map((board) => board.roomId));
      if (!cancelled) {
        setRoomKeys(keys);
      }
    })()
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBoards(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

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
        <div className="exa-signin">
          <div className="exa-signin__logo">{ExcalLogo}</div>
          <h1 className="exa-signin__title">{t("app.brand")}</h1>
          <p className="exa-signin__tagline">{t("app.signIn.tagline")}</p>
          <div className="exa-signin__card">
            <FilledButton
              size="large"
              fullWidth
              label={t("app.signIn.google")}
              onClick={async () => {
                try {
                  await signIn();
                } catch (error) {
                  console.error(error);
                }
              }}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  const canManage = (board: Board): boolean =>
    board.ownerUid === user.uid ||
    (isAdmin && (board.visibility === "team" || !!board.teamId));

  const visibleBoards = boards.filter((board) =>
    boardMatchesFilter(board, filter, canWriteBoard(board, user, team)),
  );

  return (
    <AppShell>
      <AppHeader
        user={user}
        isAdmin={isAdmin}
        onOpenMcp={() => setMcpOpen(true)}
      />

      <div className="exa-page">
        <div className="exa-page-head">
          <h1>{t("app.home.title")}</h1>
          <div className="exa-page-head__actions">
            <BoardFilter value={filter} onChange={setFilter} />
            <FilledButton
              size="large"
              icon={PlusIcon}
              label={t("app.home.newBoard")}
              onClick={() => setCreating(true)}
            />
          </div>
        </div>

        {loadingBoards ? (
          <ul className="exa-grid">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonCard key={index} />
            ))}
          </ul>
        ) : loadError ? (
          <div className="exa-error" role="alert">
            <span>{t("app.home.loadError")}</span>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.common.retry")}
              onClick={() => setReloadKey((key) => key + 1)}
            />
          </div>
        ) : visibleBoards.length === 0 ? (
          <p className="exa-empty">
            {boards.length === 0
              ? t("app.home.empty")
              : t("app.home.emptyFiltered")}
          </p>
        ) : (
          <ul className="exa-grid">
            {visibleBoards.map((board) => (
              <BoardCard
                key={board.roomId}
                board={board}
                canManage={canManage(board)}
                roomKey={roomKeys.get(board.roomId) ?? null}
                onSettings={() => setSettingsBoard(board)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <CreateBoardDialog
          allowTeam={isTeamMember}
          onClose={() => setCreating(false)}
        />
      )}

      {settingsBoard && (
        <BoardSettingsDialog
          board={settingsBoard}
          onClose={() => setSettingsBoard(null)}
          onSaved={() => {
            setSettingsBoard(null);
            setReloadKey((key) => key + 1);
          }}
          onDeleted={() => {
            setSettingsBoard(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {mcpOpen && <McpConfigDialog onClose={() => setMcpOpen(false)} />}
    </AppShell>
  );
};
