import { useEffect, useState } from "react";

import { BusyButton, Spinner } from "../components/BusyButton";
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(true);
    setPendingKey(key);
    try {
      await fn();
      await reload();
    } catch (error) {
      console.error(error);
      window.alert("Operation failed");
    } finally {
      setBusy(false);
      setPendingKey(null);
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
        <BusyButton
          style={btn}
          busy={pendingKey === "add"}
          busyLabel="Adding…"
          disabled={busy || !email.trim()}
          onClick={() =>
            run("add", async () => {
              await setTeamMember(TEAM_ID, email.trim(), role);
              setEmail("");
            })
          }
        >
          Add
        </BusyButton>
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
                    run(`role:${member.email}`, () =>
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
                {pendingKey === `role:${member.email}` && <Spinner size={13} />}
                <BusyButton
                  style={linkBtn}
                  busy={pendingKey === `remove:${member.email}`}
                  busyLabel="Removing…"
                  disabled={busy}
                  onClick={() =>
                    run(`remove:${member.email}`, () =>
                      removeTeamMember(TEAM_ID, member.email),
                    )
                  }
                >
                  Remove
                </BusyButton>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
