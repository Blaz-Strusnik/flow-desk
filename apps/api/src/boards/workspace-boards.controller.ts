import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createBoardSchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { BoardsService } from "./boards.service.js";

@Controller("workspaces/:workspaceId/boards")
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class WorkspaceBoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBoardSchema)) body: { name: string; background?: string }
  ) {
    return this.boards.create(workspaceId, user.id, body.name, body.background);
  }

  @Get()
  listMine(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.boards.listForUserInWorkspace(workspaceId, user.id);
  }
}
