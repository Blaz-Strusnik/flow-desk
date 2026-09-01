"use client";

import { useEffect, useState } from "react";
import { Paperclip, Plus, Tag, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAddBoardMember, useBoardMembers } from "@/hooks/use-board-members";
import { useBoard } from "@/hooks/use-boards";
import {
  useAddComment,
  useAssignMember,
  useAttachLabel,
  useCardDetail,
  useDeleteCard,
  useDetachLabel,
  useUnassignMember,
  useUpdateCard,
  useUploadAttachment,
} from "@/hooks/use-cards";
import { useCreateLabel } from "@/hooks/use-labels";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { cn } from "@/lib/utils";
import { TiptapEditor } from "./tiptap-editor";

interface CardDetailModalProps {
  cardId: string;
  boardId: string;
  onClose: () => void;
}

const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function CardDetailModal({ cardId, boardId, onClose }: CardDetailModalProps) {
  const { data: card } = useCardDetail(cardId);
  const { data: board } = useBoard(boardId);
  const { data: boardMembers } = useBoardMembers(boardId);
  const { data: workspaceMembers } = useWorkspaceMembers(board?.workspaceId ?? "");
  const updateCard = useUpdateCard(boardId);
  const addComment = useAddComment(cardId);
  const attachLabel = useAttachLabel(cardId);
  const detachLabel = useDetachLabel(cardId);
  const assignMember = useAssignMember(cardId);
  const unassignMember = useUnassignMember(cardId);
  const addBoardMember = useAddBoardMember(boardId);
  const uploadAttachment = useUploadAttachment(cardId);
  const createLabel = useCreateLabel(boardId);
  const deleteCard = useDeleteCard(boardId);

  const [title, setTitle] = useState(card?.title ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    // Seeds the editable title field from the query cache; local edits are
    // committed on blur, not synced back automatically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (card) setTitle(card.title);
  }, [card]);

  if (!card) return null;

  const cardLabelIds = new Set(card.labels.map((l) => l.id));
  const cardMemberIds = new Set(card.members.map((m) => m.id));
  const boardMemberIds = new Set(boardMembers?.map((m) => m.userId));

  // Assigning someone who is a workspace member but not yet a board member
  // silently had no effect before: they'd never appear as a candidate, since
  // only existing board members were offered. Now this adds them to the
  // board first (as EDITOR) so a single click is enough from the card.
  const assignToCard = async (userId: string) => {
    try {
      if (!boardMemberIds.has(userId)) {
        await addBoardMember.mutateAsync({ userId, role: "EDITOR" });
      }
      await assignMember.mutateAsync(userId);
    } catch {
      toast.error("Failed to assign member");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          {/* pr-8 keeps the delete button clear of DialogContent's own absolutely-positioned close (X) button in the top-right corner */}
          <div className="flex items-center gap-2 pr-8">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== card.title && updateCard.mutate({ cardId, title })}
              className="border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Delete card"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <DialogTitle className="sr-only">Edit card</DialogTitle>
        </DialogHeader>

        {confirmingDelete && (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span>Delete this card? This can&apos;t be undone.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  deleteCard.mutate(cardId);
                  onClose();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div>
            <label className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Tag className="size-3.5" /> Labels
            </label>
            <div className="flex flex-wrap gap-2">
              {board?.labels.map((label) => {
                const active = cardLabelIds.has(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => (active ? detachLabel.mutate(label.id) : attachLabel.mutate(label.id))}
                    className="rounded-full"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      style={active ? { backgroundColor: label.color, borderColor: label.color } : undefined}
                    >
                      {label.name}
                    </Badge>
                  </button>
                );
              })}
              {(!board?.labels || board.labels.length === 0) && (
                <p className="text-xs text-muted-foreground">No labels on this board yet.</p>
              )}
              <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-6 gap-1 rounded-full px-2 text-xs">
                    <Plus className="size-3" /> New label
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="flex flex-col gap-3">
                    <Input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Label name"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      {LABEL_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={color}
                          onClick={() => setNewLabelColor(color)}
                          className={cn(
                            "size-6 rounded-full ring-offset-2 ring-offset-background",
                            newLabelColor === color && "ring-2 ring-foreground"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newLabelName.trim() || createLabel.isPending}
                      onClick={async () => {
                        await createLabel.mutateAsync({ name: newLabelName.trim(), color: newLabelColor });
                        setNewLabelName("");
                        setNewLabelColor(LABEL_COLORS[0]);
                        setLabelPopoverOpen(false);
                      }}
                    >
                      Create
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" /> Assignees
            </label>
            <div className="flex flex-wrap gap-2">
              {card.members.map((member) => (
                <Badge key={member.id} variant="secondary" className="gap-1 pr-1">
                  <Avatar className="size-4">
                    <AvatarFallback className="text-[10px]">{member.name[0]}</AvatarFallback>
                  </Avatar>
                  {member.name}
                  <button
                    type="button"
                    onClick={() => unassignMember.mutate(member.id, { onError: () => toast.error("Failed to unassign member") })}
                    className="ml-1 rounded-full hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {card.members.length === 0 && (
                <p className="text-xs text-muted-foreground">Nobody assigned yet.</p>
              )}
            </div>
            {workspaceMembers && workspaceMembers.filter((m) => !cardMemberIds.has(m.userId)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {workspaceMembers
                  .filter((m) => !cardMemberIds.has(m.userId))
                  .map((m) => (
                    <Button
                      key={m.userId}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 rounded-full px-2 text-xs"
                      disabled={addBoardMember.isPending || assignMember.isPending}
                      onClick={() => assignToCard(m.userId)}
                    >
                      + {m.user.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Due date</label>
            <Input
              type="date"
              defaultValue={card.dueDate ? card.dueDate.slice(0, 10) : ""}
              onChange={(e) =>
                updateCard.mutate({
                  cardId,
                  dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="w-48"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Description</label>
            <TiptapEditor
              content={card.description ?? ""}
              onBlurSave={(html) => {
                const normalized = html === "<p></p>" ? "" : html;
                if (normalized !== (card.description ?? "")) {
                  updateCard.mutate({ cardId, description: normalized || null });
                }
              }}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Paperclip className="size-3.5" /> Attachments
            </label>
            <div className="flex flex-col gap-2">
              {card.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`${process.env.NEXT_PUBLIC_API_URL}${att.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  {att.fileName}
                </a>
              ))}
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAttachment.mutate(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Comments</label>
            <div className="flex flex-col gap-3">
              {card.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-sm">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">{comment.user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-md bg-muted p-2">
                    <p className="mb-1 text-xs font-medium">{comment.user.name}</p>
                    <p>{comment.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-16"
                />
              </div>
              <Button
                size="sm"
                className="w-fit"
                disabled={!commentBody.trim()}
                onClick={() => {
                  addComment.mutate(commentBody);
                  setCommentBody("");
                }}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
