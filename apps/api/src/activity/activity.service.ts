import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WS_EVENTS } from "@flowdesk/shared-types";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

interface BoardActivityEvent {
  boardId: string;
  actorId?: string;
  listId?: string;
  cardId?: string;
  [key: string]: unknown;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForBoard(boardId: string) {
    return this.prisma.activityLog.findMany({
      where: { boardId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  private record(
    boardId: string,
    actorId: string | undefined,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ) {
    if (!actorId) return; // events without an acting user (e.g. legacy paths) aren't audited
    void this.prisma.activityLog
      .create({
        data: { boardId, actorId, action, targetType, targetId, metadata: metadata as Prisma.InputJsonValue },
      })
      .catch((err) => this.logger.error("Failed to record activity log entry", err));
  }

  @OnEvent(WS_EVENTS.LIST_CREATED)
  onListCreated(e: BoardActivityEvent) {
    this.record(e.boardId, e.actorId, "created", "list", e.listId!, { name: e.name });
  }

  @OnEvent(WS_EVENTS.LIST_DELETED)
  onListDeleted(e: BoardActivityEvent) {
    this.record(e.boardId, e.actorId, "deleted", "list", e.listId!);
  }

  @OnEvent(WS_EVENTS.CARD_CREATED)
  onCardCreated(e: BoardActivityEvent) {
    this.record(e.boardId, e.actorId, "created", "card", e.cardId!, { title: e.title });
  }

  @OnEvent(WS_EVENTS.CARD_MOVED)
  onCardMoved(e: BoardActivityEvent & { movedBy?: string }) {
    this.record(e.boardId, e.movedBy, "moved", "card", e.cardId!, { listId: e.listId });
  }

  @OnEvent(WS_EVENTS.CARD_DELETED)
  onCardDeleted(e: BoardActivityEvent) {
    this.record(e.boardId, e.actorId, "deleted", "card", e.cardId!);
  }
}
