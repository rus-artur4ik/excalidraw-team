import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import Spinner from "@excalidraw/excalidraw/components/Spinner";

import { useCallback, useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { listMcpTokens, mintMcpToken, revokeMcpToken } from "../data/mcpTokens";

import type { McpTokenSummary } from "../data/mcpTokens";

const maskToken = (token: string) => `${token.slice(0, 8)}…${token.slice(-4)}`;

type Snippet = {
  token: string;
  mcpUrl: string;
  serverName: string;
  config: string;
};

type AgentId = "claude" | "codex" | "gemini" | "vscode" | "config";

const AGENTS: { id: AgentId; label: string; projectScope: boolean }[] = [
  { id: "claude", label: "Claude Code", projectScope: true },
  { id: "codex", label: "Codex CLI", projectScope: false },
  { id: "gemini", label: "Gemini CLI", projectScope: true },
  { id: "vscode", label: "VS Code", projectScope: true },
  { id: "config", label: "Config file (JSON)", projectScope: false },
];

const buildCommand = (
  s: Snippet,
  agent: AgentId,
  projectScope: boolean,
): string => {
  const auth = `Authorization: Bearer ${s.token}`;
  switch (agent) {
    case "claude":
      return `claude mcp add --scope ${
        projectScope ? "local" : "user"
      } --transport http ${s.serverName} ${s.mcpUrl} --header "${auth}"`;
    case "gemini":
      return `gemini mcp add --scope ${
        projectScope ? "project" : "user"
      } --transport http ${s.serverName} ${s.mcpUrl} --header "${auth}"`;
    case "vscode":
      return projectScope
        ? `mkdir -p .vscode && cat > .vscode/mcp.json <<'EOF'
{
  "servers": {
    "${s.serverName}": {
      "type": "http",
      "url": "${s.mcpUrl}",
      "headers": { "Authorization": "Bearer ${s.token}" }
    }
  }
}
EOF`
        : `code --add-mcp '{"name":"${s.serverName}","type":"http","url":"${s.mcpUrl}","headers":{"Authorization":"Bearer ${s.token}"}}'`;
    case "codex":
      return `mkdir -p ~/.codex && cat >> ~/.codex/config.toml <<'EOF'

[mcp_servers.${s.serverName.replace(/-/g, "_")}]
url = "${s.mcpUrl}"
http_headers = { Authorization = "Bearer ${s.token}" }
EOF`;
    case "config":
      return s.config;
  }
};

const CopyButton = ({ value, what }: { value: string; what: string }) => {
  const t = useAppT();
  const [copied, setCopied] = useState(false);
  return (
    <FilledButton
      variant="outlined"
      color="muted"
      label={
        copied
          ? t("app.bots.copiedWhat", { what })
          : t("app.bots.copyWhat", { what })
      }
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch((error) => console.error(error));
      }}
    >
      {copied ? t("app.common.copied") : t("app.common.copy")}
    </FilledButton>
  );
};

const tokenLabel = (token: McpTokenSummary) =>
  token.name?.trim() || maskToken(token.token);

const formatDate = (value: number) => new Date(value).toLocaleDateString();

