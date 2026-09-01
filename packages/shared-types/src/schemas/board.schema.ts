import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteWorkspaceMemberSchema = z.object({
  email: z.string().email(),
});
export type InviteWorkspaceMemberInput = z.infer<typeof inviteWorkspaceMemberSchema>;

export const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  background: z.string().max(255).optional(),
});
export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export const createListSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const renameListSchema = z.object({
  name: z.string().min(1).max(100),
});
export type RenameListInput = z.infer<typeof renameListSchema>;

/** Reorder by naming the new neighbors rather than sending a raw position —
 * the server computes (and rebalances) the authoritative fractional position. */
export const moveListSchema = z.object({
  beforeId: z.string().nullable().optional(),
  afterId: z.string().nullable().optional(),
});
export type MoveListInput = z.infer<typeof moveListSchema>;

export const inviteBoardMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["EDITOR", "VIEWER"]).default("EDITOR"),
});
export type InviteBoardMemberInput = z.infer<typeof inviteBoardMemberSchema>;

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().min(1).max(32),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
