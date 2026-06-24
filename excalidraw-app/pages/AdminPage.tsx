import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { loadTeam, removeTeamMember, setTeamMember } from "../data/boards";
import { navigate } from "../router";

import {
  btn,
  card,
  headerStyle,
  input,
  linkBtn,
  pageStyle,
} from "./pageStyles";

import type { Team, TeamRole } from "../data/boards";

const TEAM_ID = "chats-team";

export const AdminPage = () => {
  const { user, loading } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [busy, setBusy] = useState(false);

  const reload = async () => setTeam(await loadTeam(TEAM_ID));

  useEffect(() => {
    if (user) {
      reload().catch((error) => console.error(error));
    }
  }, [user]);

  if (loading) {
    return <div style={pageStyle}>Loading…</div>;
  }
  if (!user) {
    return (
      <div style={pageStyle}>
        <p>Please sign in.</p>
        <button style={linkBtn} onClick={() => navigate("/")}>
          Home
        </button>
      </div>
    );
  }
  if (!team) {
    return <div style={pageStyle}>Loading team…</div>;
  }

  const isAdmin = !!user.email && team.admins.includes(user.email);
  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <p>You are not an admin of this team.</p>
        <button style={linkBtn} onClick={() => navigate("/")}>
          Home
        </button>
      </div>
    );
  }

  const members = [
    ...team.editorEmails.map((e) => ({ email: e, role: "editor" as TeamRole })),
    ...team.viewerEmails.map((e) => ({ email: e, role: "viewer" as TeamRole })),
  ];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (error) {
      console.error(error);
      window.alert("Operation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1>{team.name} — access</h1>
        <button style={linkBtn} onClick={() => navigate("/")}>
          Home
        </button>
      </header>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          style={input}
          placeholder="email@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as TeamRole)}
        >
          <option value="editor">read-write</option>
          <option value="viewer">read-only</option>
        </select>
        <button
          style={btn}
          disabled={busy || !email.trim()}
          onClick={() =>
            run(async () => {
              await setTeamMember(TEAM_ID, email.trim(), role);
              setEmail("");
            })
          }
        >
          Add
        </button>
      </div>

      <h3>Admins</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {team.admins.map((adminEmail) => (
          <li key={adminEmail} style={card}>
            <span>{adminEmail}</span>
            <span style={{ color: "#888" }}>admin</span>
          </li>
        ))}
      </ul>

      <h3>Members</h3>
      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {members.map((member) => (
            <li key={member.email} style={card}>
              <span>{member.email}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={member.role}
                  disabled={busy}
                  onChange={(event) =>
                    run(() =>
                      setTeamMember(
                        TEAM_ID,
                        member.email,
                        event.target.value as TeamRole,
                      ),
                    )
                  }
                >
                  <option value="editor">read-write</option>
                  <option value="viewer">read-only</option>
                </select>
                <button
                  style={linkBtn}
                  disabled={busy}
                  onClick={() =>
                    run(() => removeTeamMember(TEAM_ID, member.email))
                  }
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
