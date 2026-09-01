import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { createCommentSchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { ResolveBoardFrom } from "../common/decorators/resolve-board-from.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { CardsService } from "./cards.service.js";

@Controller("cards/:cardId/comments")
@UseGuards(JwtAuthGuard, BoardMemberGuard, RolesGuard)
@ResolveBoardFrom("card")
@Roles("OWNER", "EDITOR")
export class CommentsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  create(
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCommentSchema)) body: { body: string }
  ) {
    return this.cards.addComment(cardId, user.id, body.body);
  }
}
