"use client";

import type { PresenceStatePayload } from "@flowdesk/shared-types";
import { WS_EVENTS } from "@flowdesk/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSocket } from "./socket-provider";

/**
 * Joins the given board's realtime room for the lifetime of the calling
 * component, invalidates the board query on any card/list change events
 * (simplest correct reconciliation — the board view already re-syncs its
 * local drag state from the query cache), and returns the live set of
 * present userIds for presence avatars.
 */
export function useBoardSocket(boardId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["board", boardId] });

    const onPresenceState = (payload: PresenceStatePayload) => {
      if (payload.boardId === boardId) setPresentUserIds(payload.userIds);
    };
    const onPresenceJoin = (payload: { boardId: string; userId: string }) => {
      if (payload.boardId === boardId) {
        setPresentUserIds((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]));
      }
    };
    const onPresenceLeave = (payload: { boardId: string; userId: string }) => {
      if (payload.boardId === boardId) {
        setPresentUserIds((prev) => prev.filter((id) => id !== payload.userId));
      }
    };

    socket.emit(WS_EVENTS.BOARD_JOIN, { boardId });
    socket.on(WS_EVENTS.PRESENCE_STATE, onPresenceState);
    socket.on(WS_EVENTS.PRESENCE_JOIN, onPresenceJoin);
    socket.on(WS_EVENTS.PRESENCE_LEAVE, onPresenceLeave);
    socket.on(WS_EVENTS.LIST_CREATED, invalidate);
    socket.on(WS_EVENTS.LIST_UPDATED, invalidate);
    socket.on(WS_EVENTS.LIST_MOVED, invalidate);
    socket.on(WS_EVENTS.LIST_DELETED, invalidate);
    socket.on(WS_EVENTS.CARD_CREATED, invalidate);
    socket.on(WS_EVENTS.CARD_UPDATED, invalidate);
    socket.on(WS_EVENTS.CARD_MOVED, invalidate);
    socket.on(WS_EVENTS.CARD_DELETED, invalidate);

    return () => {
      socket.emit(WS_EVENTS.BOARD_LEAVE, { boardId });
      socket.off(WS_EVENTS.PRESENCE_STATE, onPresenceState);
      socket.off(WS_EVENTS.PRESENCE_JOIN, onPresenceJoin);
      socket.off(WS_EVENTS.PRESENCE_LEAVE, onPresenceLeave);
      socket.off(WS_EVENTS.LIST_CREATED, invalidate);
      socket.off(WS_EVENTS.LIST_UPDATED, invalidate);
      socket.off(WS_EVENTS.LIST_MOVED, invalidate);
      socket.off(WS_EVENTS.LIST_DELETED, invalidate);
      socket.off(WS_EVENTS.CARD_CREATED, invalidate);
      socket.off(WS_EVENTS.CARD_UPDATED, invalidate);
      socket.off(WS_EVENTS.CARD_MOVED, invalidate);
      socket.off(WS_EVENTS.CARD_DELETED, invalidate);
      setPresentUserIds([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, boardId]);

  return presentUserIds;
}
