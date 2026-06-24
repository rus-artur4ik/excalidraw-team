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
  width: "min(620px, 92vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.35)",
};

const pre: CSSProperties = {
  margin: 0,
  background: "#0f1117",
  color: "#e6e6e6",
  borderRadius: 8,
  padding: "10px 12px",
  fontFamily: "monospace",
  fontSize: 12.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  boxSizing: "border-box",
};

const blockHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "14px 0 6px",
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

type Snippet = { token: string; mcpUrl: string; serverName: string; config: string };

const buildCommands = (s: Snippet): { label: string; command: string }[] => {
  const auth = `Authorization: Bearer ${s.token}`;
  return [
    {
      label: "Claude Code",
      command: `claude mcp add --transport http ${s.serverName} ${s.mcpUrl} --header "${auth}"`,
    },
    {
      label: "Codex CLI",
      command: `mkdir -p ~/.codex && cat >> ~/.codex/config.toml <<'EOF'

[mcp_servers.${s.serverName.replace(/-/g, "_")}]
url = "${s.mcpUrl}"
http_headers = { Authorization = "Bearer ${s.token}" }
EOF`,
    },
    {
      label: "Gemini CLI",
      command: `gemini mcp add --transport http ${s.serverName} ${s.mcpUrl} --header "${auth}"`,
    },
    {
      label: "VS Code",
      command: `code --add-mcp '{"name":"${s.serverName}","type":"http","url":"${s.mcpUrl}","headers":{"Authorization":"Bearer ${s.token}"}}'`,
    },
  ];
};

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      style={linkBtn}
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
};

export const McpConfigDialog = ({ onClose }: { onClose: () => void }) => {
  const [tokens, setTokens] = useState<McpTokenSummary[] | null>(null);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    listMcpTokens()
      .then(setTokens)
      .catch((error) => {
        console.error(error);
        setTokens([]);
      });

  useEffect(() => {
    void refresh();
  }, []);

  const mint = async () => {
    setBusy(true);
    try {
      const { token, mcpUrl, serverName, configSnippet } = await mintMcpToken();
      setSnippet({
        token,
        mcpUrl,
        serverName,
        config: JSON.stringify(configSnippet, null, 2),
      });
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

  const active = (tokens ?? []).filter((t) => !t.revoked);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Connect an AI agent (MCP)</h3>
        <p style={{ color: "#666", marginTop: 0 }}>
          A token lets an MCP client (Claude Code, Codex, etc.) act on every
          board you can access, subject to each board's bot permission. Revoke
          any token you no longer use.
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
            <p style={{ margin: "16px 0 0", fontWeight: 600 }}>
              New token created — it won't be shown again. Paste into your agent:
            </p>

            {buildCommands(snippet).map(({ label, command }) => (
              <div key={label}>
                <div style={blockHeader}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <CopyButton value={command} />
                </div>
                <pre style={pre}>{command}</pre>
              </div>
            ))}

            <div style={blockHeader}>
              <strong style={{ fontSize: 13 }}>
                Raw config (Cursor, Windsurf, Claude Desktop, …)
              </strong>
              <CopyButton value={snippet.config} />
            </div>
            <pre style={pre}>{snippet.config}</pre>
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button style={linkBtn} onClick={onClose}>
            Close
          </button>
          <button style={btn} disabled={busy} onClick={mint}>
            Generate new token
          </button>
        </div>
      </div>
    </div>
  );
};
