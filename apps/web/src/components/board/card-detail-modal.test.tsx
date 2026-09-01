import type { BoardDetailDto, CardDetailDto } from "@flowdesk/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";
import { CardDetailModal } from "./card-detail-modal";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

function makeCard(overrides: Partial<CardDetailDto> = {}): CardDetailDto {
  return {
    id: "card-1",
    listId: "list-1",
    title: "Ship the feature",
    description: null,
    position: 1024,
    dueDate: null,
    coverColor: null,
    labels: [],
    members: [],
    comments: [],
    attachments: [],
    ...overrides,
  };
}

function makeBoard(overrides: Partial<BoardDetailDto> = {}): BoardDetailDto {
  return {
    id: "board-1",
    workspaceId: "ws-1",
    name: "Board",
    background: null,
    labels: [],
    lists: [],
    ...overrides,
  };
}

function renderModal(
  card: CardDetailDto,
  board: BoardDetailDto,
  boardMembers: unknown[] = [],
  workspaceMembers: unknown[] = []
) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path.startsWith("/cards/")) return Promise.resolve(card);
    if (path.startsWith("/boards/") && path.endsWith("/members")) return Promise.resolve(boardMembers);
    if (path.startsWith("/boards/")) return Promise.resolve(board);
    if (path.startsWith("/workspaces/") && path.endsWith("/members")) return Promise.resolve(workspaceMembers);
    return Promise.resolve(null);
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CardDetailModal cardId={card.id} boardId={board.id} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("CardDetailModal", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  // Regression test: this exact scenario (a card with an assigned member)
  // crashed with "Cannot read properties of undefined (reading '0')"
  // because the backend returned nested {user: {...}} objects while the
  // frontend read member.name directly. Covers the fix at the component
  // level, complementing the API-level shape assertion in
  // apps/api/test/card-detail.e2e-spec.ts.
  it("renders an assigned member's name without crashing", async () => {
    renderModal(
      makeCard({ members: [{ id: "user-1", email: "a@example.com", name: "Alice", avatarUrl: null }] }),
      makeBoard()
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("renders a comment author's name without crashing", async () => {
    renderModal(
      makeCard({
        comments: [
          {
            id: "c1",
            cardId: "card-1",
            userId: "user-1",
            body: "Looks good",
            createdAt: new Date().toISOString(),
            user: { id: "user-1", email: "a@example.com", name: "Bob", avatarUrl: null },
          },
        ],
      }),
      makeBoard()
    );

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Looks good")).toBeInTheDocument();
  });

  it("renders a label as an active badge when it's already on the card", async () => {
    renderModal(
      makeCard({ labels: [{ id: "label-1", boardId: "board-1", name: "Bug", color: "#ff0000" }] }),
      makeBoard({ labels: [{ id: "label-1", boardId: "board-1", name: "Bug", color: "#ff0000" }] })
    );

    expect(await screen.findByText("Bug")).toBeInTheDocument();
  });

  it("shows placeholder text when there are no members or comments", async () => {
    renderModal(makeCard(), makeBoard());

    expect(await screen.findByText("Nobody assigned yet.")).toBeInTheDocument();
  });

  // Regression: a workspace member who hadn't yet been added to the board
  // never appeared as an assignable candidate on the card, so there was no
  // way to add them short of a separate "Board members" dialog most users
  // never found. Offering all workspace members here, and adding them to
  // the board on first assign, collapses that into one click.
  it("offers a workspace member who isn't yet a board member as an assignee, and adds them to the board on click", async () => {
    renderModal(
      makeCard(),
      makeBoard(),
      [],
      [{ userId: "user-2", role: "MEMBER", user: { id: "user-2", email: "b@example.com", name: "Charlie", avatarUrl: null } }]
    );

    const addButton = await screen.findByRole("button", { name: "+ Charlie" });
    await userEvent.click(addButton);

    await vi.waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/boards/board-1/members",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: "user-2", role: "EDITOR" }) })
      );
      expect(apiFetch).toHaveBeenCalledWith(
        "/cards/card-1/members",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: "user-2" }) })
      );
    });
  });
});
