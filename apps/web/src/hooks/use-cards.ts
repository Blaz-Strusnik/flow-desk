import type { BoardCardDto, BoardDetailDto, CardDetailDto, CardDto } from "@flowdesk/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useCreateCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      apiFetch<CardDto>(`/lists/${listId}/cards`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: (card) => {
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old
          ? {
              ...old,
              lists: old.lists.map((l) =>
                l.id === card.listId ? { ...l, cards: [...l.cards, { ...card, labels: [] }] } : l
              ),
            }
          : old
      );
    },
  });
}

export function useDeleteCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => apiFetch(`/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: (_data, cardId) => {
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old
          ? {
              ...old,
              lists: old.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })),
            }
          : old
      );
    },
  });
}

export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      listId,
      beforeId,
      afterId,
    }: {
      cardId: string;
      listId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }) =>
      apiFetch<CardDto>(`/cards/${cardId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ listId, beforeId, afterId }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useCardDetail(cardId: string | null) {
  return useQuery({
    queryKey: ["card", cardId],
    queryFn: () => apiFetch<CardDetailDto>(`/cards/${cardId}`),
    enabled: !!cardId,
  });
}

export function useUpdateCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      ...data
    }: {
      cardId: string;
      title?: string;
      description?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      coverColor?: string | null;
    }) =>
      apiFetch<CardDto>(`/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (card) => {
      queryClient.setQueryData<CardDetailDto>(["card", card.id], (old) => (old ? { ...old, ...card } : old));
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old
          ? {
              ...old,
              lists: old.lists.map((l) => ({
                ...l,
                cards: l.cards.map((c) => (c.id === card.id ? { ...c, ...card } : c)),
              })),
            }
          : old
      );
    },
  });
}

export function useAddComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/cards/${cardId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}

/** Patches the label list of one card inside the cached board detail. */
function patchBoardCardLabels(
  queryClient: ReturnType<typeof useQueryClient>,
  boardId: string,
  cardId: string,
  update: (labels: BoardCardDto["labels"]) => BoardCardDto["labels"]
) {
  queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
    old
      ? {
          ...old,
          lists: old.lists.map((l) => ({
            ...l,
            cards: l.cards.map((c) => (c.id === cardId ? { ...c, labels: update(c.labels) } : c)),
          })),
        }
      : old
  );
}

export function useAttachLabel(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) =>
      apiFetch(`/cards/${cardId}/labels`, { method: "POST", body: JSON.stringify({ labelId }) }),
    onSuccess: (_data, labelId) => {
      // Reflect on the board immediately — the label's color lives on the
      // board's label palette, so no refetch is needed to draw the swatch.
      const board = queryClient.getQueryData<BoardDetailDto>(["board", boardId]);
      const label = board?.labels.find((l) => l.id === labelId);
      if (label) {
        patchBoardCardLabels(queryClient, boardId, cardId, (labels) =>
          labels.some((l) => l.id === labelId) ? labels : [...labels, label]
        );
      }
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
  });
}

export function useDetachLabel(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => apiFetch(`/cards/${cardId}/labels/${labelId}`, { method: "DELETE" }),
    onSuccess: (_data, labelId) => {
      patchBoardCardLabels(queryClient, boardId, cardId, (labels) =>
        labels.filter((l) => l.id !== labelId)
      );
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
  });
}

export function useAssignMember(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/cards/${cardId}/members`, { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}

export function useUnassignMember(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/cards/${cardId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}

export function useUploadAttachment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch(`/cards/${cardId}/attachments`, { method: "POST", body: form });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}
