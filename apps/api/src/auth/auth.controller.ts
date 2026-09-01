import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { loginSchema, registerSchema } from "@flowdesk/shared-types";
import type { Request, Response } from "express";
import { JwtRefreshGuard } from "../common/guards/jwt-refresh.guard.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService, TokenPair } from "./auth.service.js";
import { RefreshTokenRequestUser } from "./strategies/jwt-refresh.strategy.js";

const REFRESH_COOKIE = "refresh_token";

// Decorator arguments evaluate at module-load time (env vars are already
// set by then), so this lets AUTH_THROTTLE_LIMIT relax the limit for the
// Playwright-spawned dev server without touching the production default —
// a real test suite legitimately registers more than 5 users/minute.
const AUTH_THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? 5);

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post("register")
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: { email: string; password: string; name: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens } = await this.auth.register(body.email, body.password, body.name);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens } = await this.auth.login(body.email, body.password);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshUser = req.user as RefreshTokenRequestUser;
    const tokens: TokenPair = await this.auth.refresh(refreshUser.id, refreshUser.raw);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtRefreshGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshUser = req.user as RefreshTokenRequestUser;
    await this.auth.logout(refreshUser.id, refreshUser.raw);
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.config.get<string>("NODE_ENV") === "production";
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/auth",
      maxAge: this.refreshMaxAgeMs(),
    });
  }

  private refreshMaxAgeMs(): number {
    const raw = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return Number(match[1]) * units[match[2]];
  }
}
