import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  WORKSPACE_RESOLVE_KEY,
  WorkspaceResolveSource,
} from "../decorators/resolve-workspace-from.decorator.js";

/**
 * Requires the current user to have a WorkspaceMember row for the workspace
 * being accessed. Non-members get 404 (not 403) — membership existence
 * hides whether the workspace itself exists, per the access-control design.
 *
 * Resolves the effective workspaceId based on @ResolveWorkspaceFrom()
 * metadata (defaults to 'param', i.e. a literal :workspaceId route param).
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const source =
      this.reflector.getAllAndOverride<WorkspaceResolveSource>(WORKSPACE_RESOLVE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "param";

    const workspaceId = await this.resolveWorkspaceId(source, request.params);
    if (!workspaceId) {
      throw new NotFoundException("Workspace not found");
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: request.user.id, workspaceId } },
    });

    if (!membership) {
      throw new NotFoundException("Workspace not found");
    }

    request.workspaceId = workspaceId;
    request.workspaceMembership = membership;
    return true;
  }

  private async resolveWorkspaceId(
    source: WorkspaceResolveSource,
    params: Record<string, string>
  ): Promise<string | null> {
    if (source === "param") {
      return params.workspaceId ?? null;
    }
    if (source === "board") {
      if (!params.boardId) return null;
      const board = await this.prisma.board.findUnique({
        where: { id: params.boardId },
        select: { workspaceId: true },
      });
      return board?.workspaceId ?? null;
    }
    if (source === "channel") {
      if (!params.channelId) return null;
      const channel = await this.prisma.channel.findUnique({
        where: { id: params.channelId },
        select: { workspaceId: true },
      });
      return channel?.workspaceId ?? null;
    }
    return null;
  }
}
