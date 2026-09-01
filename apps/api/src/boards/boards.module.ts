import { Module } from "@nestjs/common";
import { BoardMembersController } from "./board-members.controller.js";
import { BoardsController } from "./boards.controller.js";
import { BoardsService } from "./boards.service.js";
import { WorkspaceBoardsController } from "./workspace-boards.controller.js";

@Module({
  controllers: [WorkspaceBoardsController, BoardsController, BoardMembersController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
