import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardsService } from "./cards.service.js";

function buildPrisma() {
  return {
    card: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    list: {
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
}

function buildEvents() {
  return { emit: vi.fn() };
}

function buildNotifications() {
  return { create: vi.fn() };
}

describe("CardsService.move", () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let events: ReturnType<typeof buildEvents>;
  let notifications: ReturnType<typeof buildNotifications>;
  let service: CardsService;

  beforeEach(() => {
    prisma = buildPrisma();
    events = buildEvents();
    notifications = buildNotifications();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new CardsService(prisma as any, events as any, notifications as any);
  });

  it("computes the midpoint position between two healthy neighbors and persists it directly", async () => {
    prisma.card.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "before-card") return Promise.resolve({ id: "before-card", position: 10 });
      if (where.id === "after-card") return Promise.resolve({ id: "after-card", position: 20 });
      return Promise.resolve(null);
    });
    prisma.card.update.mockResolvedValue({
      id: "moved-card",
      position: 15,
      list: { boardId: "board-1" },
    });

    const result = await service.move("moved-card", "list-1", "user-1", "before-card", "after-card");

    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "moved-card" },
      data: { listId: "list-1", position: 15 },
      include: { list: { select: { boardId: true } } },
    });
    expect(result!.position).toBe(15);
    expect(events.emit).toHaveBeenCalledWith(
      "card:moved",
      expect.objectContaining({ boardId: "board-1", cardId: "moved-card", position: 15, movedBy: "user-1" })
    );
    // No rebalance needed on the happy path.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("appends to the bottom of the list when there is no neighbor after it", async () => {
    prisma.card.findUnique.mockResolvedValueOnce({ id: "before-card", position: 100 });
    prisma.card.update.mockResolvedValue({
      id: "moved-card",
      position: 100 + 1024,
      list: { boardId: "board-1" },
    });

    await service.move("moved-card", "list-1", "user-1", "before-card", null);

    expect(prisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { listId: "list-1", position: 100 + 1024 } })
    );
  });

  it("rebalances the whole target list when the requested gap is too small for float precision", async () => {
    // Gap of 5e-8 is below position.ts's MIN_GAP (1e-7), forcing PositionGapExhaustedError.
    prisma.card.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "before-card") return Promise.resolve({ id: "before-card", position: 1 });
      if (where.id === "after-card") return Promise.resolve({ id: "after-card", position: 1 + 5e-8 });
      return Promise.resolve(null);
    });
    // rebalanceAndMove first moves the card into the target list...
    prisma.card.update.mockResolvedValueOnce({ id: "moved-card", listId: "list-1" });
    // ...then reloads the full target-list order to rebalance.
    // Order here is what the code treats as "current position order" —
    // position values themselves are irrelevant post-rebalance.
    prisma.card.findMany.mockResolvedValue([
      { id: "before-card", position: 1 },
      { id: "moved-card", listId: "list-1", position: 1 + 2.5e-8 },
      { id: "after-card", position: 1 + 5e-8 },
    ]);
    prisma.list.findUniqueOrThrow.mockResolvedValue({ boardId: "board-1" });
    prisma.card.update.mockResolvedValue({}); // subsequent per-item rebalance updates

    const result = await service.move("moved-card", "list-1", "user-1", "before-card", "after-card");

    // Rebalance ran (one transaction batching the position updates).
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Rebalance reassigns fresh evenly-spaced positions to the whole list
    // (order preserved: before-card, moved-card, after-card), so moved-card
    // lands at the 2nd of 3 slots.
    expect(result).toMatchObject({ id: "moved-card", position: 2048 });
    expect(events.emit).toHaveBeenCalledWith(
      "card:moved",
      expect.objectContaining({ boardId: "board-1", cardId: "moved-card", movedBy: "user-1" })
    );
  });
});
