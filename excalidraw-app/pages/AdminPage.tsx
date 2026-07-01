import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { AppHeader } from "../components/AppHeader";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import {
  createTeam,
  loadTeam,
  removeTeamMember,
  setTeamMember,
  teamRoleOf,
} from "../data/boards";
import { navigate } from "../router";

import type { Team, TeamRole } from "../data/boards";

export const AdminPage = () => {
  const t = useAppT();
  const { user, loading } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const roleChoices: { value: TeamRole; label: string; ariaLabel: string }[] = [
    {
      value: "admin",
      label: t("app.admin.roleAdmin"),
      ariaLabel: t("app.admin.roleAdmin"),
    },
    {
      value: "editor",
      label: t("app.admin.roleEditor"),
      ariaLabel: t("app.admin.roleEditor"),
    },
    {
      value: "viewer",
      label: t("app.admin.roleViewer"),
      ariaLabel: t("app.admin.roleViewer"),
    },
  ];

  const reload = async () => {
    setTeam(await loadTeam());
    setLoaded(true);
  };

  useEffect(() => {
    if (user) {
      reload().catch((err) => console.error(err));
    }
  }, [user]);

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
          <p className="exa-empty">{t("app.admin.signInPrompt")}</p>
          <FilledButton
            variant="outlined"
            label={t("app.common.backToBoards")}
            onClick={() => navigate("/")}
          />
        </div>
      </AppShell>
    );
  }

  if (!loaded) {
    return (
      <AppShell>
        <div className="exa-page">
          <p className="exa-loading-text">{t("app.admin.loadingTeam")}</p>
        </div>
      </AppShell>
    );
  }

  const isAdmin = !!team && teamRoleOf(team, user.email) === "admin";

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setPendingKey(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await reload();
      if (ok) {
        setNotice(ok);
      }
    } catch (err) {
      console.error(err);
      setError(t("app.common.genericError"));
    } finally {
      setBusy(false);
      setPendingKey(null);
    }
  };

  if (!team) {
    return (
      <AppShell>
        <AppHeader user={user} isAdmin={false} />
        <div className="exa-page exa-page--narrow">
          <div className="exa-page-head">
            <h1>{t("app.admin.team")}</h1>
          </div>
          <p className="exa-empty">{t("app.admin.noTeamText")}</p>
          <div className="exa-row">
            <TextField
              value={teamName}
              placeholder={t("app.admin.teamNamePlaceholder")}
              fullWidth
              onChange={setTeamName}
              onKeyDown={(event) => {
                if (event.key === "Enter" && teamName.trim()) {
                  void run("create", () =>
                    createTeam(teamName.trim()).then(() => {}),
                  );
                }
              }}
            />
            <FilledButton
              label={t("app.admin.createTeam")}
              status={pendingKey === "create" ? "loading" : undefined}
              disabled={busy || !teamName.trim()}
              onClick={() =>
                run("create", () => createTeam(teamName.trim()).then(() => {}))
              }
            />
          </div>
          {error && (
            <p className="exa-error-text" role="alert">
              {error}
            </p>
          )}
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <AppHeader user={user} isAdmin={false} />
        <div className="exa-page exa-page--narrow">
          <div className="exa-page-head">
            <h1>{team.name}</h1>
          </div>
          <p className="exa-empty">{t("app.admin.notAdmin")}</p>
        </div>
      </AppShell>
    );
  }

  const members: { email: string; role: TeamRole }[] = [
    ...team.admins.map((e) => ({ email: e, role: "admin" as TeamRole })),
    ...team.editorEmails.map((e) => ({ email: e, role: "editor" as TeamRole })),
    ...team.viewerEmails.map((e) => ({ email: e, role: "viewer" as TeamRole })),
  ];
  const adminCount = team.admins.length;

  return (
    <AppShell>
      <AppHeader user={user} isAdmin />
      <div className="exa-page exa-page--narrow">
        <div className="exa-page-head">
          <h1>{t("app.admin.accessTitle", { team: team.name })}</h1>
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.admin.addMember")}</span>
          <div className="exa-row">
            <TextField
              value={email}
              placeholder={t("app.settings.emailPlaceholder")}
              fullWidth
              onChange={setEmail}
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim()) {
                  void run(
                    "add",
                    async () => {
                      await setTeamMember(email.trim().toLowerCase(), role);
                      setEmail("");
                    },
                    t("app.admin.memberAdded"),
                  );
                }
              }}
            />
            <RadioGroup
              name="add-role"
              value={role}
              choices={roleChoices}
              onChange={setRole}
            />
            <FilledButton
              label={t("app.common.add")}
              status={pendingKey === "add" ? "loading" : undefined}
              disabled={busy || !email.trim()}
              onClick={() =>
                run(
                  "add",
                  async () => {
                    await setTeamMember(email.trim().toLowerCase(), role);
                    setEmail("");
                  },
                  t("app.admin.memberAdded"),
                )
              }
            />
          </div>
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.admin.members")}</span>
          <div className="exa-people">
            {members.map((member) => {
              const lastAdmin = member.role === "admin" && adminCount <= 1;
              return (
                <div key={member.email} className="exa-member-row">
                  <span className="exa-member-row__email">{member.email}</span>
                  {lastAdmin ? (
                    <span className="exa-role-text">
                      {t("app.admin.roleAdmin")}
                    </span>
                  ) : (
                    <RadioGroup
                      name={`role-${member.email}`}
                      value={member.role}
                      choices={roleChoices}
                      onChange={(next) =>
                        run(
                          `role:${member.email}`,
                          () => setTeamMember(member.email, next),
                          t("app.admin.roleUpdated"),
                        )
                      }
                    />
                  )}
                  {!lastAdmin && (
                    <FilledButton
                      variant="outlined"
                      color="danger"
                      label={t("app.admin.removeMember", {
                        email: member.email,
                      })}
                      status={
                        pendingKey === `remove:${member.email}`
                          ? "loading"
                          : undefined
                      }
                      disabled={busy}
                      onClick={() => setRemoveTarget(member.email)}
                    >
                      {t("app.common.delete")}
                    </FilledButton>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="exa-error-text" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="exa-success">{notice}</p>}
      </div>

      {removeTarget && (
        <AppConfirm
          title={t("app.admin.removeTitle")}
          message={t("app.admin.removeMessage", { email: removeTarget })}
          confirmLabel={t("app.common.delete")}
          danger
          onConfirm={() =>
            run(
              `remove:${removeTarget}`,
              () => removeTeamMember(removeTarget),
              t("app.admin.memberRemoved"),
            ).then(() => setRemoveTarget(null))
          }
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </AppShell>
  );
};
