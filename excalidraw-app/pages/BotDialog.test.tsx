import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BotDialog } from "./BotDialog";

const data = vi.hoisted(() => ({
  createBot: vi.fn(),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  stopBot: vi.fn(),
}));

vi.mock("../data/bots", () => ({
  createBot: data.createBot,
  updateBot: data.updateBot,
  deleteBot: data.deleteBot,
}));

vi.mock("../data/mcpTokens", () => ({ stopBot: data.stopBot }));

vi.mock("./BotConnectPanel", () => ({
  BotConnectPanel: () => <div data-testid="connect-panel" />,
}));

vi.mock("../components/useAppT", () => ({
  useAppT: () => (key: string) => key,
}));

vi.mock("../components/AppDialog", () => ({
  AppDialog: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../components/AppConfirm", () => ({
  AppConfirm: ({ onConfirm }: any) => (
    <button aria-label="confirm" onClick={onConfirm}>
      confirm
    </button>
  ),
}));

vi.mock("@excalidraw/excalidraw/components/FilledButton", () => ({
  FilledButton: ({ label, onClick, disabled }: any) => (
    <button aria-label={label} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("@excalidraw/excalidraw/components/TextField", () => ({
  TextField: ({ value, onChange, placeholder }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@excalidraw/excalidraw/components/RadioGroup", () => ({
  RadioGroup: ({ value, choices, onChange, name }: any) => (
    <div>
      {choices.map((choice: any) => (
        <button
          key={choice.value}
          aria-label={`${name}-${choice.value}`}
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  ),
}));

const boards = [{ roomId: "b1", title: "Board One" }] as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BotDialog — create", () => {
  it("creates an owner bot carrying the selected board allow-list", async () => {
    data.createBot.mockResolvedValue({ id: "new" });
    const onSaved = vi.fn();

    render(
      <BotDialog
        bot={null}
        boards={boards}
        onClose={vi.fn()}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("app.bots.namePlaceholder"), {
      target: { value: "Helper" },
    });
    fireEvent.click(screen.getByLabelText("Board One"));
    fireEvent.click(screen.getByRole("button", { name: "app.common.save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(data.createBot).toHaveBeenCalledTimes(1);
    expect(data.createBot.mock.calls[0][0]).toMatchObject({
      name: "Helper",
      disabled: false,
      boards: [{ boardId: "b1", role: "write" }],
    });
  });

  it("guards against double-submit while saving", async () => {
    let resolve: (() => void) | undefined;
    data.createBot.mockReturnValue(
      new Promise<void>((r) => {
        resolve = () => r();
      }),
    );

    render(
      <BotDialog
        bot={null}
        boards={boards}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    const save = screen.getByRole("button", {
      name: "app.common.save",
    }) as HTMLButtonElement;
    fireEvent.click(save);

    await waitFor(() => expect(save.disabled).toBe(true));
    fireEvent.click(save);
    expect(data.createBot).toHaveBeenCalledTimes(1);
    resolve?.();
  });
});

describe("BotDialog — edit", () => {
  it("disables the bot and stops its runtime on save", async () => {
    data.updateBot.mockResolvedValue(undefined);
    data.stopBot.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const bot = {
      id: "bot1",
      ownerUid: "u",
      name: "Helper",
      avatar: { kind: "emoji", value: "🤖" },
      color: "#6965db",
      boards: [],
      disabled: false,
      createdAt: 1,
      updatedAt: 1,
    } as any;

    render(
      <BotDialog
        bot={bot}
        boards={boards}
        onClose={vi.fn()}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: "app.common.save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(data.updateBot).toHaveBeenCalledWith(
      "bot1",
      expect.objectContaining({ disabled: true }),
    );
    expect(data.stopBot).toHaveBeenCalledWith("bot1");
  });
});
