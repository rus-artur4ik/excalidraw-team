import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppDialog } from "./AppDialog";

vi.mock("./useAppT", () => ({
  useAppT: () => (key: string) => key,
}));

vi.mock("./useResolvedTheme", () => ({
  useResolvedTheme: () => "light",
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const openAndSettle = (children: React.ReactNode) => {
  render(
    <AppDialog title="Dialog" onClose={vi.fn()}>
      {children}
    </AppDialog>,
  );
  act(() => {
    vi.runAllTimers();
  });
};

describe("AppDialog initial focus", () => {
  it("starts in the first text field, not in the control after it", () => {
    openAndSettle(
      <>
        <input aria-label="name" />
        <textarea aria-label="description" />
        <input type="radio" aria-label="private" />
      </>,
    );
    expect(screen.getByLabelText("name")).toHaveFocus();
  });

  it("skips read-only fields", () => {
    openAndSettle(
      <>
        <input aria-label="link" readOnly />
        <input aria-label="email" type="email" />
      </>,
    );
    expect(screen.getByLabelText("email")).toHaveFocus();
  });

  it("keeps the old fallback when the dialog has no text field", () => {
    openAndSettle(
      <>
        <button>cancel</button>
        <button>confirm</button>
      </>,
    );
    expect(screen.getByRole("button", { name: "confirm" })).toHaveFocus();
  });
});
