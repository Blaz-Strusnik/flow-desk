"use client";

import type { MessageTypingPayload } from "@flowdesk/shared-types";
import { WS_EVENTS } from "@flowdesk/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "./socket-provider";

const TYPING_TIMEOUT_MS = 3000;

export function useChatSocket(channelId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!socket) return;
    const timerMap = timers.current;

    const onMessageCreated = () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    };

    const onTyping = (payload: MessageTypingPayload) => {
      if (payload.channelId !== channelId) return;
      setTypingUserIds((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]));
      const existing = timerMap.get(payload.userId);
      if (existing) clearTimeout(existing);
      timerMap.set(
        payload.userId,
        setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== payload.userId));
        }, TYPING_TIMEOUT_MS)
      );
    };

    socket.emit(WS_EVENTS.CHANNEL_JOIN, { channelId });
    socket.on(WS_EVENTS.MESSAGE_CREATED, onMessageCreated);
    socket.on(WS_EVENTS.MESSAGE_TYPING, onTyping);

    return () => {
      socket.emit(WS_EVENTS.CHANNEL_LEAVE, { channelId });
      socket.off(WS_EVENTS.MESSAGE_CREATED, onMessageCreated);
      socket.off(WS_EVENTS.MESSAGE_TYPING, onTyping);
      for (const timer of timerMap.values()) clearTimeout(timer);
      timerMap.clear();
      setTypingUserIds([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, channelId]);

  const sendTyping = () => {
    socket?.emit(WS_EVENTS.MESSAGE_TYPING, { channelId });
  };

  return { typingUserIds, sendTyping };
}
