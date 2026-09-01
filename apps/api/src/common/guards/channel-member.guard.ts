import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  CHANNEL_RESOLVE_KEY,
  ChannelResolveSource,
} from "../decorators/resolve-channel-from.decorator.js";

/**
 * Requires the current user to have (or be able to lazily obtain) a
 * ChannelMember row for the channel being accessed.
 *
 * - Public channels: any WorkspaceMember of the channel's workspace is
 *   lazily granted a ChannelMember row on first access (
 *   public channels are freely joinable within a workspace).
 * - Private channels: require an existing ChannelMember row (explicit
 *   invite) — no lazy join.
 *
 * Non-members/non-existent channels get 404, matching the guard suite's
 * leakage policy.
 */
@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const source =
      this.reflector.getAllAndOverride<ChannelResolveSource>(CHANNEL_RESOLVE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "param";

    const channelId = await this.resolveChannelId(source, request.params);
    if (!channelId) {
      throw new NotFoundException("Channel not found");
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    let membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: request.user.id } },
    });

    if (!membership) {
      if (channel.isPrivate) {
        throw new NotFoundException("Channel not found");
      }

      const workspaceMembership = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: request.user.id, workspaceId: channel.workspaceId } },
      });
      if (!workspaceMembership) {
        throw new NotFoundException("Channel not found");
      }

      membership = await this.prisma.channelMember.create({
        data: { channelId, userId: request.user.id },
      });
    }

    request.channelId = channelId;
    request.channelMembership = membership;
    return true;
  }

  private async resolveChannelId(
    source: ChannelResolveSource,
    params: Record<string, string>
  ): Promise<string | null> {
    if (source === "param") {
      return params.channelId ?? null;
    }
    if (source === "message") {
      if (!params.messageId) return null;
      const message = await this.prisma.message.findUnique({
        where: { id: params.messageId },
        select: { channelId: true },
      });
      return message?.channelId ?? null;
    }
    return null;
  }
}
