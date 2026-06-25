import { useState } from "react";

import { BusyButton } from "../components/BusyButton";
import { DEFAULT_BOT_POLICY, updateBoardPolicy } from "../data/boards";

import { btn, input } from "./pageStyles";

import type { Board, BotPolicy, ReadPolicy, WritePolicy } from "../data/boards";

export const BoardSettings = ({
  board,
  onSaved,
}: {
  board: Board;
  onSaved: () => void;
}) => {
  const [readPolicy, setReadPolicy] = useState<ReadPolicy>(board.readPolicy);
  const [writePolicy, setWritePolicy] = useState<WritePolicy>(
    board.writePolicy,
  );
  const [editors, setEditors] = useState((board.editors ?? []).join(", "));
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(
    board.botPolicy ?? DEFAULT_BOT_POLICY,
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateBoardPolicy(board.roomId, {
        readPolicy,
        writePolicy,
        botPolicy,
        editors: editors
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      onSaved();
    } catch (error) {
      console.error(error);
      window.alert("Failed to save board access");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        padding: "12px 16px",
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        marginBottom: 8,
        background: "#fafafa",
      }}
    >
      <label>
        Read:{" "}
        <select
          value={readPolicy}
          onChange={(event) => setReadPolicy(event.target.value as ReadPolicy)}
        >
          <option value="public">public</option>
          <option value="members">members</option>
        </select>
      </label>
      <label>
        Write:{" "}
        <select
          value={writePolicy}
          onChange={(event) =>
            setWritePolicy(event.target.value as WritePolicy)
          }
        >
          <option value="everyone">everyone</option>
          <option value="whitelist">whitelist</option>
          <option value="owner">owner only</option>
        </select>
      </label>
      <label title="What MCP bots may do on this board">
        Bots:{" "}
        <select
          value={botPolicy}
          onChange={(event) => setBotPolicy(event.target.value as BotPolicy)}
        >
          <option value="none">no access</option>
          <option value="read">read-only</option>
          <option value="write">read-write</option>
        </select>
      </label>
      <input
        style={{ ...input, flex: "1 1 240px" }}
        placeholder="editor emails (comma-separated)"
        value={editors}
        onChange={(event) => setEditors(event.target.value)}
      />
      <BusyButton style={btn} busy={busy} busyLabel="Saving…" onClick={save}>
        Save
      </BusyButton>
    </div>
  );
};
