import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

function buildConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    JWT_ACCESS_SECRET: "access-secret",
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_SECRET: "refresh-secret",
    JWT_REFRESH_EXPIRES_IN: "7d",
    ...overrides,
  };
  return {
    get: vi.fn((key: string, fallback?: string) => values[key] ?? fallback),
    getOrThrow: vi.fn((key: string) => {
      if (!(key in values)) throw new Error(`missing config: ${key}`);
      return values[key];
    }),
  };
}

function buildPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buildJwt() {
  let counter = 0;
  return {
    // Distinct output per call so token-equality assertions are meaningful.
    signAsync: vi.fn(async () => `token-${++counter}`),
  };
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let jwt: ReturnType<typeof buildJwt>;
  let config: ReturnType<typeof buildConfig>;
  let service: AuthService;

  beforeEach(() => {
    prisma = buildPrisma();
    jwt = buildJwt();
    config = buildConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma as any, jwt as any, config as any);
  });

  describe("register", () => {
    it("creates a user, hashes the password, and issues a token pair", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        avatarUrl: null,
        passwordHash: "irrelevant-in-this-mock",
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register("alice@example.com", "password123", "Alice");

      expect(result.user).toEqual({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        avatarUrl: null,
      });
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      // The stored password must not be the plaintext.
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe("password123");
    });

    it("throws ConflictException when the email is already registered", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(service.register("alice@example.com", "password123", "Alice")).rejects.toThrow(
        ConflictException
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("rejects a non-existent email without revealing whether the account exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login("nobody@example.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("rejects an incorrect password", async () => {
      const argon2 = await import("argon2");
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        avatarUrl: null,
        passwordHash: await argon2.hash("correct-password"),
      });

      await expect(service.login("alice@example.com", "wrong-password")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("issues a token pair for correct credentials", async () => {
      const argon2 = await import("argon2");
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        avatarUrl: null,
        passwordHash: await argon2.hash("correct-password"),
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login("alice@example.com", "correct-password");
      expect(result.user.id).toBe("user-1");
      expect(result.tokens.accessToken).toBeTruthy();
    });
  });

  describe("refresh", () => {
    it("rotates the refresh token and issues a new pair for a valid, unrevoked token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        tokenHash: "hash",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "alice@example.com",
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.refresh("user-1", "raw-refresh-token");

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tokens.accessToken).toBeTruthy();
    });

    it("rejects a token that doesn't belong to the calling user", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "someone-else",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh("user-1", "raw-refresh-token")).rejects.toThrow(UnauthorizedException);
    });

    it("detects reuse of an already-revoked token and revokes every active session", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.refresh("user-1", "raw-refresh-token")).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("rejects an expired refresh token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh("user-1", "raw-refresh-token")).rejects.toThrow(UnauthorizedException);
    });
  });
});
