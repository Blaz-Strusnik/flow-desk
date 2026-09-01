import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { BoardsService } from "./boards.service.js";

@Controller("boards")
@UseGuards(JwtAuthGuard, BoardMemberGuard)
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get(":boardId")
  getDetail(@Param("boardId") boardId: string) {
    return this.boards.getDetail(boardId);
  }

  @Patch(":boardId")
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  update(
    @Param("boardId") boardId: string,
    @Body() body: { name?: string; background?: string | null }
  ) {
    return this.boards.update(boardId, body);
  }
}
