"use client";

import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAddBoardMember, useBoardMembers } from "@/hooks/use-board-members";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

export function BoardMembersDialog({ boardId, workspaceId }: { boardId: string; workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const { data: boardMembers } = useBoardMembers(boardId);
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceId);
  const addBoardMember = useAddBoardMember(boardId);

  const boardMemberIds = new Set(boardMembers?.map((m) => m.userId));
  const addable = workspaceMembers?.filter((m) => !boardMemberIds.has(m.userId)) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Users className="size-4" /> Members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board members</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {boardMembers?.map((member) => (
            <div key={member.userId} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{member.user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {member.role}
              </Badge>
            </div>
          ))}
        </div>

        {addable.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Add from this workspace</p>
            {addable.map((member) => (
              <div key={member.userId} className="flex items-center gap-2 px-1">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">{member.user.name[0]}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{member.user.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 rounded-full px-2 text-xs"
                  onClick={() => addBoardMember.mutate({ userId: member.userId, role: "EDITOR" })}
                >
                  <UserPlus className="size-3" /> Add
                </Button>
              </div>
            ))}
          </div>
        )}
        {workspaceMembers && addable.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Everyone in this workspace already has access to this board.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
