import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface BoardMemberEntry {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
}

export function useBoardMembers(boardId: string) {
  return useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => apiFetch<BoardMemberEntry[]>(`/boards/${boardId}/members`),
  });
}

export function useAddBoardMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "EDITOR" | "VIEWER" }) =>
      apiFetch<BoardMemberEntry>(`/boards/${boardId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-members", boardId] }),
  });
}
