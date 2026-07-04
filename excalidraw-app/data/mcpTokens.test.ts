import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBotStatus,
  listMcpTokens,
  mintMcpToken,
  revokeMcpToken,
  stopBot,
} from "./mcpTokens";

const { getCurrentUserIdToken } = vi.hoisted(() => ({
  getCurrentUserIdToken: vi.fn(async (): Promise<string | null> => "id-token"),
}));

vi.mock("./firebase", () => ({ getCurrentUserIdToken }));

const okJson = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body } as Response);

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  getCurrentUserIdToken.mockResolvedValue("id-token");
  vi.stubGlobal("fetch", fetchMock);
});

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

describe("mintMcpToken", () => {
  it("POSTs botId + name with a bearer token", async () => {
    fetchMock.mockResolvedValue(okJson({ token: "t", mcpUrl: "u" }));
    const result = await mintMcpToken("bot1", "ci");
    const [url, init] = lastCall();
    expect(url).toContain("/mcp/tokens");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ botId: "bot1", name: "ci" });
    expect(init.headers.Authorization).toBe("Bearer id-token");
    expect(result).toEqual({ token: "t", mcpUrl: "u" });
  });

  it("throws when the backend rejects", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(mintMcpToken("bot1")).rejects.toThrow("400");
  });
});

describe("listMcpTokens", () => {
  it("scopes the request to the bot and unwraps tokens", async () => {
    fetchMock.mockResolvedValue(okJson({ tokens: [{ token: "t" }] }));
    const tokens = await listMcpTokens("bot1");
    expect(lastCall()[0]).toContain("/mcp/tokens?botId=bot1");
    expect(tokens).toEqual([{ token: "t" }]);
  });
});

describe("revokeMcpToken", () => {
  it("DELETEs the encoded token", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    await revokeMcpToken("tok/en");
    const [url, init] = lastCall();
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/mcp/tokens/tok%2Fen");
  });

  it("throws on failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(revokeMcpToken("t")).rejects.toThrow("500");
  });
});

describe("getBotStatus", () => {
  it("GETs the status endpoint for the bot", async () => {
    fetchMock.mockResolvedValue(okJson({ online: true, boards: [] }));
    const status = await getBotStatus("bot1");
    expect(lastCall()[0]).toContain("/mcp/bots/status?botId=bot1");
    expect(status).toEqual({ online: true, boards: [] });
  });
});

describe("stopBot", () => {
  it("POSTs to the stop endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    await stopBot("bot1");
    const [url, init] = lastCall();
    expect(init.method).toBe("POST");
    expect(url).toContain("/mcp/bots/bot1/stop");
  });
});

describe("auth guard", () => {
  it("refuses to call the backend when signed out", async () => {
    getCurrentUserIdToken.mockResolvedValue(null);
    await expect(listMcpTokens("bot1")).rejects.toThrow("Sign in required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
