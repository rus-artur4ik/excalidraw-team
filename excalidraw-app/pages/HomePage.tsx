import { useEffect, useState } from "react";

import { BusyButton } from "../components/BusyButton";
import { useAuth } from "../auth/AuthContext";
import {
  createBoard,
  listInvitedBoards,
  listMyBoards,
  listTeamBoards,
  loadBoardKeys,
  loadTeam,
  teamRoleOf,
} from "../data/boards";
import { navigate } from "../router";

import { BoardCard } from "./BoardCard";
import { ShareDialog } from "./BoardSettings";
import { McpConfigDialog } from "./McpConfigDialog";
import {
  badge,
  boardCard,
  btn,
  cardGrid,
  headerStyle,
  input,
  linkBtn,
  pageStyle,
  skeletonShimmer,
  thumbBox,
} from "./pageStyles";

import type { Board } from "../data/boards";

const SkeletonCard = () => (
  <li style={boardCard}>
    <div style={thumbBox}>
      <div style={skeletonShimmer} />
    </div>
    <div style={{ padding: "10px 12px", display: "flex", gap: 6 }}>
      <span style={{ ...badge, width: 70, height: 14 }} />
      <span style={{ ...badge, width: 50, height: 14 }} />
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
  const { user, loading, signIn, signOut } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [roomKeys, setRoomKeys] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [shareBoard, setShareBoard] = useState<Board | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mcpOpen, setMcpOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setBoards([]);
      setIsAdmin(false);
      setLoadingBoards(false);
      return;
    }
    let cancelled = false;
    setLoadingBoards(true);
    (async () => {
      const team = await loadTeam();
      const role = teamRoleOf(team, user.email);
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
      setIsAdmin(role === "admin");
      const keys = await loadBoardKeys(list.map((board) => board.roomId));
      if (!cancelled) {
        setRoomKeys(keys);
      }
    })()
      .catch((error) => console.error(error))
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
    return <div style={pageStyle}>Загрузка…</div>;
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <h1>Excalidraw Team</h1>
        <BusyButton
          style={btn}
          busy={signingIn}
          busyLabel="Вход…"
          onClick={() => {
            setSigningIn(true);
            signIn()
              .catch((e) => console.error(e))
              .finally(() => setSigningIn(false));
          }}
        >
          Войти через Google
        </BusyButton>
      </div>
    );
  }

  const handleCreate = async () => {
    setBusy(true);
    try {
      const { roomId } = await createBoard({
        title: title.trim() || "Untitled board",
      });
      navigate(`/b/${roomId}`);
    } catch (error) {
      console.error(error);
      window.alert("Не удалось создать доску");
    } finally {
      setBusy(false);
    }
  };

  const canManage = (board: Board): boolean =>
    board.ownerUid === user.uid ||
    (isAdmin && (board.visibility === "team" || !!board.teamId));

  return (
    <div style={pageStyle}>
      <style>
        {`@keyframes boardSkeleton { 0% { background-position: 100% 0 } 100% { background-position: -100% 0 } }`}
      </style>
      <header style={headerStyle}>
        <h1>Ваши доски</h1>
        <div>
          <button style={linkBtn} onClick={() => setMcpOpen(true)}>
            Подключить AI (MCP)
          </button>
          {isAdmin && (
            <button style={linkBtn} onClick={() => navigate("/admin")}>
              Команда
            </button>
          )}
          <span style={{ marginLeft: 12 }}>
            {user.displayName ?? user.email}
          </span>
          <button
            style={linkBtn}
            onClick={() => signOut().catch(console.error)}
          >
            Выйти
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          style={input}
          placeholder="Название новой доски"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <BusyButton
          style={btn}
          busy={busy}
          busyLabel="Создание…"
          onClick={handleCreate}
        >
          Создать доску
        </BusyButton>
      </div>

      {loadingBoards ? (
        <ul style={cardGrid}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : boards.length === 0 ? (
        <p style={{ color: "#888" }}>Досок пока нет. Создайте первую выше.</p>
      ) : (
        <ul style={cardGrid}>
          {boards.map((board) => (
            <BoardCard
              key={board.roomId}
              board={board}
              canManage={canManage(board)}
              roomKey={roomKeys.get(board.roomId) ?? null}
              onAccess={() => setShareBoard(board)}
            />
          ))}
        </ul>
      )}

      {shareBoard && (
        <ShareDialog
          board={shareBoard}
          onClose={() => setShareBoard(null)}
          onSaved={() => {
            setShareBoard(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {mcpOpen && <McpConfigDialog onClose={() => setMcpOpen(false)} />}
    </div>
  );
};
