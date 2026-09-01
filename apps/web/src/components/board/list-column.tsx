"use client";

import type { ListWithCardsDto } from "@flowdesk/shared-types";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDeleteList } from "@/hooks/use-lists";
import { cn } from "@/lib/utils";
import { CardItem } from "./card-item";

interface ListColumnProps {
  list: ListWithCardsDto;
  onOpenCard: (cardId: string) => void;
  onCreateCard: (listId: string, title: string) => void;
}

export function ListColumn({ list, onOpenCard, onCreateCard }: ListColumnProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteList = useDeleteList(list.boardId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list" },
  });
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: list.id,
    data: { type: "list" },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const submit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onCreateCard(list.id, trimmed);
    }
    setTitle("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="group"
      aria-label={`List: ${list.name}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 p-2",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <div {...attributes} {...listeners} className="flex flex-1 cursor-grab items-center gap-2">
          <h3 className="text-sm font-semibold">{list.name}</h3>
          <span className="text-xs text-muted-foreground">{list.cards.length}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6" aria-label="List options">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="max-h-[calc(100vh-14rem)]">
        <div ref={setDroppableRef} className="flex flex-col gap-2 p-1">
          <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {list.cards.map((card) => (
              <CardItem key={card.id} card={card} onOpen={onOpenCard} />
            ))}
          </SortableContext>
        </div>
      </ScrollArea>

      {adding ? (
        <div className="flex flex-col gap-2 p-1">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            placeholder="Card title"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="justify-start gap-1 text-muted-foreground" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add card
        </Button>
      )}

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{list.name}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {list.cards.length > 0
              ? `This deletes the list and all ${list.cards.length} card${list.cards.length === 1 ? "" : "s"} in it. This can't be undone.`
              : "This can't be undone."}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteList.mutate(list.id);
                setConfirmDeleteOpen(false);
              }}
            >
              Delete list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