export const BotConnectPanel = ({ botId }: { botId: string }) => {
  const t = useAppT();
  const [tokens, setTokens] = useState<McpTokenSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [agent, setAgent] = useState<AgentId>("claude");
  const [projectScope, setProjectScope] = useState(false);
  const [minting, setMinting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<McpTokenSummary | null>(
    null,
  );
  const anyBusy = minting || revokingToken !== null;
  const selectedAgent = AGENTS.find((a) => a.id === agent) ?? AGENTS[0];
  const scopeEnabled = selectedAgent.projectScope;

  const refresh = useCallback(
    () =>
      listMcpTokens(botId)
        .then((list) => {
          setTokens(list);
          setLoadError(false);
        })
        .catch((error) => {
          console.error(error);
          setTokens([]);
          setLoadError(true);
        }),
    [botId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mint = async () => {
    setMinting(true);
    setActionError(null);
    const name = tokenName.trim() || undefined;
    try {
      const { token, mcpUrl, serverName, configSnippet } = await mintMcpToken(
        botId,
        name,
      );
      setSnippet({
        token,
        mcpUrl,
        serverName,
        config: JSON.stringify(configSnippet, null, 2),
      });
      setTokens((prev) => [
        ...(prev ?? []),
        {
          token,
          name,
          createdAt: Date.now(),
          revoked: false,
          lastUsedAt: null,
        },
      ]);
      setTokenName("");
      await refresh();
    } catch (error) {
      console.error(error);
      setActionError(t("app.bots.mintError"));
    } finally {
      setMinting(false);
    }
  };

  const doRevoke = async (token: string) => {
    setRevokeTarget(null);
    setRevokingToken(token);
    try {
      await revokeMcpToken(token);
      setSnippet((current) => (current?.token === token ? null : current));
      await refresh();
    } catch (error) {
      console.error(error);
      setActionError(t("app.bots.revokeError"));
    } finally {
      setRevokingToken(null);
    }
  };

  const active = (tokens ?? []).filter((token) => !token.revoked);

  return (
    <div className="exa-section">
      <span className="exa-label">{t("app.bots.connectTitle")}</span>
      <p className="exa-hint">{t("app.bots.connectIntro")}</p>

      <div className="exa-row" style={{ marginTop: "0.5rem" }}>
        <TextField
          value={tokenName}
          placeholder={t("app.bots.tokenNamePlaceholder")}
          fullWidth
          onChange={setTokenName}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !anyBusy) {
              void mint();
            }
          }}
        />
        <FilledButton
          label={t("app.bots.createToken")}
          status={minting ? "loading" : undefined}
          disabled={anyBusy}
          onClick={mint}
        />
      </div>

      {tokens === null ? (
        <div className="exa-row" style={{ gap: "0.5rem", padding: "0.5rem 0" }}>
          <Spinner />
          <span className="exa-loading-text" style={{ padding: 0 }}>
            {t("app.bots.tokensLoading")}
          </span>
        </div>
      ) : loadError ? (
        <div className="exa-error" role="alert">
          <span>{t("app.bots.tokensLoadError")}</span>
          <FilledButton
            variant="outlined"
            color="danger"
            label={t("app.common.retry")}
            onClick={refresh}
          />
        </div>
      ) : active.length === 0 ? (
        <p className="exa-empty">{t("app.bots.noTokens")}</p>
      ) : (
        <div className="exa-token-list">
          {active.map((token) => (
            <div key={token.token} className="exa-token-card">
              <div className="exa-token-card__head">
                <span className="exa-token-card__name">
                  {tokenLabel(token)}
                </span>
                <FilledButton
                  variant="outlined"
                  color="danger"
                  label={t("app.bots.revokeToken", {
                    token: tokenLabel(token),
                  })}
                  status={revokingToken === token.token ? "loading" : undefined}
                  disabled={anyBusy}
                  onClick={() => setRevokeTarget(token)}
                >
                  {t("app.bots.revoke")}
                </FilledButton>
              </div>
              <dl className="exa-token-card__meta">
                <div className="exa-token-meta">
                  <dt>{t("app.bots.createdLabel")}</dt>
                  <dd>{formatDate(token.createdAt)}</dd>
                </div>
                <div className="exa-token-meta">
                  <dt>{t("app.bots.lastUsedLabel")}</dt>
                  <dd>
                    {token.lastUsedAt
                      ? formatDate(token.lastUsedAt)
                      : t("app.bots.neverUsed")}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {snippet && (
        <>
          <p className="exa-note">{t("app.bots.newToken")}</p>

          <div className="exa-connect-controls">
            <label className="exa-field">
              <span className="exa-field__label">{t("app.bots.agent")}</span>
              <select
                className="exa-select"
                value={agent}
                onChange={(event) => setAgent(event.target.value as AgentId)}
              >
                {AGENTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="exa-scope-check" aria-disabled={!scopeEnabled}>
              <input
                type="checkbox"
                checked={scopeEnabled && projectScope}
                disabled={!scopeEnabled}
                onChange={(event) => setProjectScope(event.target.checked)}
              />
              <span>{t("app.bots.scopeProjectOnly")}</span>
            </label>
          </div>

          <div className="exa-code-head">
            <span>{selectedAgent.label}</span>
            <CopyButton
              value={buildCommand(snippet, agent, scopeEnabled && projectScope)}
              what={selectedAgent.label}
            />
          </div>
          <pre className="exa-code">
            {buildCommand(snippet, agent, scopeEnabled && projectScope)}
          </pre>
        </>
      )}

      {actionError && (
        <p className="exa-error-text" role="alert">
          {actionError}
        </p>
      )}

      {revokeTarget && (
        <AppConfirm
          title={t("app.bots.revokeTitle")}
          message={t("app.bots.revokeMessage")}
          confirmLabel={t("app.bots.revoke")}
          danger
          onConfirm={() => doRevoke(revokeTarget.token)}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
};
