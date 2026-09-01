import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WS_EVENTS } from "@flowdesk/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

const DEFAULT_LIMIT = 50;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService
  ) {}

  async list(channelId: string, cursor?: string, limit = DEFAULT_LIMIT) {
    let before: Date | undefined;
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({ where: { id: cursor } });
      before = cursorMessage?.createdAt;
    }

    const messages = await this.prisma.message.findMany({
      where: { channelId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;
    return { messages: messages.reverse(), nextCursor };
  }

  async create(channelId: string, userId: string, body: string) {
    const message = await this.prisma.message.create({
      data: { channelId, userId, body },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    this.events.emit(WS_EVENTS.MESSAGE_CREATED, {
      channelId,
      messageId: message.id,
      userId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    });

    await this.notifyMentions(channelId, userId, body, message.id);

    return message;
  }

  /** Best-effort @name mention detection against the channel's members. */
  private async notifyMentions(channelId: string, senderId: string, body: string, messageId: string) {
    const matches = [...body.matchAll(/@(\w[\w-]*)/g)].map((m) => m[1].toLowerCase());
    if (matches.length === 0) return;

    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
      include: { user: { select: { id: true, name: true } } },
    });

    const mentioned = members.filter(
      (m) =>
        m.userId !== senderId &&
        matches.some((token) => m.user.name.toLowerCase().replace(/\s+/g, "") === token || m.user.name.toLowerCase().startsWith(token))
    );

    for (const member of mentioned) {
      await this.notifications.create(member.userId, "MENTION", { channelId, messageId });
    }
  }
}
