"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";

interface BoardMemberEntry {
  userId: string;
  user: { id: string; name: string };
}

export function PresenceBar({ boardId, userIds }: { boardId: string; userIds: string[] }) {
  const { user: me } = useAuth();
  const { data: members } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => apiFetch<BoardMemberEntry[]>(`/boards/${boardId}/members`),
  });

  const others = userIds.filter((id) => id !== me?.id);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b px-4 py-1.5">
      <span className="text-xs text-muted-foreground">Viewing now:</span>
      <div className="flex -space-x-2">
        {others.map((id) => {
          const name = members?.find((m) => m.userId === id)?.user.name ?? "?";
          return (
            <Avatar key={id} className="size-6 border-2 border-background">
              <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
            </Avatar>
          );
        })}
      </div>
    </div>
  );
}
