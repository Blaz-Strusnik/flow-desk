import { z } from "zod";

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Channel names must be lowercase letters, numbers, and hyphens"),
  isPrivate: z.boolean().default(false),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
