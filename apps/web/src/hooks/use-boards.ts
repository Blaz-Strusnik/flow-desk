import type { BoardDetailDto, BoardDto } from "@flowdesk/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useWorkspaceBoards(workspaceId: string) {
  return useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => apiFetch<BoardDto[]>(`/workspaces/${workspaceId}/boards`),
  });
}

export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<BoardDto>(`/workspaces/${workspaceId}/boards`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] }),
  });
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });
}
