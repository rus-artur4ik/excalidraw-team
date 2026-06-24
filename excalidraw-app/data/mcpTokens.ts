import { getCurrentUserIdToken } from "./firebase";

const ACCESS_BACKEND_URL = import.meta.env.VITE_APP_ACCESS_BACKEND_URL;

export type MintedMcpToken = {
  token: string;
  mcpUrl: string;
  serverName: string;
  configSnippet: Record<string, unknown>;
};

export type McpTokenSummary = {
  token: string;
  createdAt: number;
  revoked: boolean;
};

const authHeader = async (): Promise<{ Authorization: string }> => {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error("Sign in required to manage MCP tokens");
  }
  return { Authorization: `Bearer ${idToken}` };
};

export const mintMcpToken = async (): Promise<MintedMcpToken> => {
  const response = await fetch(`${ACCESS_BACKEND_URL}/mcp/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(`Failed to mint MCP token: ${response.status}`);
  }
  return response.json();
};

export const listMcpTokens = async (): Promise<McpTokenSummary[]> => {
  const response = await fetch(`${ACCESS_BACKEND_URL}/mcp/tokens`, {
    headers: await authHeader(),
  });
  if (!response.ok) {
    throw new Error(`Failed to list MCP tokens: ${response.status}`);
  }
  const { tokens } = (await response.json()) as { tokens: McpTokenSummary[] };
  return tokens;
};

export const revokeMcpToken = async (token: string): Promise<void> => {
  const response = await fetch(
    `${ACCESS_BACKEND_URL}/mcp/tokens/${encodeURIComponent(token)}`,
    { method: "DELETE", headers: await authHeader() },
  );
  if (!response.ok) {
    throw new Error(`Failed to revoke MCP token: ${response.status}`);
  }
};
