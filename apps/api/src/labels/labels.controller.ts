import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { createLabelSchema } from "@flowdesk/shared-types";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { LabelsService } from "./labels.service.js";

@Controller("boards/:boardId/labels")
@UseGuards(JwtAuthGuard, BoardMemberGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  list(@Param("boardId") boardId: string) {
    return this.labels.list(boardId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  create(
    @Param("boardId") boardId: string,
    @Body(new ZodValidationPipe(createLabelSchema)) body: { name: string; color: string }
  ) {
    return this.labels.create(boardId, body.name, body.color);
  }

  @Delete(":labelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles("OWNER", "EDITOR")
  remove(@Param("boardId") boardId: string, @Param("labelId") labelId: string) {
    return this.labels.delete(boardId, labelId);
  }
}
