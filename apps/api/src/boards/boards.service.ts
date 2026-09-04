import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, ownerId: string, name: string, background?: string) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({ data: { workspaceId, name, background } });
      await tx.boardMember.create({
        data: { boardId: board.id, userId: ownerId, role: "OWNER" },
      });
      return board;
    });
  }

  /** Every board in the workspace — workspace membership grants access to
   * all of them. The caller is already gated by WorkspaceMemberGuard.
   * `userId` is kept for symmetry with the access model / future filters. */
  async listForUserInWorkspace(workspaceId: string, _userId: string) {
    return this.prisma.board.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getDetail(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        labels: true,
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: { labels: { include: { label: true } } },
            },
          },
        },
      },
    });
    if (!board) {
      throw new NotFoundException("Board not found");
    }

    return {
      ...board,
      lists: board.lists.map((list) => ({
        ...list,
        cards: list.cards.map((card) => ({
          ...card,
          labels: card.labels.map((cl) => cl.label),
        })),
      })),
    };
  }

  async update(boardId: string, data: { name?: string; background?: string | null }) {
    return this.prisma.board.update({ where: { id: boardId }, data });
  }

  async listMembers(boardId: string) {
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Adds an existing WorkspaceMember as a BoardMember. */
  async addMember(boardId: string, userId: string, role: "EDITOR" | "VIEWER") {
    const board = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId } });

    const workspaceMembership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: board.workspaceId } },
    });
    if (!workspaceMembership) {
      throw new NotFoundException("User is not a member of this workspace");
    }

    const existing = await this.prisma.boardMember.findUnique({
      where: { userId_boardId: { userId, boardId } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this board");
    }

    return this.prisma.boardMember.create({
      data: { boardId, userId, role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }
}
