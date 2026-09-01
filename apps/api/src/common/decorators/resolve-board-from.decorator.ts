import { SetMetadata } from "@nestjs/common";

export const BOARD_RESOLVE_KEY = "boardResolveSource";

export type BoardResolveSource = "param" | "list" | "card";

/**
 * Tells BoardMemberGuard how to find the boardId being accessed:
 * - 'param': route has a literal :boardId param
 * - 'list':  route has a :listId param; guard resolves list.boardId
 * - 'card':  route has a :cardId param; guard resolves card.list.boardId
 */
export const ResolveBoardFrom = (source: BoardResolveSource) =>
  SetMetadata(BOARD_RESOLVE_KEY, source);
