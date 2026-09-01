import type { BoardCardDto } from "@flowdesk/shared-types";
import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardItem } from "./card-item";

function makeCard(overrides: Partial<BoardCardDto> = {}): BoardCardDto {
  return {
    id: "card-1",
    listId: "list-1",
    title: "Write the report",
    description: null,
    position: 1024,
    dueDate: null,
    coverColor: null,
    labels: [],
    ...overrides,
  };
}

function renderCard(card: BoardCardDto, onOpen: (id: string) => void) {
  return render(
    <DndContext>
      <CardItem card={card} onOpen={onOpen} />
    </DndContext>
  );
}

describe("CardItem", () => {
  it("renders the card title", () => {
    renderCard(makeCard(), vi.fn());
    expect(screen.getByText("Write the report")).toBeInTheDocument();
  });

  it("calls onOpen with the card id when clicked", () => {
    // Plain fireEvent, not userEvent: dnd-kit's pointer-sensor listeners on
    // this element expect real Pointer Capture support, which jsdom lacks,
    // so a full userEvent pointer-gesture simulation errors out here. A raw
    // click event is enough to verify the onClick wiring itself.
    const onOpen = vi.fn();
    renderCard(makeCard({ id: "card-42" }), onOpen);

    fireEvent.click(screen.getByText("Write the report"));

    expect(onOpen).toHaveBeenCalledWith("card-42");
  });

  it("renders a due-date badge when the card has a due date", () => {
    renderCard(makeCard({ dueDate: "2026-03-15T00:00:00.000Z" }), vi.fn());
    expect(screen.getByText("Mar 15")).toBeInTheDocument();
  });

  it("does not render a due-date badge when there is no due date", () => {
    renderCard(makeCard({ dueDate: null }), vi.fn());
    expect(screen.queryByText(/^[A-Z][a-z]{2} \d+$/)).not.toBeInTheDocument();
  });

  it("renders one swatch per label", () => {
    renderCard(
      makeCard({
        labels: [
          { id: "l1", boardId: "b1", name: "Bug", color: "#ff0000" },
          { id: "l2", boardId: "b1", name: "Urgent", color: "#00ff00" },
        ],
      }),
      vi.fn()
    );
    expect(screen.getByTitle("Bug")).toBeInTheDocument();
    expect(screen.getByTitle("Urgent")).toBeInTheDocument();
  });
});
