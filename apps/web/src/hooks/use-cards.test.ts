import type { BoardDetailDto } from "@flowdesk/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";
import { useAttachLabel, useDetachLabel } from "./use-cards";

vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

const LABEL = { id: "label-1", boardId: "board-1", name: "Bug", color: "#ff0000" };

function seededBoard(cardLabels: (typeof LABEL)[] = []): BoardDetailDto {
  return {
    id: "board-1",
    workspaceId: "ws-1",
    name: "Board",
    background: null,
    labels: [LABEL],
    lists: [
      {
        id: "list-1",
        boardId: "board-1",
        name: "To Do",
        position: 1024,
        cards: [
          {
            id: "card-1",
            listId: "list-1",
            title: "Fix it",
            description: null,
            position: 1024,
            startDate: null,
            dueDate: null,
            coverColor: null,
            labels: cardLabels,
          },
        ],
      },
    ],
  };
}

function setup(board: BoardDetailDto) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["board", "board-1"], board);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const boardCard = () =>
    queryClient.getQueryData<BoardDetailDto>(["board", "board-1"])!.lists[0].cards[0];
  return { queryClient, wrapper, boardCard };
}

describe("useAttachLabel / useDetachLabel board-cache sync", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset().mockResolvedValue(null);
  });

  it("attaching a label adds it (with its color) to the board card immediately", async () => {
    const { wrapper, boardCard } = setup(seededBoard());
    const { result } = renderHook(() => useAttachLabel("card-1", "board-1"), { wrapper });

    result.current.mutate("label-1");

    await waitFor(() => expect(boardCard().labels).toHaveLength(1));
    expect(boardCard().labels[0]).toMatchObject({ id: "label-1", color: "#ff0000" });
  });

  it("attaching the same label twice does not duplicate it", async () => {
    const { wrapper, boardCard } = setup(seededBoard([LABEL]));
    const { result } = renderHook(() => useAttachLabel("card-1", "board-1"), { wrapper });

    result.current.mutate("label-1");

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(boardCard().labels).toHaveLength(1);
  });

  it("detaching a label removes it from the board card immediately", async () => {
    const { wrapper, boardCard } = setup(seededBoard([LABEL]));
    const { result } = renderHook(() => useDetachLabel("card-1", "board-1"), { wrapper });

    result.current.mutate("label-1");

    await waitFor(() => expect(boardCard().labels).toHaveLength(0));
  });
});
