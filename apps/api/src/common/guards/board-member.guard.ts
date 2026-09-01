import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service.js";
import { BOARD_RESOLVE_KEY, BoardResolveSource } from "../decorators/resolve-board-from.decorator.js";

/**
 * Requires the current user to have a BoardMember row for the board being
 * accessed — the second access-control layer beyond workspace membership.
 * Non-members get 404, matching WorkspaceMemberGuard's leakage policy.
 *
 * A single guard class serves board/list/card routes alike by resolving
 * the effective boardId per @ResolveBoardFrom() metadata:
 *  - 'param': board.id === :boardId
 *  - 'list':  resolve list.boardId from :listId
 *  - 'card':  resolve card.list.boardId from :cardId
 */
@Injectable()
export class BoardMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const source =
      this.reflector.getAllAndOverride<BoardResolveSource>(BOARD_RESOLVE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "param";

    const boardId = await this.resolveBoardId(source, request.params);
    if (!boardId) {
      throw new NotFoundException("Board not found");
    }

    const membership = await this.prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: request.user.id, boardId } },
    });

    if (!membership) {
      throw new NotFoundException("Board not found");
    }

    request.boardId = boardId;
    request.boardMembership = membership;
    return true;
  }

  private async resolveBoardId(
    source: BoardResolveSource,
    params: Record<string, string>
  ): Promise<string | null> {
    if (source === "param") {
      return params.boardId ?? null;
    }
    if (source === "list") {
      if (!params.listId) return null;
      const list = await this.prisma.list.findUnique({
        where: { id: params.listId },
        select: { boardId: true },
      });
      return list?.boardId ?? null;
    }
    if (source === "card") {
      if (!params.cardId) return null;
      const card = await this.prisma.card.findUnique({
        where: { id: params.cardId },
        select: { list: { select: { boardId: true } } },
      });
      return card?.list.boardId ?? null;
    }
    return null;
  }
}
