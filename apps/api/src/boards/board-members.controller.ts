import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { inviteBoardMemberSchema } from "@flowdesk/shared-types";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { BoardsService } from "./boards.service.js";

@Controller("boards/:boardId/members")
@UseGuards(JwtAuthGuard, BoardMemberGuard)
export class BoardMembersController {
  constructor(private readonly boards: BoardsService) {}

  @Get()
  list(@Param("boardId") boardId: string) {
    return this.boards.listMembers(boardId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  add(
    @Param("boardId") boardId: string,
    @Body(new ZodValidationPipe(inviteBoardMemberSchema)) body: { userId: string; role: "EDITOR" | "VIEWER" }
  ) {
    return this.boards.addMember(boardId, body.userId, body.role);
  }
}
