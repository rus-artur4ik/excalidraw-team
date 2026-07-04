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

export const BotConnectPanel = ({ botId }: { botId: string }) => {
  const t = useAppT();
  const [tokens, setTokens] = useState<McpTokenSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [minting, setMinting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<McpTokenSummary | null>(
    null,
  );
  const anyBusy = minting || revokingToken !== null;

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
    try {
      const { token, mcpUrl, serverName, configSnippet } = await mintMcpToken(
        botId,
        tokenName.trim() || undefined,
      );
      setSnippet({
        token,
        mcpUrl,
        serverName,
        config: JSON.stringify(configSnippet, null, 2),
      });
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
        <div className="exa-people">
          {active.map((token) => (
            <div key={token.token} className="exa-person-row">
              <span className="exa-person-row__email">{tokenLabel(token)}</span>
              <span className="exa-role-text">
                {token.lastUsedAt
                  ? t("app.bots.lastUsed", {
                      when: new Date(token.lastUsedAt).toLocaleDateString(),
                    })
                  : t("app.bots.neverUsed")}
              </span>
              <span className="exa-role-text">
                {new Date(token.createdAt).toLocaleDateString()}
              </span>
              <FilledButton
                variant="outlined"
                color="danger"
                label={t("app.bots.revokeToken", { token: tokenLabel(token) })}
                status={revokingToken === token.token ? "loading" : undefined}
                disabled={anyBusy}
                onClick={() => setRevokeTarget(token)}
              >
                {t("app.bots.revoke")}
              </FilledButton>
            </div>
          ))}
        </div>
      )}

      {snippet && (
        <>
          <p className="exa-note">{t("app.bots.newToken")}</p>

          {buildCommands(snippet).map(({ label, command }) => (
            <div key={label}>
              <div className="exa-code-head">
                <span>{label}</span>
                <CopyButton value={command} what={label} />
              </div>
              <pre className="exa-code">{command}</pre>
            </div>
          ))}

          <div className="exa-code-head">
            <span>{t("app.bots.rawConfig")}</span>
            <CopyButton
              value={snippet.config}
              what={t("app.bots.configWhat")}
            />
          </div>
          <pre className="exa-code">{snippet.config}</pre>
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
