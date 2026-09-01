import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AccessTokenPayload } from "../auth/strategies/jwt.strategy.js";
import type { AuthenticatedSocket } from "./ws-jwt.guard.js";

/** Shared connection-time auth for gateways: verifies the access token from
 * `socket.handshake.auth.token`, disconnecting the socket if invalid, and
 * joins the socket to its personal `user:{userId}` room for out-of-band
 * events like notifications. Returns the authenticated userId, or null if
 * the socket was disconnected. */
export async function authenticateSocket(
  client: AuthenticatedSocket,
  jwt: JwtService,
  config: ConfigService
): Promise<string | null> {
  const token = client.handshake.auth?.token as string | undefined;
  if (!token) {
    client.disconnect();
    return null;
  }
  try {
    const payload = await jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
    client.data.userId = payload.sub;
    await client.join(`user:${payload.sub}`);
    return payload.sub;
  } catch {
    client.disconnect();
    return null;
  }
}
