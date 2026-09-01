import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface RefreshTokenRequestUser {
  id: string;
  jti: string;
  raw: string;
}

function extractFromCookie(req: Request): string | null {
  return req.cookies?.["refresh_token"] ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshTokenRequestUser {
    const raw = extractFromCookie(req);
    if (!raw) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, jti: payload.jti, raw };
  }
}
