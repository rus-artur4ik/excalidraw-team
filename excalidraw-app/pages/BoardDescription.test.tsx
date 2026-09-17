import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BoardCard } from "./BoardCard";
import { BoardDescriptionField } from "./BoardDescriptionField";

import type { Board } from "../data/boards";

vi.mock("../components/useAppT", () => ({
  useAppT: () => (key: string) => key,
}));

// The real module pulls in the Firebase app, which these components never touch.
vi.mock("../data/boards", () => ({ BOARD_DESCRIPTION_MAX_LENGTH: 300 }));

vi.mock("../data/boardThumbnail", () => ({
  loadBoardThumbnail: vi.fn(async () => null),
}));

const board = (patch: Partial<Board> = {}): Board => ({
  roomId: "room1",
  ownerUid: "u",
  ownerEmail: "u@x.io",
  title: "Retro",
  visibility: "private",
  editors: [],
  viewers: [],
  ...patch,
});

const renderCard = (value: Board) =>
  render(
    <ul>
      <BoardCard
        board={value}
        canManage={false}
        onSettings={vi.fn()}
        roomKey={null}
        folders={[]}
        folder={null}
        showFolder
        onMoveToFolder={vi.fn()}
        onNewFolder={vi.fn()}
        onDragStateChange={vi.fn()}
      />
    </ul>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BoardCard description", () => {
  it("shows the description under the title, full text on hover", () => {
    const { container } = renderCard(
      board({ description: "What went well this sprint" }),
    );
    const description = container.querySelector(".exa-card__description");
    expect(description).toHaveTextContent("What went well this sprint");
    expect(description).toHaveAttribute("title", "What went well this sprint");
    expect(description?.previousElementSibling).toHaveTextContent("Retro");
  });

  it("renders no description line when the board has none", () => {
    const { container } = renderCard(board());
    expect(container.querySelector(".exa-card__description")).toBeNull();
  });
});

describe("BoardDescriptionField", () => {
  it("edits the value and shows the length budget", () => {
    const onChange = vi.fn();
    render(<BoardDescriptionField value="abc" onChange={onChange} />);
    const field = screen.getByLabelText("app.boardDescription.label");
    fireEvent.change(field, { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledWith("abcd");
    expect(field).toHaveAttribute("maxLength", "300");
    expect(screen.getByText("3/300")).toBeInTheDocument();
  });

  it("turns Enter into onEnter instead of a line break", () => {
    const onEnter = vi.fn();
    render(
      <BoardDescriptionField value="" onChange={vi.fn()} onEnter={onEnter} />,
    );
    const field = screen.getByLabelText("app.boardDescription.label");
    const notPrevented = fireEvent.keyDown(field, { key: "Enter" });
    expect(notPrevented).toBe(false);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
