import { useEffect, useState } from "react";

import { listMcpTokens, mintMcpToken, revokeMcpToken } from "../data/mcpTokens";

import { btn, linkBtn } from "./pageStyles";

import type { McpTokenSummary } from "../data/mcpTokens";
import type { CSSProperties } from "react";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: CSSProperties = {
  background: "#fff",
  color: "#1b1b1f",
  borderRadius: 12,
  padding: 20,
  width: "min(560px, 92vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.35)",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 160,
  fontFamily: "monospace",
  fontSize: 13,
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 10,
  boxSizing: "border-box",
  resize: "vertical",
};

const tokenRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
  borderTop: "1px solid #eee",
  fontSize: 13,
};

const maskToken = (token: string) => `${token.slice(0, 8)}…${token.slice(-4)}`;

export const McpConfigDialog = ({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) => {
  const [tokens, setTokens] = useState<McpTokenSummary[] | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = () =>
    listMcpTokens(boardId)
      .then(setTokens)
      .catch((error) => {
        console.error(error);
        setTokens([]);
      });

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const mint = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const { configSnippet } = await mintMcpToken(boardId);
      setSnippet(JSON.stringify(configSnippet, null, 2));
      await refresh();
    } catch (error) {
      console.error(error);
      window.alert("Failed to generate MCP token");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: string) => {
    setBusy(true);
    try {
      await revokeMcpToken(token);
      await refresh();
    } catch (error) {
      console.error(error);
      window.alert("Failed to revoke MCP token");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (snippet) {
      navigator.clipboard
        ?.writeText(snippet)
        .then(() => setCopied(true))
        .catch(() => {});
    }
  };

  const active = (tokens ?? []).filter((t) => !t.revoked);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>MCP access tokens</h3>
        <p style={{ color: "#666", marginTop: 0 }}>
          Tokens let an MCP client (Claude Desktop/Code, etc.) act on this board
          with your access. Revoke any you no longer use.
        </p>

        {tokens === null ? (
          <p>Loading…</p>
        ) : active.length === 0 ? (
          <p style={{ color: "#888" }}>No active tokens.</p>
        ) : (
          <div>
            {active.map((t) => (
              <div key={t.token} style={tokenRow}>
                <code style={{ flex: 1 }}>{maskToken(t.token)}</code>
                <span style={{ color: "#888" }}>{t.role}</span>
                <span style={{ color: "#aaa" }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
                <button
                  style={linkBtn}
                  disabled={busy}
                  onClick={() => revoke(t.token)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {snippet && (
          <>
            <p style={{ marginBottom: 4 }}>
              New token created. Copy this config — it won't be shown again:
            </p>
            <textarea
              style={textarea}
              readOnly
              value={snippet}
              onFocus={(event) => event.target.select()}
            />
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button style={linkBtn} onClick={onClose}>
            Close
          </button>
          {snippet && (
            <button style={linkBtn} onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
          <button style={btn} disabled={busy} onClick={mint}>
            Generate new token
          </button>
        </div>
      </div>
    </div>
  );
};
