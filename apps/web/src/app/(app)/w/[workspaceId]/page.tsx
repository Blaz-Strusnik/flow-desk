"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceBoards } from "@/hooks/use-boards";
import { useDeleteWorkspace, useWorkspace } from "@/hooks/use-workspaces";
import {
  useInviteWorkspaceMember,
  useRemoveWorkspaceMember,
  useWorkspaceMembers,
} from "@/hooks/use-workspace-members";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";

export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const router = useRouter();
  const { user } = useAuth();
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: boards, isLoading } = useWorkspaceBoards(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const inviteMember = useInviteWorkspaceMember(workspaceId);
  const removeMember = useRemoveWorkspaceMember(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

  // Derive ownership from the workspace record (stable) rather than the
  // members list, which briefly refetches — and goes undefined — whenever
  // someone is invited, making the danger zone flicker out.
  const isOwner = !!workspace && workspace.ownerId === user?.id;
  const myRole = members?.find((m) => m.userId === user?.id)?.role;
  const canManageMembers = isOwner || myRole === "ADMIN";

  const confirmRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget.userId);
      toast.success(`${removeTarget.name} removed from the workspace`);
      setRemoveTarget(null);
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const invite = async () => {
    try {
      await inviteMember.mutateAsync(email.trim());
      toast.success("Member added to the workspace");
      setEmail("");
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 404
          ? "No account with that email is registered yet"
          : err instanceof ApiError && err.status === 409
            ? "That person is already a member of this workspace"
            : "Failed to add member";
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync(workspaceId);
      toast.success("Workspace deleted");
      router.replace("/workspaces");
    } catch {
      toast.error("Failed to delete workspace");
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-8 overflow-y-auto p-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Workspace members</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <UserPlus className="size-4" /> Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a member</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  They need an existing FlowDesk account — invite-to-signup isn&apos;t supported yet.
                </p>
              </div>
              <DialogFooter>
                <Button disabled={!email.trim() || inviteMember.isPending} onClick={invite}>
                  Add to workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-2">
          {members?.map((member) => {
            const isWorkspaceOwner = member.userId === workspace?.ownerId;
            const canRemove = canManageMembers && !isWorkspaceOwner && member.userId !== user?.id;
            return (
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
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${member.user.name}`}
                    onClick={() => setRemoveTarget({ userId: member.userId, name: member.user.name })}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
          {members && members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center text-center">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : boards && boards.length > 0 ? (
          <p className="text-sm text-muted-foreground">Pick a board from the sidebar to get started.</p>
        ) : (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Plus className="size-4" /> No boards here yet — create one from the sidebar to start organizing work.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="rounded-md border border-destructive/30 p-4">
          <h2 className="mb-1 text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Deleting a workspace permanently removes all of its boards, cards, and channels for everyone. This
            can&apos;t be undone.
          </p>
          <Dialog
            open={deleteOpen}
            onOpenChange={(next) => {
              setDeleteOpen(next);
              if (!next) setDeleteConfirmText("");
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <Trash2 className="size-4" /> Delete workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete &quot;{workspace?.name}&quot;?</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-semibold">{workspace?.name}</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmText !== workspace?.name || deleteWorkspace.isPending}
                  onClick={confirmDelete}
                >
                  Delete permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name} from the workspace?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They immediately lose access to every board, card, and channel in this workspace. Any boards
            they created stay. You can invite them again later.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removeMember.isPending} onClick={confirmRemoveMember}>
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
