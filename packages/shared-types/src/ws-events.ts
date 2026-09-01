/**
 * Single source of truth for the Socket.IO event contract shared between
 * apps/api (emits) and apps/web (subscribes). Never redefine event names
 * or payload shapes ad hoc in either app — import from here.
 */

export const WS_EVENTS = {
  BOARD_JOIN: "board:join",
  BOARD_LEAVE: "board:leave",
  LIST_CREATED: "list:created",
  LIST_UPDATED: "list:updated",
  LIST_MOVED: "list:moved",
  LIST_DELETED: "list:deleted",
  CARD_CREATED: "card:created",
  CARD_UPDATED: "card:updated",
  CARD_MOVED: "card:moved",
  CARD_DELETED: "card:deleted",
  PRESENCE_JOIN: "presence:join",
  PRESENCE_LEAVE: "presence:leave",
  PRESENCE_STATE: "presence:state",
  CHANNEL_JOIN: "channel:join",
  CHANNEL_LEAVE: "channel:leave",
  MESSAGE_CREATED: "message:created",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_TYPING: "message:typing",
  NOTIFICATION_NEW: "notification:new",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export interface BoardJoinPayload {
  boardId: string;
}

export interface BoardLeavePayload {
  boardId: string;
}

export interface ListEventPayload {
  boardId: string;
  listId: string;
}

export interface ListMovedPayload extends ListEventPayload {
  position: number;
}

export interface CardEventPayload {
  boardId: string;
  listId: string;
  cardId: string;
}

export interface CardMovedPayload extends CardEventPayload {
  position: number;
  movedBy: string;
}

export interface PresencePayload {
  boardId: string;
  userId: string;
}

export interface PresenceStatePayload {
  boardId: string;
  userIds: string[];
}

export interface ChannelJoinPayload {
  channelId: string;
}

export interface ChannelLeavePayload {
  channelId: string;
}

export interface MessageCreatedPayload {
  channelId: string;
  messageId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface MessageTypingPayload {
  channelId: string;
  userId: string;
}

export interface NotificationNewPayload {
  notificationId: string;
  userId: string;
  type: string;
}
