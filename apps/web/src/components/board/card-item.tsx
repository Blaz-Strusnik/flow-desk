"use client";

import type { BoardCardDto } from "@flowdesk/shared-types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { readableTextColor } from "@/lib/label-color";
import { cn } from "@/lib/utils";

interface CardItemProps {
  card: BoardCardDto;
  onOpen: (cardId: string) => void;
}

export function CardItem({ card, onOpen }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", listId: card.listId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      className={cn(
        "cursor-pointer gap-2 p-3 text-sm shadow-sm hover:shadow-md transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight"
              style={{ backgroundColor: label.color, color: readableTextColor(label.color) }}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <p className="font-medium leading-snug">{card.title}</p>
      {(card.startDate || card.dueDate) && (
        <Badge variant="secondary" className="w-fit gap-1 text-xs font-normal">
          <CalendarIcon className="size-3" />
          {card.startDate && card.dueDate
            ? `${format(new Date(card.startDate), "MMM d")} – ${format(new Date(card.dueDate), "MMM d")}`
            : card.dueDate
              ? format(new Date(card.dueDate), "MMM d")
              : `Starts ${format(new Date(card.startDate!), "MMM d")}`}
        </Badge>
      )}
    </Card>
  );
}
