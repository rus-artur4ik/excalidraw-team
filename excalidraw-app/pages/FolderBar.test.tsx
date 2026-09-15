import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FolderBar } from "./FolderBar";
import { BOARD_DRAG_TYPE } from "./folderView";

import type { Folder } from "../data/folders";

vi.mock("../components/useAppT", () => ({
  useAppT: () => (key: string) => key,
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
  onSelect: vi.fn(),
  onDropBoard: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
};

const renderBar = (
  view: Parameters<typeof FolderBar>[0]["view"] = { kind: "all" },
  dragging = false,
) =>
  render(
    <FolderBar
      folders={folders}
      view={view}
      counts={new Map([["f1", 1]])}
      allCount={3}
      unfiledCount={2}
      dragging={dragging}
      {...handlers}
    />,
  );

const dataTransfer = (boardId: string) => ({
  types: [BOARD_DRAG_TYPE],
  getData: (type: string) => (type === BOARD_DRAG_TYPE ? boardId : ""),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FolderBar", () => {
  it("lists the built-in views and every folder with its count", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /app.folders.all/ }),
    ).toHaveTextContent("3");
    expect(
      screen.getByRole("button", { name: /app.folders.unfiled/ }),
    ).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /Backend/ })).toHaveTextContent(
      "1",
    );
    expect(screen.getByRole("button", { name: /Design/ })).toHaveTextContent(
      "0",
    );
  });

  it("selects a folder and marks it pressed", () => {
    renderBar({ kind: "folder", id: "f2" });
    expect(screen.getByRole("button", { name: /Design/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Backend/ }));
    expect(handlers.onSelect).toHaveBeenCalledWith({
      kind: "folder",
      id: "f1",
    });
    fireEvent.click(
      screen.getByRole("button", { name: /app.folders.unfiled/ }),
    );
    expect(handlers.onSelect).toHaveBeenCalledWith({ kind: "unfiled" });
  });

  it("accepts a dragged board on a folder chip and on the unfiled chip", () => {
    renderBar({ kind: "all" }, true);
    const design = screen.getByRole("button", { name: /Design/ })
      .parentElement!;
    fireEvent.dragOver(design, { dataTransfer: dataTransfer("b9") });
    expect(design.className).toContain("exa-chip-group--over");
    fireEvent.drop(design, { dataTransfer: dataTransfer("b9") });
    expect(handlers.onDropBoard).toHaveBeenCalledWith("b9", "f2");

    const unfiled = screen.getByRole("button", { name: /app.folders.unfiled/ })
      .parentElement!;
    fireEvent.drop(unfiled, { dataTransfer: dataTransfer("b1") });
    expect(handlers.onDropBoard).toHaveBeenCalledWith("b1", null);
  });

  it("ignores drops that are not boards", () => {
    renderBar({ kind: "all" }, true);
    const design = screen.getByRole("button", { name: /Design/ })
      .parentElement!;
    fireEvent.drop(design, {
      dataTransfer: { types: ["text/plain"], getData: () => "x" },
    });
    expect(handlers.onDropBoard).not.toHaveBeenCalled();
  });

  it("offers rename and delete only for the active folder", () => {
    renderBar({ kind: "folder", id: "f1" });
    const options = screen.getAllByRole("button", {
      name: "app.folders.options",
    });
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.rename/ }),
    );
    expect(handlers.onRename).toHaveBeenCalledWith(folders[0]);
    fireEvent.click(options[0]);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /app.folders.delete/ }),
    );
    expect(handlers.onDelete).toHaveBeenCalledWith(folders[0]);
  });

  it("opens the create flow from the trailing chip", () => {
    renderBar();
    fireEvent.click(
      screen.getByRole("button", { name: /app.folders.newFolder/ }),
    );
    expect(handlers.onCreate).toHaveBeenCalledTimes(1);
  });
});
