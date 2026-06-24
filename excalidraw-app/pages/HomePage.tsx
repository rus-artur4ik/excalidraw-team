import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  createBoard,
  listMyBoards,
  listMyTeamIds,
  listTeamBoards,
  loadTeam,
} from "../data/boards";
import { navigate } from "../router";

import { BoardCard } from "./BoardCard";
import { BoardSettings } from "./BoardSettings";
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

export const HomePage = () => {
  const { user, loading, signIn, signOut } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      const teamIds = await listMyTeamIds();
      const [mine, team] = await Promise.all([
        listMyBoards(),
        listTeamBoards(teamIds),
      ]);
      const byId = new Map<string, Board>();
      [...mine, ...team].forEach((board) => byId.set(board.roomId, board));
      const teams = await Promise.all(teamIds.map((id) => loadTeam(id)));
      if (cancelled) {
        return;
      }
      setBoards([...byId.values()]);
      setIsAdmin(
        teams.some((t) => t && user.email && t.admins.includes(user.email)),
      );
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
    return <div style={pageStyle}>Loading…</div>;
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <h1>Excalidraw Team</h1>
        <button
          style={btn}
          onClick={() => signIn().catch((e) => console.error(e))}
        >
          Sign in with Google
        </button>
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
      window.alert("Failed to create board");
    } finally {
      setBusy(false);
    }
  };

  const expandedBoard = boards.find((board) => board.roomId === expandedId);

  return (
    <div style={pageStyle}>
      <style>
        {`@keyframes boardSkeleton { 0% { background-position: 100% 0 } 100% { background-position: -100% 0 } }`}
      </style>
      <header style={headerStyle}>
        <h1>Your boards</h1>
        <div>
          <button style={linkBtn} onClick={() => setMcpOpen(true)}>
            Connect AI (MCP)
          </button>
          {isAdmin && (
            <button style={linkBtn} onClick={() => navigate("/admin")}>
              Admin
            </button>
          )}
          <span style={{ marginLeft: 12 }}>
            {user.displayName ?? user.email}
          </span>
          <button
            style={linkBtn}
            onClick={() => signOut().catch(console.error)}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          style={input}
          placeholder="New board title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button style={btn} disabled={busy} onClick={handleCreate}>
          Create board
        </button>
      </div>

      {loadingBoards ? (
        <ul style={cardGrid}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : boards.length === 0 ? (
        <p style={{ color: "#888" }}>No boards yet. Create your first one above.</p>
      ) : (
        <ul style={cardGrid}>
          {boards.map((board) => (
            <BoardCard
              key={board.roomId}
              board={board}
              owned={board.ownerUid === user.uid}
              onAccess={() =>
                setExpandedId(
                  expandedId === board.roomId ? null : board.roomId,
                )
              }
            />
          ))}
        </ul>
      )}

      {expandedBoard && expandedBoard.ownerUid === user.uid && (
        <div style={{ marginTop: 16 }}>
          <BoardSettings
            board={expandedBoard}
            onSaved={() => {
              setExpandedId(null);
              setReloadKey((key) => key + 1);
            }}
          />
        </div>
      )}

      {mcpOpen && <McpConfigDialog onClose={() => setMcpOpen(false)} />}
    </div>
  );
};
