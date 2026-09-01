import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createListSchema, moveListSchema, renameListSchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { ResolveBoardFrom } from "../common/decorators/resolve-board-from.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ListsService } from "./lists.service.js";

// Every route here mutates board structure, so VIEWER-role board members
// (read-only by design) are excluded at the class level.
@Controller()
@UseGuards(JwtAuthGuard, BoardMemberGuard, RolesGuard)
@Roles("OWNER", "EDITOR")
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Post("boards/:boardId/lists")
  @ResolveBoardFrom("param")
  create(
    @Param("boardId") boardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createListSchema)) body: { name: string }
  ) {
    return this.lists.create(boardId, body.name, user.id);
  }

  @Patch("lists/:listId")
  @ResolveBoardFrom("list")
  rename(
    @Param("listId") listId: string,
    @Body(new ZodValidationPipe(renameListSchema)) body: { name: string }
  ) {
    return this.lists.rename(listId, body.name);
  }

  @Patch("lists/:listId/move")
  @ResolveBoardFrom("list")
  move(
    @Param("listId") listId: string,
    @Body(new ZodValidationPipe(moveListSchema)) body: { beforeId?: string | null; afterId?: string | null }
  ) {
    return this.lists.move(listId, body.beforeId, body.afterId);
  }

  @Delete("lists/:listId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResolveBoardFrom("list")
  remove(@Param("listId") listId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lists.delete(listId, user.id);
  }
}
