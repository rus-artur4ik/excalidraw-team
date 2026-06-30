import { useState } from "react";

import { BusyButton } from "../components/BusyButton";
import { DEFAULT_BOT_POLICY, updateBoardAccess } from "../data/boards";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";
import {
  btn,
  iconBtn,
  input,
  linkBtn,
  modal,
  modalOverlay,
  personRow,
  sectionLabel,
  segmentButton,
  segmentRow,
} from "./pageStyles";

import type { Board, BotPolicy, Visibility } from "../data/boards";

type PersonRole = "editor" | "viewer";
type Person = { email: string; role: PersonRole };

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

export const BoardSettingsDialog = ({
  board,
  onClose,
  onSaved,
}: {
  board: Board;
  onClose: () => void;
  onSaved: (updated: Board) => void;
}) => {
  const [title, setTitle] = useState(board.title ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    initialVisibility(board),
  );
  const [people, setPeople] = useState<Person[]>(initialPeople(board));
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(
    board.botPolicy ?? DEFAULT_BOT_POLICY,
  );
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<PersonRole>("editor");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const boardUrl = `${window.location.origin}/b/${board.roomId}`;

  const addPerson = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      return;
    }
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
    const cleanTitle = title.trim() || "Untitled board";
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
      window.alert("Не удалось сохранить настройки доски");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Настройки доски</h2>
          <button type="button" style={linkBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div style={sectionLabel}>Название</div>
        <input
          style={{ ...input, width: "100%", boxSizing: "border-box" }}
          placeholder="Без названия"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div style={sectionLabel}>Видимость</div>
        <div style={segmentRow}>
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              style={segmentButton(visibility === option.value)}
              onClick={() => setVisibility(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p style={{ color: "#888", fontSize: 12, margin: "6px 2px 0" }}>
          {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
        </p>

        {visibility === "link" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input style={input} readOnly value={boardUrl} />
            <button type="button" style={btn} onClick={() => void copyLink()}>
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        )}

        <div style={sectionLabel}>Доступ по email</div>
        {people.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: "2px 2px" }}>
            Пока никто не приглашён.
          </p>
        ) : (
          people.map((person) => (
            <div key={person.email} style={personRow}>
              <span style={{ flex: 1, fontSize: 14 }}>{person.email}</span>
              <select
                value={person.role}
                onChange={(event) =>
                  setRole(person.email, event.target.value as PersonRole)
                }
              >
                <option value="editor">редактор</option>
                <option value="viewer">зритель</option>
              </select>
              <button
                type="button"
                style={iconBtn}
                onClick={() => removePerson(person.email)}
              >
                удалить
              </button>
            </div>
          ))
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            style={input}
            placeholder="email@example.com"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addPerson()}
          />
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as PersonRole)}
          >
            <option value="editor">редактор</option>
            <option value="viewer">зритель</option>
          </select>
          <button
            type="button"
            style={btn}
            disabled={!newEmail.trim()}
            onClick={addPerson}
          >
            Добавить
          </button>
        </div>

        <div style={sectionLabel}>MCP-боты</div>
        <select
          value={botPolicy}
          onChange={(event) => setBotPolicy(event.target.value as BotPolicy)}
        >
          {BOT_POLICY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 20,
          }}
        >
          <button type="button" style={linkBtn} onClick={onClose}>
            Отмена
          </button>
          <BusyButton
            type="button"
            style={btn}
            busy={busy}
            busyLabel="Сохранение…"
            onClick={() => void save()}
          >
            Сохранить
          </BusyButton>
        </div>
      </div>
    </div>
  );
};
