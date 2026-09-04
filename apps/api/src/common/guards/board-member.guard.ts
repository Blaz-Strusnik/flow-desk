import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service.js";
import { resolveBoardAccess } from "../board-access.util.js";
import { BOARD_RESOLVE_KEY, BoardResolveSource } from "../decorators/resolve-board-from.decorator.js";

/**
 * Grants access to a board when the current user is a member of its
 * workspace (implicit access to every board) or has an explicit
 * BoardMember row that overrides the derived role. Users with neither
 * get 404, matching WorkspaceMemberGuard's leakage policy.
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

    const access = await resolveBoardAccess(this.prisma, request.user.id, boardId);
    if (!access) {
      throw new NotFoundException("Board not found");
    }

    request.boardId = boardId;
    request.boardMembership = { role: access.role, source: access.source };
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
