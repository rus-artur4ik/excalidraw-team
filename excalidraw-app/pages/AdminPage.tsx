import { useEffect, useState } from "react";

import { BusyButton, Spinner } from "../components/BusyButton";
import { useAuth } from "../auth/AuthContext";
import {
  createTeam,
  loadTeam,
  removeTeamMember,
  setTeamMember,
  teamRoleOf,
} from "../data/boards";
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

const ROLE_LABEL: Record<TeamRole, string> = {
  admin: "админ",
  editor: "редактор",
  viewer: "зритель",
};

export const AdminPage = () => {
  const { user, loading } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const reload = async () => {
    setTeam(await loadTeam());
    setLoaded(true);
  };

  useEffect(() => {
    if (user) {
      reload().catch((error) => console.error(error));
    }
  }, [user]);

  if (loading) {
    return <div style={pageStyle}>Загрузка…</div>;
  }
  if (!user) {
    return (
      <div style={pageStyle}>
        <p>Войдите, пожалуйста.</p>
        <button style={linkBtn} onClick={() => navigate("/")}>
          На главную
        </button>
      </div>
    );
  }
  if (!loaded) {
    return <div style={pageStyle}>Загрузка команды…</div>;
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(true);
    setPendingKey(key);
    try {
      await fn();
      await reload();
    } catch (error) {
      console.error(error);
      window.alert("Операция не удалась");
    } finally {
      setBusy(false);
      setPendingKey(null);
    }
  };

  if (!team) {
    return (
      <div style={pageStyle}>
        <header style={headerStyle}>
          <h1>Команда</h1>
          <button style={linkBtn} onClick={() => navigate("/")}>
            На главную
          </button>
        </header>
        <p style={{ color: "#555" }}>
          Команда ещё не создана. Создайте её — вы станете администратором и
          сможете добавлять участников.
        </p>
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          <input
            style={input}
            placeholder="Название команды"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
          />
          <BusyButton
            style={btn}
            busy={pendingKey === "create"}
            busyLabel="Создание…"
            disabled={busy || !teamName.trim()}
            onClick={() =>
              run("create", async () => {
                await createTeam(teamName.trim());
              })
            }
          >
            Создать команду
          </BusyButton>
        </div>
      </div>
    );
  }

  const isAdmin = teamRoleOf(team, user.email) === "admin";
  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <header style={headerStyle}>
          <h1>{team.name}</h1>
          <button style={linkBtn} onClick={() => navigate("/")}>
            На главную
          </button>
        </header>
        <p>Вы участник этой команды, но не администратор.</p>
      </div>
    );
  }

  const members: { email: string; role: TeamRole }[] = [
    ...team.admins.map((e) => ({ email: e, role: "admin" as TeamRole })),
    ...team.editorEmails.map((e) => ({ email: e, role: "editor" as TeamRole })),
    ...team.viewerEmails.map((e) => ({ email: e, role: "viewer" as TeamRole })),
  ];
  const adminCount = team.admins.length;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1>{team.name} — доступ</h1>
        <button style={linkBtn} onClick={() => navigate("/")}>
          На главную
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
          <option value="admin">админ</option>
          <option value="editor">редактор</option>
          <option value="viewer">зритель</option>
        </select>
        <BusyButton
          style={btn}
          busy={pendingKey === "add"}
          busyLabel="Добавление…"
          disabled={busy || !email.trim()}
          onClick={() =>
            run("add", async () => {
              await setTeamMember(email.trim().toLowerCase(), role);
              setEmail("");
            })
          }
        >
          Добавить
        </BusyButton>
      </div>

      <h3>Участники</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {members.map((member) => {
          const lastAdmin = member.role === "admin" && adminCount <= 1;
          return (
            <li key={member.email} style={card}>
              <span>{member.email}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {lastAdmin ? (
                  <span style={{ color: "#888" }}>{ROLE_LABEL.admin}</span>
                ) : (
                  <select
                    value={member.role}
                    disabled={busy}
                    onChange={(event) =>
                      run(`role:${member.email}`, () =>
                        setTeamMember(
                          member.email,
                          event.target.value as TeamRole,
                        ),
                      )
                    }
                  >
                    <option value="admin">админ</option>
                    <option value="editor">редактор</option>
                    <option value="viewer">зритель</option>
                  </select>
                )}
                {pendingKey === `role:${member.email}` && <Spinner size={13} />}
                {!lastAdmin && (
                  <BusyButton
                    style={linkBtn}
                    busy={pendingKey === `remove:${member.email}`}
                    busyLabel="Удаление…"
                    disabled={busy}
                    onClick={() =>
                      run(`remove:${member.email}`, () =>
                        removeTeamMember(member.email),
                      )
                    }
                  >
                    Удалить
                  </BusyButton>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
