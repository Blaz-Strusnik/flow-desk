import type { BoardDetailDto, ListDto } from "@flowdesk/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useCreateList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<ListDto>(`/boards/${boardId}/lists`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (list) => {
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old ? { ...old, lists: [...old.lists, { ...list, cards: [] }] } : old
      );
    },
  });
}

export function useMoveList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      beforeId,
      afterId,
    }: {
      listId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }) =>
      apiFetch<ListDto>(`/lists/${listId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ beforeId, afterId }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useDeleteList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => apiFetch(`/lists/${listId}`, { method: "DELETE" }),
    onSuccess: (_data, listId) => {
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old ? { ...old, lists: old.lists.filter((l) => l.id !== listId) } : old
      );
    },
  });
}

export function useRenameList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      apiFetch<ListDto>(`/lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}
