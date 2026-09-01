import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesService } from "./messages.service.js";

function buildPrisma() {
  return {
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    channelMember: {
      findMany: vi.fn(),
    },
  };
}

function makeMessage(id: string, createdAt: Date) {
  return { id, createdAt, channelId: "channel-1", userId: "user-1", body: id };
}

describe("MessagesService.list (cursor pagination)", () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: MessagesService;

  beforeEach(() => {
    prisma = buildPrisma();
    const events = { emit: vi.fn() };
    const notifications = { create: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new MessagesService(prisma as any, events as any, notifications as any);
  });

  it("returns a full page in chronological (ascending) order with a nextCursor when the page is full", async () => {
    // Prisma returns newest-first (desc); the service must reverse it.
    const now = Date.now();
    prisma.message.findMany.mockResolvedValue([
      makeMessage("m3", new Date(now)),
      makeMessage("m2", new Date(now - 1000)),
      makeMessage("m1", new Date(now - 2000)),
    ]);

    const result = await service.list("channel-1", undefined, 3);

    expect(result.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    // A full page (length === limit) implies there may be more before it.
    expect(result.nextCursor).toBe("m1");
  });

  it("returns nextCursor: null when fewer messages than the limit come back (end of history)", async () => {
    prisma.message.findMany.mockResolvedValue([makeMessage("m1", new Date())]);

    const result = await service.list("channel-1", undefined, 10);

    expect(result.nextCursor).toBeNull();
  });

  it("uses the cursor message's createdAt to page strictly before it", async () => {
    const cursorDate = new Date("2026-01-01T00:00:00Z");
    prisma.message.findUnique.mockResolvedValue({ id: "cursor-msg", createdAt: cursorDate });
    prisma.message.findMany.mockResolvedValue([]);

    await service.list("channel-1", "cursor-msg", 20);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: "channel-1", createdAt: { lt: cursorDate } },
      })
    );
  });

  it("ignores an unknown cursor id rather than erroring (falls back to the first page)", async () => {
    prisma.message.findUnique.mockResolvedValue(null);
    prisma.message.findMany.mockResolvedValue([]);

    await service.list("channel-1", "does-not-exist", 20);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { channelId: "channel-1" } })
    );
  });
});
