import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name, ownerId } });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: ownerId, role: "OWNER" },
      });
      return workspace;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }

  async update(workspaceId: string, data: { name?: string }) {
    return this.prisma.workspace.update({ where: { id: workspaceId }, data });
  }

  /** Cascades to boards/lists/cards/labels/channels/messages/members via the
   * onDelete: Cascade relations already declared on those models. */
  async delete(workspaceId: string) {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async inviteByEmail(workspaceId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException("No user with that email is registered yet");
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this workspace");
    }

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: "MEMBER" },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }
}
