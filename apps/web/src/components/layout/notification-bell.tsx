"use client";

import { WS_EVENTS } from "@flowdesk/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarkAllNotificationsRead, useNotifications } from "@/hooks/use-notifications";
import { useSocket } from "@/lib/socket/socket-provider";

function describe(type: string): string {
  switch (type) {
    case "CARD_ASSIGNED":
      return "You were assigned to a card";
    case "CARD_COMMENT":
      return "New comment on a card you're assigned to";
    case "CARD_DUE_SOON":
      return "A card you're assigned to is due soon";
    case "MENTION":
      return "You were mentioned in a message";
    case "CHANNEL_INVITE":
      return "You were added to a channel";
    case "WORKSPACE_INVITE":
      return "You were added to a workspace";
    default:
      return "New notification";
  }
}

export function NotificationBell() {
  const { data: notifications } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const onNew = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
    socket.on(WS_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(WS_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [socket, queryClient]);

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications?.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {notifications?.map((n) => (
            <div key={n.id} className={`border-b p-3 text-sm ${n.readAt ? "opacity-60" : ""}`}>
              {describe(n.type)}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
