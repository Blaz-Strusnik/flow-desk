import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface WorkspaceMemberEntry {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => apiFetch<WorkspaceMemberEntry[]>(`/workspaces/${workspaceId}/members`),
    enabled: !!workspaceId,
  });
}

export function useInviteWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<WorkspaceMemberEntry>(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] }),
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      // Removing someone also strips their board/card access, so refresh
      // anything scoped to the workspace's boards too.
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] });
    },
  });
}
