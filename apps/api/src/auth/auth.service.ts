import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { durationFromNow, hashToken } from "./token.utils.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserView {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async register(email: string, password: string, name: string): Promise<{
    user: AuthenticatedUserView;
    tokens: TokenPair;
  }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });

    const tokens = await this.issueTokenPair(user.id, user.email);
    return { user: this.toUserView(user), tokens };
  }

  async login(email: string, password: string): Promise<{
    user: AuthenticatedUserView;
    tokens: TokenPair;
  }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const tokens = await this.issueTokenPair(user.id, user.email);
    return { user: this.toUserView(user), tokens };
  }

  async refresh(userId: string, rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.userId !== userId) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.revokedAt) {
      // Reuse of an already-rotated token: treat as compromise, kill every
      // active session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected; all sessions revoked");
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.issueTokenPair(user.id, user.email);
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
      } as JwtSignOptions
    );

    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshExpiresIn,
      } as JwtSignOptions
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: durationFromNow(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  private toUserView(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }): AuthenticatedUserView {
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }
}
