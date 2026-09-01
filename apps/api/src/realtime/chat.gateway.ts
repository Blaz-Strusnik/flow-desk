import { UseGuards } from "@nestjs/common";
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
  type ChannelJoinPayload,
  type ChannelLeavePayload,
  type MessageCreatedPayload,
  type MessageTypingPayload,
  type NotificationNewPayload,
  WS_EVENTS,
} from "@flowdesk/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { authenticateSocket } from "./socket-auth.util.js";
import { WsJwtGuard, type AuthenticatedSocket } from "./ws-jwt.guard.js";

function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

// See BoardsGateway for why WS gateways opt out of the global ThrottlerGuard.
@SkipThrottle()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    await authenticateSocket(client, this.jwt, this.config);
  }

  handleDisconnect(_client: AuthenticatedSocket) {
    // No channel-level presence to clean up (only board presence is tracked).
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(WS_EVENTS.CHANNEL_JOIN)
  async onChannelJoin(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: ChannelJoinPayload) {
    const channel = await this.prisma.channel.findUnique({ where: { id: body.channelId } });
    if (!channel) return;

    let membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: body.channelId, userId: client.data.userId } },
    });

    if (!membership) {
      if (channel.isPrivate) return;
      const workspaceMembership = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: client.data.userId, workspaceId: channel.workspaceId } },
      });
      if (!workspaceMembership) return;
      membership = await this.prisma.channelMember.create({
        data: { channelId: body.channelId, userId: client.data.userId },
      });
    }

    await client.join(channelRoom(body.channelId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(WS_EVENTS.CHANNEL_LEAVE)
  async onChannelLeave(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: ChannelLeavePayload) {
    await client.leave(channelRoom(body.channelId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(WS_EVENTS.MESSAGE_TYPING)
  onTyping(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { channelId: string }) {
    const payload: MessageTypingPayload = { channelId: body.channelId, userId: client.data.userId };
    client.to(channelRoom(body.channelId)).emit(WS_EVENTS.MESSAGE_TYPING, payload);
  }

  @OnEvent(WS_EVENTS.MESSAGE_CREATED)
  onMessageCreated(payload: MessageCreatedPayload) {
    this.server.to(channelRoom(payload.channelId)).emit(WS_EVENTS.MESSAGE_CREATED, payload);
  }

  @OnEvent(WS_EVENTS.NOTIFICATION_NEW)
  onNotificationNew(payload: NotificationNewPayload) {
    this.server.to(`user:${payload.userId}`).emit(WS_EVENTS.NOTIFICATION_NEW, payload);
  }
}
