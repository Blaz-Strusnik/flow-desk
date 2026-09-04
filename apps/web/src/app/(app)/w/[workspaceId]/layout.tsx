"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Hash, Lock, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateBoard, useWorkspaceBoards } from "@/hooks/use-boards";
import { useChannels, useCreateChannel, useDeleteChannel } from "@/hooks/use-channels";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

export default function WorkspaceLayout({ children }: LayoutProps<"/w/[workspaceId]">) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { data: boards } = useWorkspaceBoards(workspaceId);
  const createBoard = useCreateBoard(workspaceId);
  const { data: channels } = useChannels(workspaceId);
  const createChannel = useCreateChannel(workspaceId);
  const deleteChannel = useDeleteChannel(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const myRole = members?.find((m) => m.userId === user?.id)?.role;
  const canDeleteChannel = myRole === "OWNER" || myRole === "ADMIN";

  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3">
        <Link href="/workspaces" className="text-xs text-muted-foreground hover:underline">
          &larr; All workspaces
        </Link>

        <Link
          href={`/w/${workspaceId}`}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
            pathname === `/w/${workspaceId}` && "bg-accent font-medium"
          )}
        >
          <Users className="size-3.5 text-muted-foreground" />
          Workspace members
        </Link>

        <div>
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Boards</h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="New board"
              onClick={() => setBoardDialogOpen(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {boards?.map((board) => {
              const href = `/w/${workspaceId}/boards/${board.id}`;
              return (
                <Link
                  key={board.id}
                  href={href}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    pathname === href && "bg-accent font-medium"
                  )}
                >
                  {board.name}
                </Link>
              );
            })}
            {boards && boards.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No boards yet.</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Channels</h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="New channel"
              onClick={() => setChannelDialogOpen(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {channels?.map((channel) => {
              const href = `/w/${workspaceId}/channels/${channel.id}`;
              return (
                <div
                  key={channel.id}
                  className={cn(
                    "group flex items-center rounded-md hover:bg-accent",
                    pathname === href && "bg-accent font-medium"
                  )}
                >
                  <Link href={href} className="flex flex-1 items-center gap-1.5 px-2 py-1.5 text-sm">
                    {channel.isPrivate ? (
                      <Lock className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Hash className="size-3.5 text-muted-foreground" />
                    )}
                    {channel.name}
                  </Link>
                  {canDeleteChannel && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-1 size-6 shrink-0 opacity-0 group-hover:opacity-100"
                      aria-label={`Delete channel ${channel.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteChannelTarget({ id: channel.id, name: channel.name });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {channels && channels.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No channels yet.</p>
            )}
          </div>
        </div>
      </aside>
      <div className="flex-1 overflow-hidden">{children}</div>

      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a board</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-name">Name</Label>
            <Input
              id="board-name"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Sprint Board"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!boardName.trim()}
              onClick={async () => {
                try {
                  await createBoard.mutateAsync(boardName.trim());
                  setBoardName("");
                  setBoardDialogOpen(false);
                } catch {
                  toast.error("Failed to create board");
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-name">Name</Label>
              <Input
                id="channel-name"
                value={channelName}
                onChange={(e) =>
                  setChannelName(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="general"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={channelPrivate} onCheckedChange={(v) => setChannelPrivate(v === true)} />
              Private channel
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={!channelName.trim()}
              onClick={async () => {
                try {
                  await createChannel.mutateAsync({ name: channelName.trim(), isPrivate: channelPrivate });
                  setChannelName("");
                  setChannelPrivate(false);
                  setChannelDialogOpen(false);
                } catch (err) {
                  const message =
                    err instanceof ApiError && err.status === 409
                      ? "A channel with that name already exists"
                      : "Failed to create channel";
                  toast.error(message);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteChannelTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteChannelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;#{deleteChannelTarget?.name}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the channel and all of its messages. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteChannelTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteChannel.isPending}
              onClick={async () => {
                if (!deleteChannelTarget) return;
                const { id } = deleteChannelTarget;
                await deleteChannel.mutateAsync(id);
                setDeleteChannelTarget(null);
                if (pathname === `/w/${workspaceId}/channels/${id}`) {
                  router.replace(`/w/${workspaceId}`);
                }
              }}
            >
              Delete channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
