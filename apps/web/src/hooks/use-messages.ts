import type { MessageDto } from "@flowdesk/shared-types";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface MessagesPage {
  messages: MessageDto[];
  nextCursor: string | null;
}

export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: ["messages", channelId],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const query = pageParam ? `?cursor=${pageParam}&limit=30` : "?limit=30";
      return apiFetch<MessagesPage>(`/channels/${channelId}/messages${query}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/** Flattens infinite-query pages (each page newest-first fetch order,
 * ascending within itself) into one chronological (oldest-first) list. */
export function flattenMessagePages(pages: MessagesPage[] | undefined): MessageDto[] {
  if (!pages) return [];
  return pages
    .slice()
    .reverse()
    .flatMap((p) => p.messages);
}

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<MessageDto>(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}
