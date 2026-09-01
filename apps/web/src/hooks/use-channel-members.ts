import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface ChannelMemberEntry {
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export function useChannelMembers(channelId: string) {
  return useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: () => apiFetch<ChannelMemberEntry[]>(`/channels/${channelId}/members`),
  });
}
