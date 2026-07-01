import { TrashIcon } from "@excalidraw/excalidraw/components/icons";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import { useMemo, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { AppDialog } from "../components/AppDialog";
import {
  archiveBoard,
  deleteBoardForever,
  DEFAULT_BOT_POLICY,
  unarchiveBoard,
  updateBoardAccess,
} from "../data/boards";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";

import type { Board, BotPolicy, Visibility } from "../data/boards";

type PersonRole = "editor" | "viewer";
type Person = { email: string; role: PersonRole };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialVisibility = (board: Board): Visibility => {
  if (board.visibility) {
    return board.visibility;
  }
  if (board.teamId) {
    return "team";
  }
  if (board.readPolicy === "public") {
    return "link";
  }
  return "private";
};

const initialPeople = (board: Board): Person[] => [
  ...(board.editors ?? []).map((email) => ({ email, role: "editor" as const })),
  ...(board.viewers ?? []).map((email) => ({ email, role: "viewer" as const })),
];

const peopleKey = (people: Person[]): string =>
  people
    .map((person) => `${person.email}:${person.role}`)
    .sort()
    .join("|");

export const BoardSettingsDialog = ({
  board,
  onClose,
  onSaved,
  onDeleted,
}: {
  board: Board;
  onClose: () => void;
  onSaved: (updated: Board) => void;
  onDeleted?: () => void;
}) => {
  const t = useAppT();
  const roleChoices = [
    {
      value: "editor" as const,
      label: t("app.settings.roleEditor"),
      ariaLabel: t("app.settings.roleEditor"),
    },
    {
      value: "viewer" as const,
      label: t("app.settings.roleViewer"),
      ariaLabel: t("app.settings.roleViewer"),
    },
  ];

  const baseline = useMemo(
    () => ({
      title: board.title ?? "",
      visibility: initialVisibility(board),
      botPolicy: board.botPolicy ?? DEFAULT_BOT_POLICY,
      peopleKey: peopleKey(initialPeople(board)),
    }),
    [board],
  );

  const [title, setTitle] = useState(baseline.title);
  const [visibility, setVisibility] = useState<Visibility>(baseline.visibility);
  const [people, setPeople] = useState<Person[]>(initialPeople(board));
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(baseline.botPolicy);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<PersonRole>("editor");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const boardUrl = `${window.location.origin}/b/${board.roomId}`;

  const dirty =
    title.trim() !== baseline.title.trim() ||
    visibility !== baseline.visibility ||
    botPolicy !== baseline.botPolicy ||
    peopleKey(people) !== baseline.peopleKey;

  const requestClose = () => {
    if (busy) {
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const addPerson = () => {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setEmailError(t("app.settings.invalidEmail"));
      return;
    }
    setEmailError(null);
    setPeople((prev) => [
      ...prev.filter((person) => person.email !== email),
      { email, role: newRole },
    ]);
    setNewEmail("");
  };

  const setRole = (email: string, role: PersonRole) =>
    setPeople((prev) =>
      prev.map((person) =>
        person.email === email ? { ...person, role } : person,
      ),
    );

  const removePerson = (email: string) =>
    setPeople((prev) => prev.filter((person) => person.email !== email));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(boardUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error(error);
    }
  };

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    const cleanTitle = title.trim() || t("app.common.untitled");
    const editors = people
      .filter((p) => p.role === "editor")
      .map((p) => p.email);
    const viewers = people
      .filter((p) => p.role === "viewer")
      .map((p) => p.email);
    try {
      await updateBoardAccess(board.roomId, {
        title: cleanTitle,
        visibility,
        botPolicy,
        editors,
        viewers,
      });
      onSaved({
        ...board,
        title: cleanTitle,
        visibility,
        botPolicy,
        editors,
        viewers,
      });
    } catch (error) {
      console.error(error);
      setSaveError(t("app.settings.saveError"));
      setBusy(false);
    }
  };

  const archive = async () => {
    setConfirmArchive(false);
    setBusy(true);
    setSaveError(null);
    try {
      await archiveBoard(board.roomId);
      onSaved({ ...board, archived: true });
    } catch (error) {
      console.error(error);
      setSaveError(t("app.settings.archiveError"));
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      await unarchiveBoard(board.roomId);
      onSaved({ ...board, archived: false });
    } catch (error) {
      console.error(error);
      setSaveError(t("app.settings.restoreError"));
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    setSaveError(null);
    try {
      await deleteBoardForever(board.roomId);
      (onDeleted ?? onClose)();
    } catch (error) {
      console.error(error);
      setSaveError(t("app.settings.deleteError"));
      setBusy(false);
    }
  };

  const hintKey = VISIBILITY_OPTIONS.find(
    (o) => o.value === visibility,
  )?.hintKey;

  return (
    <>
      <AppDialog
        title={t("app.settings.title")}
        size="small"
        closeOnBackdrop={!busy}
        onClose={requestClose}
      >
        <div className="exa-section">
          <TextField
            label={t("app.settings.name")}
            value={title}
            placeholder={t("app.common.untitled")}
            onChange={setTitle}
          />
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.settings.visibility")}</span>
          <RadioGroup
            name="settings-visibility"
            value={visibility}
            choices={VISIBILITY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              ariaLabel: t(option.labelKey),
            }))}
            onChange={setVisibility}
          />
          {hintKey && <p className="exa-hint">{t(hintKey)}</p>}
        </div>

        {visibility === "link" && (
          <div className="exa-section">
            <span className="exa-label">{t("app.settings.viewLink")}</span>
            <div className="exa-row">
              <TextField
                value={boardUrl}
                readonly
                fullWidth
                onChange={() => {}}
              />
              <FilledButton
                variant="outlined"
                color="muted"
                label={copied ? t("app.common.copied") : t("app.common.copy")}
                onClick={copyLink}
              />
            </div>
          </div>
        )}

        <div className="exa-section">
          <span className="exa-label">{t("app.settings.peopleByEmail")}</span>
          {people.length === 0 ? (
            <p className="exa-hint">{t("app.settings.noPeople")}</p>
          ) : (
            <div className="exa-people">
              {people.map((person) => (
                <div key={person.email} className="exa-person-row">
                  <span className="exa-person-row__email">{person.email}</span>
                  <RadioGroup
                    name={`role-${person.email}`}
                    value={person.role}
                    choices={roleChoices}
                    onChange={(role) => setRole(person.email, role)}
                  />
                  <button
                    type="button"
                    className="exa-icon-btn"
                    style={{ color: "var(--color-danger)" }}
                    aria-label={t("app.settings.removeAccess", {
                      email: person.email,
                    })}
                    title={t("app.settings.removeAccessShort")}
                    onClick={() => removePerson(person.email)}
                  >
                    {TrashIcon}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="exa-row" style={{ marginTop: "0.5rem" }}>
            <TextField
              value={newEmail}
              placeholder={t("app.settings.emailPlaceholder")}
              fullWidth
              onChange={(value) => {
                setNewEmail(value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addPerson();
                }
              }}
            />
            <RadioGroup
              name="new-person-role"
              value={newRole}
              choices={roleChoices}
              onChange={setNewRole}
            />
            <FilledButton
              variant="outlined"
              label={t("app.common.add")}
              disabled={!newEmail.trim()}
              onClick={addPerson}
            />
          </div>
          {emailError && (
            <p className="exa-error-text" role="alert">
              {emailError}
            </p>
          )}
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.settings.botAccess")}</span>
          <RadioGroup
            name="settings-bot-policy"
            value={botPolicy}
            choices={BOT_POLICY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              ariaLabel: t(option.labelKey),
            }))}
            onChange={setBotPolicy}
          />
        </div>

        <div className="exa-section">
          <span className="exa-label">{t("app.settings.manageBoard")}</span>
          {board.archived ? (
            <>
              <p className="exa-hint">{t("app.settings.archivedHint")}</p>
              <FilledButton
                variant="outlined"
                label={t("app.settings.restore")}
                status={busy ? "loading" : undefined}
                onClick={restore}
              />
            </>
          ) : (
            <>
              <p className="exa-hint">{t("app.settings.archiveHint")}</p>
              <FilledButton
                variant="outlined"
                label={t("app.settings.archive")}
                disabled={busy}
                onClick={() => setConfirmArchive(true)}
              />
            </>
          )}
        </div>

        {board.archived && (
          <div className="exa-section exa-danger-zone">
            <span className="exa-label exa-danger-zone__title">
              {t("app.settings.dangerZone")}
            </span>
            <p className="exa-hint">{t("app.settings.deleteHint")}</p>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.settings.deleteForever")}
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        )}

        {saveError && (
          <p className="exa-error-text" role="alert">
            {saveError}
          </p>
        )}

        <div className="exa-dialog-footer">
          <FilledButton
            variant="outlined"
            color="muted"
            label={t("app.common.cancel")}
            disabled={busy}
            onClick={requestClose}
          />
          <FilledButton label={t("app.common.save")} onClick={save} />
        </div>
      </AppDialog>

      {confirmDiscard && (
        <AppConfirm
          title={t("app.settings.discardTitle")}
          message={t("app.settings.discardMessage")}
          confirmLabel={t("app.settings.discardConfirm")}
          cancelLabel={t("app.settings.discardCancel")}
          danger
          onConfirm={onClose}
          onClose={() => setConfirmDiscard(false)}
        />
      )}

      {confirmArchive && (
        <AppConfirm
          title={t("app.settings.archiveTitle")}
          message={t("app.settings.archiveMessage")}
          confirmLabel={t("app.settings.archive")}
          danger
          onConfirm={archive}
          onClose={() => setConfirmArchive(false)}
        />
      )}

      {confirmDelete && (
        <AppConfirm
          title={t("app.settings.deleteTitle")}
          message={t("app.settings.deleteMessage", {
            title: board.title || t("app.common.untitled"),
          })}
          confirmLabel={t("app.settings.deleteForever")}
          danger
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
};
