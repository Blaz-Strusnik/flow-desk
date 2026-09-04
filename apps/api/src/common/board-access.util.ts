import { PrismaService } from "../prisma/prisma.service.js";

export type EffectiveBoardRole = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Workspace membership grants implicit access to every board in the
 * workspace; the board role is derived from the workspace role.
 */
const WORKSPACE_TO_BOARD_ROLE: Record<string, EffectiveBoardRole> = {
  OWNER: "OWNER",
  ADMIN: "EDITOR",
  MEMBER: "EDITOR",
};

/**
 * Resolves the current user's effective role on a board.
 *
 * An explicit BoardMember row wins — it can promote someone to OWNER or
 * pin them to read-only VIEWER. Otherwise plain workspace membership is
 * enough: every workspace member can see and edit every board in the
 * workspace, with a board role mapped from their workspace role.
 *
 * Returns null when the user can reach the board through neither path
 * (or the board does not exist) — callers surface that as a 404.
 */
export async function resolveBoardAccess(
  prisma: PrismaService,
  userId: string,
  boardId: string
): Promise<{ role: EffectiveBoardRole; source: "board" | "workspace" } | null> {
  const boardMembership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId, boardId } },
  });
  if (boardMembership) {
    return { role: boardMembership.role as EffectiveBoardRole, source: "board" };
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true },
  });
  if (!board) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: board.workspaceId } },
  });
  if (!workspaceMembership) {
    return null;
  }

  return {
    role: WORKSPACE_TO_BOARD_ROLE[workspaceMembership.role] ?? "EDITOR",
    source: "workspace",
  };
}
