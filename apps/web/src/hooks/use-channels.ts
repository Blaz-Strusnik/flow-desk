import type { ChannelDto } from "@flowdesk/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useChannels(workspaceId: string) {
  return useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => apiFetch<ChannelDto[]>(`/workspaces/${workspaceId}/channels`),
  });
}

export function useCreateChannel(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isPrivate }: { name: string; isPrivate: boolean }) =>
      apiFetch<ChannelDto>(`/workspaces/${workspaceId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name, isPrivate }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels", workspaceId] }),
  });
}

export function useDeleteChannel(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) =>
      apiFetch(`/workspaces/${workspaceId}/channels/${channelId}`, { method: "DELETE" }),
    onSuccess: (_data, channelId) => {
      queryClient.setQueryData<ChannelDto[]>(["channels", workspaceId], (old) =>
        old ? old.filter((c) => c.id !== channelId) : old
      );
    },
  });
}
