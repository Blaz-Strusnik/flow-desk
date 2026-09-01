import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createWorkspaceSchema, inviteWorkspaceMemberSchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { WorkspacesService } from "./workspaces.service.js";

@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: { name: string }
  ) {
    return this.workspaces.create(user.id, body.name);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Get(":workspaceId")
  @UseGuards(WorkspaceMemberGuard)
  findOne(@Param("workspaceId") workspaceId: string) {
    return this.workspaces.findOne(workspaceId);
  }

  @Patch(":workspaceId")
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  update(@Param("workspaceId") workspaceId: string, @Body() body: { name?: string }) {
    return this.workspaces.update(workspaceId, body);
  }

  @Delete(":workspaceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles("OWNER")
  remove(@Param("workspaceId") workspaceId: string) {
    return this.workspaces.delete(workspaceId);
  }

  @Get(":workspaceId/members")
  @UseGuards(WorkspaceMemberGuard)
  listMembers(@Param("workspaceId") workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Post(":workspaceId/members")
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  invite(
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodValidationPipe(inviteWorkspaceMemberSchema)) body: { email: string }
  ) {
    return this.workspaces.inviteByEmail(workspaceId, body.email);
  }
}
