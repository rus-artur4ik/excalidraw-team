import { useState } from "react";

import { BusyButton } from "../components/BusyButton";
import { DEFAULT_BOT_POLICY, createBoard } from "../data/boards";
import { navigate } from "../router";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";
import {
  btn,
  input,
  linkBtn,
  modal,
  modalOverlay,
  sectionLabel,
  segmentButton,
  segmentRow,
} from "./pageStyles";

import type { BotPolicy, Visibility } from "../data/boards";

export const CreateBoardDialog = ({
  allowTeam,
  onClose,
}: {
  allowTeam: boolean;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(DEFAULT_BOT_POLICY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = VISIBILITY_OPTIONS.filter(
    (option) => option.value !== "team" || allowTeam,
  );

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await createBoard({
        title: title.trim() || "Untitled board",
        visibility,
        botPolicy,
      });
      navigate(`/b/${roomId}`);
    } catch (err) {
      console.error(err);
      setError("Не удалось создать доску. Попробуйте ещё раз.");
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Новая доска</h2>
          <button type="button" style={linkBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div style={sectionLabel}>Название</div>
        <input
          style={{ ...input, width: "100%", boxSizing: "border-box" }}
          autoFocus
          placeholder="Без названия"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void create();
            }
          }}
        />

        <div style={sectionLabel}>Доступ</div>
        <div style={segmentRow}>
          {options.map((option) => (
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
          {options.find((o) => o.value === visibility)?.hint}
        </p>

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

        {error && (
          <p style={{ color: "#c0392b", fontSize: 13, margin: "12px 2px 0" }}>
            {error}
          </p>
        )}

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
            busyLabel="Создание…"
            onClick={() => void create()}
          >
            Создать
          </BusyButton>
        </div>
      </div>
    </div>
  );
};
