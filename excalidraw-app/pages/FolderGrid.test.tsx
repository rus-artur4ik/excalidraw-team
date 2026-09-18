import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FolderGrid, FolderHeader } from "./FolderGrid";
import { BOARD_DRAG_TYPE } from "./folderView";

import type { Folder } from "../data/folders";

vi.mock("../components/useAppT", () => ({
  useAppT: () => (key: string, replacement?: Record<string, string | number>) =>
    replacement ? `${key}(${replacement.count})` : key,
}));

vi.mock("@excalidraw/excalidraw/i18n", () => ({
  getLanguage: () => ({ code: "ru-RU" }),
}));

const folder = (id: string, name: string, boardIds: string[] = []): Folder => ({
  id,
  name,
  boardIds,
  createdAt: 1,
  updatedAt: 1,
});

const folders = [folder("f1", "Backend", ["b1"]), folder("f2", "Design")];

const handlers = {
  onDropBoard: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
};

const renderGrid = (dragging = false) =>
  render(
    <FolderGrid
      folders={folders}
      counts={
        new Map([
          ["f1", 3],
          ["f2", 5],
        ])
      }
      dragging={dragging}
      {...handlers}
    />,
  );

const dataTransfer = (boardId: string) => ({
  types: [BOARD_DRAG_TYPE],
  getData: (type: string) => (type === BOARD_DRAG_TYPE ? boardId : ""),
});

const tile = (name: RegExp) =>
  screen.getByRole("link", { name }).parentElement!;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("FolderGrid", () => {
  it("shows every folder with a pluralised board count", () => {
    renderGrid();
    expect(screen.getByRole("link", { name: /Backend/ })).toHaveTextContent(
      "app.folders.boards_few(3)",
    );
    expect(screen.getByRole("link", { name: /Design/ })).toHaveTextContent(
      "app.folders.boards_many(5)",
    );
  });

  it("opens a folder at its own address", () => {
    renderGrid();
    const link = screen.getByRole("link", { name: /Design/ });
    expect(link).toHaveAttribute("href", "/f/f2");
    fireEvent.click(link);
    expect(window.location.pathname).toBe("/f/f2");
  });

  it("leaves modified clicks to the browser", () => {
    renderGrid();
    let prevented: boolean | null = null;
    const onClick = (event: MouseEvent) => {
      prevented = event.defaultPrevented;
      event.preventDefault(); // jsdom cannot follow the link
    };
    document.addEventListener("click", onClick);
    fireEvent.click(screen.getByRole("link", { name: /Design/ }), {
      metaKey: true,
    });
    document.removeEventListener("click", onClick);
    expect(prevented).toBe(false);
    expect(window.location.pathname).toBe("/");
  });

  it("files a board dropped on a folder tile", () => {
    renderGrid(true);
    const design = tile(/Design/);
    fireEvent.dragOver(design, { dataTransfer: dataTransfer("b9") });
    expect(design.className).toContain("exa-folder-tile--over");
    fireEvent.drop(design, { dataTransfer: dataTransfer("b9") });
    expect(handlers.onDropBoard).toHaveBeenCalledWith("b9", "f2");
    expect(design.className).not.toContain("exa-folder-tile--over");
  });

  it("ignores drops that are not boards", () => {
    renderGrid(true);
    fireEvent.drop(tile(/Design/), {
      dataTransfer: { types: ["text/plain"], getData: () => "x" },
    });
    expect(handlers.onDropBoard).not.toHaveBeenCalled();
  });

  it("renames and deletes from each tile's menu", () => {
    renderGrid();
    const options = screen.getAllByRole("button", {
      name: "app.folders.options",
    });
    expect(options).toHaveLength(2);
    fireEvent.click(options[1]);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.rename/ }),
    );
    expect(handlers.onRename).toHaveBeenCalledWith(folders[1]);
    fireEvent.click(options[0]);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.delete/ }),
    );
    expect(handlers.onDelete).toHaveBeenCalledWith(folders[0]);
  });
});

describe("FolderHeader", () => {
  const renderHeader = (dragging = false) =>
    render(
      <FolderHeader
        folder={folders[0]}
        count={1}
        dragging={dragging}
        {...handlers}
      />,
    );

  it("names the open folder and links back to all boards", () => {
    window.history.replaceState({}, "", "/f/f1");
    renderHeader();
    expect(
      screen.getByRole("heading", { name: "Backend" }),
    ).toBeInTheDocument();
    expect(screen.getByText("app.folders.boards_one(1)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "app.folders.all" }));
    expect(window.location.pathname).toBe("/");
  });

  it("takes a board dropped on 'All boards' out of the folder", () => {
    renderHeader(true);
    const root = screen.getByRole("link", { name: "app.folders.all" });
    fireEvent.dragOver(root, { dataTransfer: dataTransfer("b1") });
    expect(root.className).toContain("exa-crumbs__root--over");
    fireEvent.drop(root, { dataTransfer: dataTransfer("b1") });
    expect(handlers.onDropBoard).toHaveBeenCalledWith("b1");
  });

  it("renames and deletes the open folder", () => {
    renderHeader();
    const options = screen.getByRole("button", { name: "app.folders.options" });
    fireEvent.click(options);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.rename/ }),
    );
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    fireEvent.click(options);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.delete/ }),
    );
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});
