import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BotConnectPanel } from "./BotConnectPanel";

const mcp = vi.hoisted(() => ({
  listMcpTokens: vi.fn(),
  mintMcpToken: vi.fn(),
  revokeMcpToken: vi.fn(),
}));

vi.mock("../data/mcpTokens", () => mcp);

vi.mock("../components/useAppT", () => ({
  useAppT: () => (key: string) => key,
}));

vi.mock("@excalidraw/excalidraw/components/FilledButton", () => ({
  FilledButton: ({ label, onClick, disabled, children }: any) => (
    <button aria-label={label} disabled={disabled} onClick={onClick}>
      {children ?? label}
    </button>
  ),
}));

vi.mock("@excalidraw/excalidraw/components/TextField", () => ({
  TextField: ({ value, onChange, placeholder }: any) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@excalidraw/excalidraw/components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

vi.mock("../components/AppConfirm", () => ({
  AppConfirm: ({ onConfirm }: any) => (
    <button aria-label="confirm" onClick={onConfirm}>
      confirm
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BotConnectPanel", () => {
  it("mints a named token, shows the connect snippet, and clears it on revoke", async () => {
    mcp.listMcpTokens
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ token: "tok-1", createdAt: 1, revoked: false }])
      .mockResolvedValue([]);
    mcp.mintMcpToken.mockResolvedValue({
      token: "tok-1",
      mcpUrl: "http://mcp",
      serverName: "srv",
      configSnippet: { mcpServers: {} },
    });
    mcp.revokeMcpToken.mockResolvedValue(undefined);

    render(<BotConnectPanel botId="bot1" />);

    await screen.findByText("app.bots.noTokens");

    fireEvent.change(
      screen.getByPlaceholderText("app.bots.tokenNamePlaceholder"),
      {
        target: { value: "ci" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "app.bots.createToken" }),
    );

    await screen.findByText("app.bots.newToken");
    expect(mcp.mintMcpToken).toHaveBeenCalledWith("bot1", "ci");
    expect(screen.getAllByText(/tok-1/).length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /app.bots.revokeToken/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() =>
      expect(screen.queryByText("app.bots.newToken")).toBeNull(),
    );
    expect(mcp.revokeMcpToken).toHaveBeenCalledWith("tok-1");
  });

  it("shows an error and no snippet when minting fails", async () => {
    mcp.listMcpTokens.mockResolvedValue([]);
    mcp.mintMcpToken.mockRejectedValue(new Error("boom"));

    render(<BotConnectPanel botId="bot1" />);
    await screen.findByText("app.bots.noTokens");

    fireEvent.click(
      screen.getByRole("button", { name: "app.bots.createToken" }),
    );

    await screen.findByText("app.bots.mintError");
    expect(screen.queryByText("app.bots.newToken")).toBeNull();
  });
});
