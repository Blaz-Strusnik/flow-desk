import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createMessageSchema, listMessagesQuerySchema } from "@flowdesk/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { ChannelMemberGuard } from "../common/guards/channel-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MessagesService } from "./messages.service.js";

@Controller("channels/:channelId/messages")
@UseGuards(JwtAuthGuard, ChannelMemberGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: { cursor?: string; limit: number }
  ) {
    return this.messages.list(channelId, query.cursor, query.limit);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @Param("channelId") channelId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMessageSchema)) body: { body: string }
  ) {
    return this.messages.create(channelId, user.id, body.body);
  }
}
