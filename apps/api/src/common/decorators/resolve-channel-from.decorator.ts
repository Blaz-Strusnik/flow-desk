import { SetMetadata } from "@nestjs/common";

export const CHANNEL_RESOLVE_KEY = "channelResolveSource";

export type ChannelResolveSource = "param" | "message";

/**
 * Tells ChannelMemberGuard how to find the channelId being accessed:
 * - 'param':   route has a literal :channelId param
 * - 'message': route has a :messageId param; guard resolves message.channelId
 */
export const ResolveChannelFrom = (source: ChannelResolveSource) =>
  SetMetadata(CHANNEL_RESOLVE_KEY, source);
