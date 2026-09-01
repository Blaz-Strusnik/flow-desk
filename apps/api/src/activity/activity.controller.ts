import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { ActivityService } from "./activity.service.js";

@Controller("boards/:boardId/activity")
@UseGuards(JwtAuthGuard, BoardMemberGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Param("boardId") boardId: string) {
    return this.activity.listForBoard(boardId);
  }
}
