import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, creatorId: string, name: string, isPrivate: boolean) {
    const existing = await this.prisma.channel.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    if (existing) {
      throw new ConflictException("A channel with that name already exists");
    }

    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.create({ data: { workspaceId, name, isPrivate } });
      await tx.channelMember.create({ data: { channelId: channel.id, userId: creatorId } });
      return channel;
    });
  }

  /** Public channels are visible to any workspace member; private channels
   * only to those who are already a ChannelMember. */
  async listForUser(workspaceId: string, userId: string) {
    return this.prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [{ isPrivate: false }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Cascades to ChannelMember and Message via onDelete: Cascade. Channels
   * have no owner/creator field, so deletion is gated by workspace role
   * (OWNER/ADMIN) at the controller level, not per-channel ownership. */
  async delete(channelId: string) {
    await this.prisma.channel.delete({ where: { id: channelId } });
  }

  async listMembers(channelId: string) {
    return this.prisma.channelMember.findMany({
      where: { channelId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }

  /** Explicit invite — required for private channels since they have no lazy-join path. */
  async invite(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
    const workspaceMembership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
    });
    if (!workspaceMembership) {
      throw new NotFoundException("User is not a member of this workspace");
    }

    const existing = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this channel");
    }

    return this.prisma.channelMember.create({
      data: { channelId, userId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }
}
