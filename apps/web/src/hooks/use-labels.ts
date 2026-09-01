import type { BoardDetailDto, LabelDto } from "@flowdesk/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      apiFetch<LabelDto>(`/boards/${boardId}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color }),
      }),
    onSuccess: (label) => {
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (old) =>
        old ? { ...old, labels: [...old.labels, label] } : old
      );
    },
  });
}
