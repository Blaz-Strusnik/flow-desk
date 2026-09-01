import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CardSearchResult {
  id: string;
  title: string;
  listId: string;
  boardId: string;
}

export interface MessageSearchResult {
  id: string;
  body: string;
  channelId: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped through the same membership tables the read guards check —
   * search must never surface content the user couldn't otherwise open. */
  async search(workspaceId: string, userId: string, query: string) {
    const [cards, messages] = await Promise.all([
      this.prisma.$queryRaw<CardSearchResult[]>`
        SELECT c.id, c.title, c."listId", b.id AS "boardId"
        FROM "Card" c
        JOIN "List" l ON l.id = c."listId"
        JOIN "Board" b ON b.id = l."boardId"
        JOIN "BoardMember" bm ON bm."boardId" = b.id AND bm."userId" = ${userId}
        WHERE b."workspaceId" = ${workspaceId}
          AND c."searchVector" @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(c."searchVector", plainto_tsquery('english', ${query})) DESC
        LIMIT 20
      `,
      this.prisma.$queryRaw<MessageSearchResult[]>`
        SELECT m.id, m.body, m."channelId"
        FROM "Message" m
        JOIN "Channel" ch ON ch.id = m."channelId"
        JOIN "ChannelMember" cm ON cm."channelId" = ch.id AND cm."userId" = ${userId}
        WHERE ch."workspaceId" = ${workspaceId}
          AND m."searchVector" @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(m."searchVector", plainto_tsquery('english', ${query})) DESC
        LIMIT 20
      `,
    ]);

    return { cards, messages };
  }
}
