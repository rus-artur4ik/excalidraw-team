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

import { BoardSettings } from "./BoardSettings";
import { McpConfigDialog } from "./McpConfigDialog";
import {
  btn,
  card,
  headerStyle,
  input,
  linkBtn,
  pageStyle,
} from "./pageStyles";

import type { Board } from "../data/boards";

export const HomePage = () => {
  const { user, loading, signIn, signOut } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mcpBoardId, setMcpBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBoards([]);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
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
    })().catch((error) => console.error(error));
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

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1>Your boards</h1>
        <div>
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

      {boards.length === 0 ? (
        <p>No boards yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {boards.map((board) => {
            const owned = board.ownerUid === user.uid;
            return (
              <li key={board.roomId} style={{ listStyle: "none" }}>
                <div style={card}>
                  <span
                    style={{ cursor: "pointer", flex: 1 }}
                    onClick={() => navigate(`/b/${board.roomId}`)}
                  >
                    <strong>{board.title || "Untitled"}</strong>{" "}
                    <span style={{ color: "#888" }}>
                      {board.type === "team" ? "team" : "personal"} ·{" "}
                      {board.readPolicy}/{board.writePolicy}
                    </span>
                  </span>
                  <button
                    style={linkBtn}
                    onClick={() => setMcpBoardId(board.roomId)}
                  >
                    MCP
                  </button>
                  {owned && (
                    <button
                      style={linkBtn}
                      onClick={() =>
                        setExpandedId(
                          expandedId === board.roomId ? null : board.roomId,
                        )
                      }
                    >
                      Access
                    </button>
                  )}
                </div>
                {owned && expandedId === board.roomId && (
                  <BoardSettings
                    board={board}
                    onSaved={() => {
                      setExpandedId(null);
                      setReloadKey((key) => key + 1);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {mcpBoardId !== null && (
        <McpConfigDialog
          boardId={mcpBoardId}
          onClose={() => setMcpBoardId(null)}
        />
      )}
    </div>
  );
};
