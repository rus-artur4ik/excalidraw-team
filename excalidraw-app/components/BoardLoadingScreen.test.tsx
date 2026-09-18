import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore } from "../app-jotai";
import { authLoadingAtom } from "../auth/atoms";
import { boardLoadAtom, getBoardLoadHandle } from "../boardLoad";

import { BoardLoadingScreen } from "./BoardLoadingScreen";

vi.mock("./useAppT", () => ({
  useAppT: () => (key: string, replacement?: Record<string, string | number>) =>
    replacement ? `${key}(${Object.values(replacement).join(",")})` : key,
}));

vi.mock("./useAppLanguageReady", () => ({
  useAppLanguageReady: () => true,
}));

const renderScreen = () =>
  render(
    <Provider store={appJotaiStore}>
      <BoardLoadingScreen />
    </Provider>,
  );

const step = (label: string) =>
  within(document.querySelector<HTMLElement>(".board-loader__steps")!)
    .getByText(`app.boardLoading.${label}`)
    .closest("li")!;

beforeEach(() => {
  appJotaiStore.set(authLoadingAtom, false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BoardLoadingScreen", () => {
  it("covers the editor from its first render and waits on sign-in", () => {
    appJotaiStore.set(authLoadingAtom, true);
    const { container } = renderScreen();

    expect(container.querySelector(".board-loader")).not.toBeNull();
    expect(step("auth")).toHaveClass("board-loader__step--active");
    expect(step("access")).toHaveClass("board-loader__step--pending");
  });

  it("walks the stages with what each one is loading", () => {
    renderScreen();
    const board = getBoardLoadHandle();

    act(() => {
      board.setTitle("Roadmap");
      board.loadingScene();
      board.sceneDownloaded(3 * 1024 * 1024);
    });
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(step("access")).toHaveClass("board-loader__step--done");
    expect(step("scene")).toHaveClass("board-loader__step--active");
    expect(step("scene")).toHaveTextContent("app.boardLoading.sizeMb(3)");

    act(() => {
      board.sceneReady(1);
      board.imagesProgress(2, 5);
    });
    expect(step("render")).toHaveClass("board-loader__step--active");
    expect(step("render")).toHaveTextContent(
      "app.boardLoading.elements_one(1)",
    );
    expect(step("images")).toHaveTextContent(
      "app.boardLoading.imagesProgress(2,5)",
    );
  });

  it("lets the board show through while only images are left, and skips them on request", () => {
    vi.useFakeTimers();
    const { container } = renderScreen();
    const board = getBoardLoadHandle();

    act(() => {
      board.sceneReady(10);
      board.imagesProgress(1, 5);
      board.rendered();
    });
    expect(container.querySelector(".board-loader")).toHaveClass(
      "board-loader--revealed",
    );

    fireEvent.click(screen.getByText("app.boardLoading.skipImages"));
    expect(appJotaiStore.get(boardLoadAtom).finished).toBe(true);
    expect(container.querySelector(".board-loader")).toHaveClass(
      "board-loader--leaving",
    );

    act(() => {
      vi.runAllTimers();
    });
    expect(container.querySelector(".board-loader")).toBeNull();
  });

  it("ends its board load when unmounted", () => {
    const { unmount } = renderScreen();
    expect(appJotaiStore.get(boardLoadAtom).id).not.toBe(0);

    unmount();
    expect(appJotaiStore.get(boardLoadAtom).id).toBe(0);
  });
});
