import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  assignCardMemberSchema,
  attachLabelSchema,
  createCardSchema,
  moveCardSchema,
  updateCardSchema,
} from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { ResolveBoardFrom } from "../common/decorators/resolve-board-from.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { CardsService } from "./cards.service.js";

@Controller()
@UseGuards(JwtAuthGuard, BoardMemberGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post("lists/:listId/cards")
  @ResolveBoardFrom("list")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  create(
    @Param("listId") listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCardSchema)) body: { title: string }
  ) {
    return this.cards.create(listId, body.title, user.id);
  }

  @Get("cards/:cardId")
  @ResolveBoardFrom("card")
  getDetail(@Param("cardId") cardId: string) {
    return this.cards.getDetail(cardId);
  }

  @Patch("cards/:cardId")
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  update(
    @Param("cardId") cardId: string,
    @Body(new ZodValidationPipe(updateCardSchema))
    body: {
      title?: string;
      description?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      coverColor?: string | null;
    }
  ) {
    return this.cards.update(cardId, body);
  }

  @Delete("cards/:cardId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  remove(@Param("cardId") cardId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cards.delete(cardId, user.id);
  }

  @Patch("cards/:cardId/move")
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  move(
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(moveCardSchema))
    body: { listId: string; beforeId?: string | null; afterId?: string | null }
  ) {
    return this.cards.move(cardId, body.listId, user.id, body.beforeId, body.afterId);
  }

  @Post("cards/:cardId/members")
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  assignMember(
    @Param("cardId") cardId: string,
    @Body(new ZodValidationPipe(assignCardMemberSchema)) body: { userId: string }
  ) {
    return this.cards.assignMember(cardId, body.userId);
  }

  @Delete("cards/:cardId/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  unassignMember(@Param("cardId") cardId: string, @Param("userId") userId: string) {
    return this.cards.unassignMember(cardId, userId);
  }

  @Post("cards/:cardId/labels")
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  attachLabel(
    @Param("cardId") cardId: string,
    @Body(new ZodValidationPipe(attachLabelSchema)) body: { labelId: string }
  ) {
    return this.cards.attachLabel(cardId, body.labelId);
  }

  @Delete("cards/:cardId/labels/:labelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResolveBoardFrom("card")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  detachLabel(@Param("cardId") cardId: string, @Param("labelId") labelId: string) {
    return this.cards.detachLabel(cardId, labelId);
  }
}
