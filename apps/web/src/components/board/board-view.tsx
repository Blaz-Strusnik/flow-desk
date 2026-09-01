"use client";

import type { ListWithCardsDto } from "@flowdesk/shared-types";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoard } from "@/hooks/use-boards";
import { useCreateCard, useMoveCard } from "@/hooks/use-cards";
import { useCreateList, useMoveList } from "@/hooks/use-lists";
import { useBoardSocket } from "@/lib/socket/use-board-socket";
import { useBoardStore } from "@/stores/board-store";
import { BoardMembersDialog } from "./board-members-dialog";
import { CardItem } from "./card-item";
import { ListColumn } from "./list-column";
import { PresenceBar } from "./presence-bar";

export function BoardView({ boardId, onOpenCard }: { boardId: string; onOpenCard: (cardId: string) => void }) {
  const { data: board, isLoading } = useBoard(boardId);
  const createList = useCreateList(boardId);
  const createCard = useCreateCard(boardId);
  const moveCard = useMoveCard(boardId);
  const moveList = useMoveList(boardId);
  const presentUserIds = useBoardSocket(boardId);

  const activeCardId = useBoardStore((s) => s.activeCardId);
  const setActiveCardId = useBoardStore((s) => s.setActiveCardId);

  const [lists, setLists] = useState<ListWithCardsDto[]>([]);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    // Seeds local, locally-mutable drag state from the query cache — not
    // simple derived state, since drag interactions diverge from `board`
    // until the move mutation settles and refetches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (board) setLists(board.lists);
  }, [board]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const activeCard = lists.flatMap((l) => l.cards).find((c) => c.id === activeCardId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "card") {
      setActiveCardId(event.active.id as string);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over) return;

    if (active.data.current?.type === "list") {
      setLists((prev) => {
        const oldIndex = prev.findIndex((l) => l.id === active.id);
        const newIndex = prev.findIndex((l) => l.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        const beforeId = reordered[newIndex - 1]?.id ?? null;
        const afterId = reordered[newIndex + 1]?.id ?? null;
        moveList.mutate({ listId: active.id as string, beforeId, afterId });
        return reordered;
      });
      return;
    }

    if (active.data.current?.type === "card") {
      const cardId = active.id as string;
      const overType = over.data.current?.type;
      const targetListId = overType === "card" ? (over.data.current!.listId as string) : (over.id as string);

      setLists((prev) => {
        const sourceListIndex = prev.findIndex((l) => l.cards.some((c) => c.id === cardId));
        const targetListIndex = prev.findIndex((l) => l.id === targetListId);
        if (sourceListIndex === -1 || targetListIndex === -1) return prev;

        const sourceList = prev[sourceListIndex];
        const card = sourceList.cards.find((c) => c.id === cardId)!;
        const withoutCard = sourceList.cards.filter((c) => c.id !== cardId);

        let targetCards = targetListIndex === sourceListIndex ? withoutCard : [...prev[targetListIndex].cards];
        let insertIndex = overType === "card" ? targetCards.findIndex((c) => c.id === over.id) : targetCards.length;
        if (insertIndex === -1) insertIndex = targetCards.length;
        targetCards = [
          ...targetCards.slice(0, insertIndex),
          { ...card, listId: targetListId },
          ...targetCards.slice(insertIndex),
        ];

        const beforeId = targetCards[insertIndex - 1]?.id ?? null;
        const afterId = targetCards[insertIndex + 1]?.id ?? null;
        moveCard.mutate({ cardId, listId: targetListId, beforeId, afterId });

        const next = [...prev];
        if (targetListIndex === sourceListIndex) {
          next[sourceListIndex] = { ...sourceList, cards: targetCards };
        } else {
          next[sourceListIndex] = { ...sourceList, cards: withoutCard };
          next[targetListIndex] = { ...prev[targetListIndex], cards: targetCards };
        }
        return next;
      });
    }
  }

  const submitNewList = () => {
    const trimmed = newListName.trim();
    if (trimmed) createList.mutate(trimmed);
    setNewListName("");
    setAddingList(false);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading board...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <h1 className="text-sm font-semibold">{board?.name}</h1>
        {board && <BoardMembersDialog boardId={boardId} workspaceId={board.workspaceId} />}
      </div>
      <PresenceBar boardId={boardId} userIds={presentUserIds} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
          {lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              onOpenCard={onOpenCard}
              onCreateCard={(listId, title) => createCard.mutate({ listId, title })}
            />
          ))}
        </SortableContext>

        <div className="w-72 shrink-0">
          {addingList ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2">
              <Input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewList();
                  if (e.key === "Escape") setAddingList(false);
                }}
                placeholder="List name"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitNewList}>
                  Add list
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingList(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-1 text-muted-foreground"
              onClick={() => setAddingList(true)}
            >
              <Plus className="size-4" /> Add list
            </Button>
          )}
        </div>
      </div>

        <DragOverlay>{activeCard ? <CardItem card={activeCard} onOpen={() => {}} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
