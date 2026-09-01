import { SetMetadata } from "@nestjs/common";

export const WORKSPACE_RESOLVE_KEY = "workspaceResolveSource";

export type WorkspaceResolveSource = "param" | "board" | "channel";

/**
 * Tells WorkspaceMemberGuard how to find the workspaceId being accessed:
 * - 'param':   route has a literal :workspaceId param
 * - 'board':   route has a :boardId param; guard resolves board.workspaceId
 * - 'channel': route has a :channelId param; guard resolves channel.workspaceId
 */
export const ResolveWorkspaceFrom = (source: WorkspaceResolveSource) =>
  SetMetadata(WORKSPACE_RESOLVE_KEY, source);
