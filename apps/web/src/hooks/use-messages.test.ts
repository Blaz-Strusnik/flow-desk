import type { MessageDto } from "@flowdesk/shared-types";
import { describe, expect, it } from "vitest";
import { flattenMessagePages } from "./use-messages";

function msg(id: string): MessageDto {
  return {
    id,
    channelId: "c1",
    userId: "u1",
    body: id,
    createdAt: new Date().toISOString(),
    editedAt: null,
    user: { id: "u1", email: "a@example.com", name: "A", avatarUrl: null },
  };
}

describe("flattenMessagePages", () => {
  it("returns an empty array when pages is undefined", () => {
    expect(flattenMessagePages(undefined)).toEqual([]);
  });

  it("flattens newest-page-first pages into one oldest-first chronological list", () => {
    // Page 0 (fetched first) = newest messages; page 1 (fetched via nextCursor) = older messages.
    const pages = [
      { messages: [msg("m3"), msg("m4")], nextCursor: "m3" }, // newest page, ascending internally
      { messages: [msg("m1"), msg("m2")], nextCursor: null }, // older page, ascending internally
    ];

    expect(flattenMessagePages(pages).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("handles a single page unchanged", () => {
    const pages = [{ messages: [msg("m1"), msg("m2")], nextCursor: null }];
    expect(flattenMessagePages(pages).map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});
