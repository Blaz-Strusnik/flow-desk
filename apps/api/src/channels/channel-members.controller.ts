import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ChannelMemberGuard } from "../common/guards/channel-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ChannelsService } from "./channels.service.js";

const inviteChannelMemberSchema = z.object({ userId: z.string() });

@Controller("channels/:channelId/members")
@UseGuards(JwtAuthGuard, ChannelMemberGuard)
export class ChannelMembersController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@Param("channelId") channelId: string) {
    return this.channels.listMembers(channelId);
  }

  @Post()
  invite(
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(inviteChannelMemberSchema)) body: { userId: string }
  ) {
    return this.channels.invite(channelId, body.userId);
  }
}
