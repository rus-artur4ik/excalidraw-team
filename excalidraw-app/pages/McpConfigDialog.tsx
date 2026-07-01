import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import Spinner from "@excalidraw/excalidraw/components/Spinner";

import { useEffect, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { AppDialog } from "../components/AppDialog";
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
          ? t("app.mcp.copiedWhat", { what })
          : t("app.mcp.copyWhat", { what })
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

export const McpConfigDialog = ({ onClose }: { onClose: () => void }) => {
  const t = useAppT();
  const [tokens, setTokens] = useState<McpTokenSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const anyBusy = minting || revokingToken !== null;

  const refresh = () =>
    listMcpTokens()
      .then((list) => {
        setTokens(list);
        setLoadError(false);
      })
      .catch((error) => {
        console.error(error);
        setTokens([]);
        setLoadError(true);
      });

  useEffect(() => {
    void refresh();
  }, []);

  const mint = async () => {
    setMinting(true);
    setMintError(null);
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
      setMintError(t("app.mcp.mintError"));
    } finally {
      setMinting(false);
    }
  };

  const doRevoke = async (token: string) => {
    setRevokeTarget(null);
    setRevokingToken(token);
    try {
      await revokeMcpToken(token);
      await refresh();
    } catch (error) {
      console.error(error);
      setMintError(t("app.mcp.revokeError"));
    } finally {
      setRevokingToken(null);
    }
  };

  const active = (tokens ?? []).filter((token) => !token.revoked);

  return (
    <>
      <AppDialog
        title={t("app.mcp.title")}
        size="regular"
        closeOnBackdrop={!anyBusy}
        onClose={onClose}
      >
        <p className="exa-dialog-intro">{t("app.mcp.intro")}</p>

        {tokens === null ? (
          <div
            className="exa-row"
            style={{ gap: "0.5rem", padding: "0.5rem 0" }}
          >
            <Spinner />
            <span className="exa-loading-text" style={{ padding: 0 }}>
              {t("app.mcp.loading")}
            </span>
          </div>
        ) : loadError ? (
          <div className="exa-error" role="alert">
            <span>{t("app.mcp.loadError")}</span>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.common.retry")}
              onClick={refresh}
            />
          </div>
        ) : active.length === 0 ? (
          <p className="exa-empty">{t("app.mcp.empty")}</p>
        ) : (
          <div className="exa-people">
            {active.map((token) => (
              <div key={token.token} className="exa-person-row">
                <code className="exa-person-row__email">
                  {maskToken(token.token)}
                </code>
                <span className="exa-role-text">
                  {new Date(token.createdAt).toLocaleDateString()}
                </span>
                <FilledButton
                  variant="outlined"
                  color="danger"
                  label={t("app.mcp.revokeToken", {
                    token: maskToken(token.token),
                  })}
                  status={revokingToken === token.token ? "loading" : undefined}
                  disabled={anyBusy}
                  onClick={() => setRevokeTarget(token.token)}
                >
                  {t("app.mcp.revoke")}
                </FilledButton>
              </div>
            ))}
          </div>
        )}

        {snippet && (
          <>
            <p className="exa-note">{t("app.mcp.newToken")}</p>

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
              <span>{t("app.mcp.rawConfig")}</span>
              <CopyButton
                value={snippet.config}
                what={t("app.mcp.configWhat")}
              />
            </div>
            <pre className="exa-code">{snippet.config}</pre>
          </>
        )}

        {mintError && (
          <p className="exa-error-text" role="alert">
            {mintError}
          </p>
        )}

        <div className="exa-dialog-footer">
          <FilledButton
            variant="outlined"
            color="muted"
            label={t("app.common.close")}
            disabled={anyBusy}
            onClick={onClose}
          />
          <FilledButton
            label={t("app.mcp.create")}
            status={minting ? "loading" : undefined}
            disabled={anyBusy}
            onClick={mint}
          />
        </div>
      </AppDialog>

      {revokeTarget && (
        <AppConfirm
          title={t("app.mcp.revokeTitle")}
          message={t("app.mcp.revokeMessage")}
          confirmLabel={t("app.mcp.revoke")}
          danger
          onConfirm={() => doRevoke(revokeTarget)}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </>
  );
};
