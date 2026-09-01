import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BoardsGateway } from "./boards.gateway.js";
import { ChatGateway } from "./chat.gateway.js";
import { PresenceService } from "./presence.service.js";
import { WsJwtGuard } from "./ws-jwt.guard.js";

@Module({
  imports: [JwtModule.register({})],
  providers: [BoardsGateway, ChatGateway, PresenceService, WsJwtGuard],
})
export class RealtimeModule {}
