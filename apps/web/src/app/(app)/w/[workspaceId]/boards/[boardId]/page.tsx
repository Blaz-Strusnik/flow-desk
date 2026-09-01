"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BoardView } from "@/components/board/board-view";
import { CardDetailModal } from "@/components/board/card-detail-modal";

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("card");

  const openCard = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("card", id);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  const closeCard = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("card");
    const query = next.toString();
    router.push(query ? `?${query}` : "?", { scroll: false });
  };

  return (
    <>
      <BoardView boardId={params.boardId} onOpenCard={openCard} />
      {cardId && <CardDetailModal cardId={cardId} boardId={params.boardId} onClose={closeCard} />}
    </>
  );
}
