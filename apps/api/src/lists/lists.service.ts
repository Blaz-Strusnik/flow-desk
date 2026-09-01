import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getPositionBetween, PositionGapExhaustedError, rebalancePositions, WS_EVENTS } from "@flowdesk/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2
  ) {}

  async create(boardId: string, name: string, actorId: string) {
    const last = await this.prisma.list.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
    });
    const position = getPositionBetween(last?.position ?? null, null);
    const list = await this.prisma.list.create({ data: { boardId, name, position } });
    this.events.emit(WS_EVENTS.LIST_CREATED, {
      boardId,
      listId: list.id,
      name: list.name,
      position: list.position,
      actorId,
    });
    return list;
  }

  async rename(listId: string, name: string) {
    const list = await this.prisma.list.update({ where: { id: listId }, data: { name } });
    this.events.emit(WS_EVENTS.LIST_UPDATED, { boardId: list.boardId, listId: list.id, name: list.name });
    return list;
  }

  async delete(listId: string, actorId: string) {
    const list = await this.prisma.list.delete({ where: { id: listId } });
    this.events.emit(WS_EVENTS.LIST_DELETED, { boardId: list.boardId, listId: list.id, actorId });
  }

  async move(listId: string, beforeId?: string | null, afterId?: string | null) {
    const current = await this.prisma.list.findUniqueOrThrow({ where: { id: listId } });
    const [before, after] = await Promise.all([
      beforeId ? this.prisma.list.findUnique({ where: { id: beforeId } }) : null,
      afterId ? this.prisma.list.findUnique({ where: { id: afterId } }) : null,
    ]);

    try {
      const position = getPositionBetween(before?.position ?? null, after?.position ?? null);
      const list = await this.prisma.list.update({ where: { id: listId }, data: { position } });
      this.events.emit(WS_EVENTS.LIST_MOVED, { boardId: list.boardId, listId: list.id, position: list.position });
      return list;
    } catch (err) {
      if (err instanceof PositionGapExhaustedError) {
        return this.rebalanceAndMove(current.boardId, listId, beforeId ?? null, afterId ?? null);
      }
      throw err;
    }
  }

  private async rebalanceAndMove(
    boardId: string,
    listId: string,
    beforeId: string | null,
    afterId: string | null
  ) {
    const lists = await this.prisma.list.findMany({ where: { boardId }, orderBy: { position: "asc" } });
    const moved = lists.find((l) => l.id === listId);
    const rest = lists.filter((l) => l.id !== listId);

    const insertIndex = afterId
      ? rest.findIndex((l) => l.id === afterId)
      : beforeId
        ? rest.findIndex((l) => l.id === beforeId) + 1
        : rest.length;

    const ordered = moved
      ? [...rest.slice(0, insertIndex), moved, ...rest.slice(insertIndex)]
      : rest;
    const rebalanced = rebalancePositions(ordered);

    await this.prisma.$transaction(
      rebalanced.map((item) =>
        this.prisma.list.update({ where: { id: item.id }, data: { position: item.position } })
      )
    );

    const result = rebalanced.find((item) => item.id === listId);
    if (result) {
      this.events.emit(WS_EVENTS.LIST_MOVED, { boardId, listId: result.id, position: result.position });
    }
    return result;
  }
}
