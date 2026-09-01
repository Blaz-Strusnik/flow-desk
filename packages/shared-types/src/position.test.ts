import { describe, expect, it } from "vitest";
import {
  getPositionBetween,
  needsRebalance,
  PositionGapExhaustedError,
  rebalancePositions,
} from "./position.js";

describe("getPositionBetween", () => {
  it("returns a base position for an empty list", () => {
    expect(getPositionBetween(null, null)).toBeGreaterThan(0);
  });

  it("returns a position above 0 items when inserting at the top of a list with one item", () => {
    const first = getPositionBetween(null, null);
    const top = getPositionBetween(null, first);
    expect(top).toBeLessThan(first);
  });

  it("returns a position below the last item when inserting at the bottom", () => {
    const last = getPositionBetween(null, null);
    const bottom = getPositionBetween(last, null);
    expect(bottom).toBeGreaterThan(last);
  });

  it("returns the midpoint when inserting between two existing items", () => {
    const mid = getPositionBetween(10, 20);
    expect(mid).toBe(15);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(20);
  });

  it("throws RangeError when prev >= next", () => {
    expect(() => getPositionBetween(20, 10)).toThrow(RangeError);
    expect(() => getPositionBetween(10, 10)).toThrow(RangeError);
  });

  it("throws PositionGapExhaustedError once repeated inserts at the same spot exhaust float precision", () => {
    let prev: number | null = 0;
    let next: number | null = 100;
    let iterations = 0;
    const MAX_ITERATIONS = 2000;

    expect(() => {
      while (iterations < MAX_ITERATIONS) {
        const mid = getPositionBetween(prev, next);
        // Always insert directly below `prev`, repeatedly halving the gap
        // toward `prev` — the worst case for fractional indexing.
        next = mid;
        iterations++;
      }
    }).toThrow(PositionGapExhaustedError);

    expect(iterations).toBeLessThan(MAX_ITERATIONS);
  });

  it("needsRebalance flags a too-small gap before getPositionBetween would throw", () => {
    const prev = 1;
    const next = 1 + 1e-8;
    expect(needsRebalance(prev, next)).toBe(true);
    expect(() => getPositionBetween(prev, next)).toThrow(PositionGapExhaustedError);
  });

  it("needsRebalance is false for a healthy gap or an open end", () => {
    expect(needsRebalance(10, 20)).toBe(false);
    expect(needsRebalance(null, 20)).toBe(false);
    expect(needsRebalance(10, null)).toBe(false);
  });
});

describe("rebalancePositions", () => {
  it("assigns strictly increasing, evenly spaced positions preserving order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const result = rebalancePositions(items);

    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(result[0].position).toBeLessThan(result[1].position);
    expect(result[1].position).toBeLessThan(result[2].position);
  });

  it("handles an empty list", () => {
    expect(rebalancePositions([])).toEqual([]);
  });

  it("handles a single item", () => {
    const result = rebalancePositions([{ id: "only" }]);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBeGreaterThan(0);
  });

  it("produces gaps large enough for many subsequent inserts between any two items", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const [a, b] = rebalancePositions(items);
    // Simulate repeated inserts between the freshly rebalanced neighbors —
    // should succeed many times before ever needing another rebalance.
    let prev = a.position;
    const next = b.position;
    for (let i = 0; i < 20; i++) {
      const mid = getPositionBetween(prev, next);
      expect(mid).toBeGreaterThan(prev);
      expect(mid).toBeLessThan(next);
      prev = mid;
    }
  });
});
