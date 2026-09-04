import { Logger, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import { SkipThrottle } from "@nestjs/throttler";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server } from "socket.io";
import {
  type BoardJoinPayload,
  type BoardLeavePayload,
  type CardEventPayload,
  type CardMovedPayload,
  type ListEventPayload,
  type ListMovedPayload,
  WS_EVENTS,
} from "@flowdesk/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { resolveBoardAccess } from "../common/board-access.util.js";
import { PresenceService } from "./presence.service.js";
import { authenticateSocket } from "./socket-auth.util.js";
import { WsJwtGuard, type AuthenticatedSocket } from "./ws-jwt.guard.js";

function boardRoom(boardId: string): string {
  return `board:${boardId}`;
}

// The global ThrottlerGuard (APP_GUARD) is HTTP-oriented (expects a
// Response-like object with .header()) and errors when it runs against a
// WS execution context, so gateways opt out of it entirely.
@SkipThrottle()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", credentials: true } })
export class BoardsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BoardsGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    await authenticateSocket(client, this.jwt, this.config);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const departures = this.presence.leaveAll(client.id);
    for (const { boardId, userId } of departures) {
      this.server.to(boardRoom(boardId)).emit(WS_EVENTS.PRESENCE_LEAVE, { boardId, userId });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(WS_EVENTS.BOARD_JOIN)
  async onBoardJoin(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: BoardJoinPayload) {
    const access = await resolveBoardAccess(this.prisma, client.data.userId, body.boardId);
    if (!access) {
      return;
    }

    await client.join(boardRoom(body.boardId));
    const isNewUser = this.presence.join(body.boardId, client.data.userId, client.id);

    client.emit(WS_EVENTS.PRESENCE_STATE, {
      boardId: body.boardId,
      userIds: this.presence.getUsers(body.boardId),
    });

    if (isNewUser) {
      client.to(boardRoom(body.boardId)).emit(WS_EVENTS.PRESENCE_JOIN, {
        boardId: body.boardId,
        userId: client.data.userId,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(WS_EVENTS.BOARD_LEAVE)
  async onBoardLeave(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: BoardLeavePayload) {
    await client.leave(boardRoom(body.boardId));
    const left = this.presence.leave(body.boardId, client.data.userId, client.id);
    if (left) {
      this.server.to(boardRoom(body.boardId)).emit(WS_EVENTS.PRESENCE_LEAVE, {
        boardId: body.boardId,
        userId: client.data.userId,
      });
    }
  }

  @OnEvent(WS_EVENTS.LIST_CREATED)
  onListCreated(payload: ListEventPayload & Record<string, unknown>) {
    this.broadcast(payload.boardId, WS_EVENTS.LIST_CREATED, payload);
  }

  @OnEvent(WS_EVENTS.LIST_UPDATED)
  onListUpdated(payload: ListEventPayload & Record<string, unknown>) {
    this.broadcast(payload.boardId, WS_EVENTS.LIST_UPDATED, payload);
  }

  @OnEvent(WS_EVENTS.LIST_MOVED)
  onListMoved(payload: ListMovedPayload) {
    this.broadcast(payload.boardId, WS_EVENTS.LIST_MOVED, payload);
  }

  @OnEvent(WS_EVENTS.LIST_DELETED)
  onListDeleted(payload: ListEventPayload) {
    this.broadcast(payload.boardId, WS_EVENTS.LIST_DELETED, payload);
  }

  @OnEvent(WS_EVENTS.CARD_CREATED)
  onCardCreated(payload: CardEventPayload & Record<string, unknown>) {
    this.broadcast(payload.boardId, WS_EVENTS.CARD_CREATED, payload);
  }

  @OnEvent(WS_EVENTS.CARD_UPDATED)
  onCardUpdated(payload: CardEventPayload & Record<string, unknown>) {
    this.broadcast(payload.boardId, WS_EVENTS.CARD_UPDATED, payload);
  }

  @OnEvent(WS_EVENTS.CARD_MOVED)
  onCardMoved(payload: CardMovedPayload) {
    this.broadcast(payload.boardId, WS_EVENTS.CARD_MOVED, payload);
  }

  @OnEvent(WS_EVENTS.CARD_DELETED)
  onCardDeleted(payload: CardEventPayload) {
    this.broadcast(payload.boardId, WS_EVENTS.CARD_DELETED, payload);
  }

  private broadcast(boardId: string, event: string, payload: unknown) {
    this.server.to(boardRoom(boardId)).emit(event, payload);
  }
}
