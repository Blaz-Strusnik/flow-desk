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
    startDate: null,
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

  it("renders a start–end range when the card has both a start and due date", () => {
    renderCard(
      makeCard({ startDate: "2026-03-10T00:00:00.000Z", dueDate: "2026-03-15T00:00:00.000Z" }),
      vi.fn()
    );
    expect(screen.getByText("Mar 10 – Mar 15")).toBeInTheDocument();
  });

  it("renders a 'Starts' badge when the card has only a start date", () => {
    renderCard(makeCard({ startDate: "2026-03-10T00:00:00.000Z" }), vi.fn());
    expect(screen.getByText("Starts Mar 10")).toBeInTheDocument();
  });

  it("renders one chip per label showing its name, filled with its color", () => {
    renderCard(
      makeCard({
        labels: [
          { id: "l1", boardId: "b1", name: "Bug", color: "#ef4444" },
          { id: "l2", boardId: "b1", name: "Urgent", color: "#eab308" },
        ],
      }),
      vi.fn()
    );

    const bug = screen.getByText("Bug");
    expect(bug).toBeInTheDocument();
    expect(bug).toHaveStyle({ backgroundColor: "#ef4444" });
    // Dark red → white text; light yellow → black text.
    expect(bug).toHaveStyle({ color: "#ffffff" });
    expect(screen.getByText("Urgent")).toHaveStyle({ color: "#000000" });
  });
});
