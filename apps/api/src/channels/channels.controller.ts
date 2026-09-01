import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { createChannelSchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ChannelsService } from "./channels.service.js";

@Controller("workspaces/:workspaceId/channels")
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class WorkspaceChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post()
  create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createChannelSchema)) body: { name: string; isPrivate: boolean }
  ) {
    return this.channels.create(workspaceId, user.id, body.name, body.isPrivate);
  }

  @Get()
  list(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.channels.listForUser(workspaceId, user.id);
  }

  @Delete(":channelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles("OWNER", "ADMIN")
  remove(@Param("channelId") channelId: string) {
    return this.channels.delete(channelId);
  }
}
