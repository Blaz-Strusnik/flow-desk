import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getPositionBetween, PositionGapExhaustedError, rebalancePositions, WS_EVENTS } from "@flowdesk/shared-types";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService
  ) {}

  async create(listId: string, title: string, actorId: string) {
    const list = await this.prisma.list.findUniqueOrThrow({ where: { id: listId }, select: { boardId: true } });
    const last = await this.prisma.card.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
    });
    const position = getPositionBetween(last?.position ?? null, null);
    const card = await this.prisma.card.create({ data: { listId, title, position } });
    this.events.emit(WS_EVENTS.CARD_CREATED, {
      boardId: list.boardId,
      listId,
      cardId: card.id,
      title: card.title,
      position: card.position,
      actorId,
    });
    return card;
  }

  async getDetail(cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: {
        labels: { include: { label: true } },
        members: { include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
        comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!card) {
      throw new NotFoundException("Card not found");
    }

    return {
      ...card,
      labels: card.labels.map((cl) => cl.label),
      members: card.members.map((cm) => cm.user),
    };
  }

  async update(
    cardId: string,
    data: { title?: string; description?: string | null; dueDate?: string | null; coverColor?: string | null }
  ) {
    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: { ...data, dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null },
      include: { list: { select: { boardId: true } } },
    });
    this.events.emit(WS_EVENTS.CARD_UPDATED, { boardId: card.list.boardId, listId: card.listId, cardId: card.id });
    return card;
  }

  async delete(cardId: string, actorId: string) {
    const card = await this.prisma.card.delete({
      where: { id: cardId },
      include: { list: { select: { boardId: true } } },
    });
    this.events.emit(WS_EVENTS.CARD_DELETED, {
      boardId: card.list.boardId,
      listId: card.listId,
      cardId: card.id,
      actorId,
    });
  }

  async move(
    cardId: string,
    targetListId: string,
    movedBy: string,
    beforeId?: string | null,
    afterId?: string | null
  ) {
    const [before, after] = await Promise.all([
      beforeId ? this.prisma.card.findUnique({ where: { id: beforeId } }) : null,
      afterId ? this.prisma.card.findUnique({ where: { id: afterId } }) : null,
    ]);

    try {
      const position = getPositionBetween(before?.position ?? null, after?.position ?? null);
      const card = await this.prisma.card.update({
        where: { id: cardId },
        data: { listId: targetListId, position },
        include: { list: { select: { boardId: true } } },
      });
      this.events.emit(WS_EVENTS.CARD_MOVED, {
        boardId: card.list.boardId,
        listId: targetListId,
        cardId: card.id,
        position: card.position,
        movedBy,
      });
      return card;
    } catch (err) {
      if (err instanceof PositionGapExhaustedError) {
        return this.rebalanceAndMove(cardId, targetListId, movedBy, beforeId ?? null, afterId ?? null);
      }
      throw err;
    }
  }

  private async rebalanceAndMove(
    cardId: string,
    targetListId: string,
    movedBy: string,
    beforeId: string | null,
    afterId: string | null
  ) {
    // Move the card into the target list first (uncontested position), then
    // rebalance the target list's full card order in one transaction.
    await this.prisma.card.update({ where: { id: cardId }, data: { listId: targetListId } });

    const [cards, targetList] = await Promise.all([
      this.prisma.card.findMany({ where: { listId: targetListId }, orderBy: { position: "asc" } }),
      this.prisma.list.findUniqueOrThrow({ where: { id: targetListId }, select: { boardId: true } }),
    ]);
    const moved = cards.find((c) => c.id === cardId);
    const rest = cards.filter((c) => c.id !== cardId);

    const insertIndex = afterId
      ? rest.findIndex((c) => c.id === afterId)
      : beforeId
        ? rest.findIndex((c) => c.id === beforeId) + 1
        : rest.length;

    const ordered = moved ? [...rest.slice(0, insertIndex), moved, ...rest.slice(insertIndex)] : rest;
    const rebalanced = rebalancePositions(ordered);

    await this.prisma.$transaction(
      rebalanced.map((item) =>
        this.prisma.card.update({ where: { id: item.id }, data: { position: item.position } })
      )
    );

    const result = rebalanced.find((item) => item.id === cardId);
    if (result) {
      this.events.emit(WS_EVENTS.CARD_MOVED, {
        boardId: targetList.boardId,
        listId: targetListId,
        cardId: result.id,
        position: result.position,
        movedBy,
      });
    }
    return result;
  }

  async addComment(cardId: string, userId: string, body: string) {
    const comment = await this.prisma.comment.create({
      data: { cardId, userId, body },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    const card = await this.prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { list: { select: { boardId: true } }, members: true },
    });
    this.events.emit(WS_EVENTS.CARD_UPDATED, { boardId: card.list.boardId, listId: card.listId, cardId });

    for (const member of card.members) {
      if (member.userId !== userId) {
        await this.notifications.create(member.userId, "CARD_COMMENT", { cardId, commentId: comment.id });
      }
    }

    return comment;
  }

  async assignMember(cardId: string, userId: string) {
    const membership = await this.prisma.cardMember.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
    await this.notifications.create(userId, "CARD_ASSIGNED", { cardId });
    return membership;
  }

  async unassignMember(cardId: string, userId: string) {
    await this.prisma.cardMember.delete({ where: { cardId_userId: { cardId, userId } } }).catch(() => {});
  }

  async attachLabel(cardId: string, labelId: string) {
    return this.prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
  }

  async detachLabel(cardId: string, labelId: string) {
    await this.prisma.cardLabel.delete({ where: { cardId_labelId: { cardId, labelId } } }).catch(() => {});
  }
}
