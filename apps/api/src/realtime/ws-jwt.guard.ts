import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { AccessTokenPayload } from "../auth/strategies/jwt.strategy.js";

export interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

/** Validates the access token passed via `socket.handshake.auth.token`. */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) return false;

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      client.data.userId = payload.sub;
      return true;
    } catch {
      return false;
    }
  }
}
