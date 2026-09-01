import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api-client";
import { setAccessToken } from "./auth/token-store";

function mockFetchOnce(response: Partial<Response> & { text: () => Promise<string> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      ...response,
    })
  );
}

describe("apiFetch", () => {
  beforeEach(() => {
    setAccessToken("test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: a 200-with-empty-body response (e.g. a DELETE handler that
  // forgot @HttpCode(204)) used to make res.json() throw, silently
  // rejecting the mutation even though the request succeeded server-side —
  // this is what made "unassign" and "detach label" look broken in the UI.
  it("resolves to undefined for a 200 response with an empty body, instead of throwing", async () => {
    mockFetchOnce({ status: 200, text: () => Promise.resolve("") });

    await expect(apiFetch("/cards/1/members/2", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("resolves to undefined for an explicit 204 response", async () => {
    mockFetchOnce({ status: 204, text: () => Promise.resolve("") });

    await expect(apiFetch("/cards/1/members/2", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("parses a non-empty JSON body normally", async () => {
    mockFetchOnce({ status: 200, text: () => Promise.resolve(JSON.stringify({ id: "1" })) });

    await expect(apiFetch("/cards/1")).resolves.toEqual({ id: "1" });
  });

  it("throws ApiError with the parsed error body on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Not found" }),
      })
    );

    await expect(apiFetch("/cards/does-not-exist")).rejects.toMatchObject({
      status: 404,
      body: { message: "Not found" },
    });
  });
});
