const GAP = 1024;
const MIN_GAP = 1e-7;

export class PositionGapExhaustedError extends Error {
  constructor() {
    super("Position gap between neighbors is too small; caller must rebalance");
    this.name = "PositionGapExhaustedError";
  }
}

/**
 * Fractional-indexing helper: given the positions of the item immediately
 * before and after a target slot, returns a position that sits strictly
 * between them. Pass `null`/`undefined` for `prev` to insert at the top,
 * or for `next` to insert at the bottom.
 *
 * Throws PositionGapExhaustedError when `prev`/`next` are too close together
 * to fit a float between them (float precision exhausted); callers must
 * catch this, rebalance the affected list via `rebalancePositions`, and
 * retry.
 */
export function getPositionBetween(
  prev?: number | null,
  next?: number | null
): number {
  if (prev == null && next == null) {
    return GAP;
  }
  if (prev == null) {
    return next! - GAP;
  }
  if (next == null) {
    return prev + GAP;
  }
  if (prev >= next) {
    throw new RangeError(
      `getPositionBetween: prev (${prev}) must be less than next (${next})`
    );
  }
  if (next - prev < MIN_GAP) {
    throw new PositionGapExhaustedError();
  }
  return prev + (next - prev) / 2;
}

/** True when inserting between prev/next would exhaust float precision. */
export function needsRebalance(
  prev?: number | null,
  next?: number | null
): boolean {
  if (prev == null || next == null) return false;
  return next - prev < MIN_GAP;
}

/**
 * Reassigns evenly spaced positions (multiples of GAP) to an ordered list of
 * items, preserving the input order. Used when a run of inserts has
 * exhausted the available float precision between two neighbors.
 */
export function rebalancePositions<T extends { id: string }>(
  items: T[]
): Array<T & { position: number }> {
  return items.map((item, index) => ({ ...item, position: (index + 1) * GAP }));
}
