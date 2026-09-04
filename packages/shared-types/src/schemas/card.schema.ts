import { z } from "zod";

export const createCardSchema = z.object({
  title: z.string().min(1).max(255),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(20000).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  coverColor: z.string().max(32).nullable().optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

/** Reorder/move by naming the target list and new neighbors — the server
 * computes (and rebalances) the authoritative fractional position. */
export const moveCardSchema = z.object({
  listId: z.string(),
  beforeId: z.string().nullable().optional(),
  afterId: z.string().nullable().optional(),
});
export type MoveCardInput = z.infer<typeof moveCardSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const assignCardMemberSchema = z.object({
  userId: z.string(),
});
export type AssignCardMemberInput = z.infer<typeof assignCardMemberSchema>;

export const attachLabelSchema = z.object({
  labelId: z.string(),
});
export type AttachLabelInput = z.infer<typeof attachLabelSchema>;
