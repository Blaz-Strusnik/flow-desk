import { Module } from "@nestjs/common";
import { ChannelMembersController } from "./channel-members.controller.js";
import { ChannelsService } from "./channels.service.js";
import { WorkspaceChannelsController } from "./channels.controller.js";

@Module({
  controllers: [WorkspaceChannelsController, ChannelMembersController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
