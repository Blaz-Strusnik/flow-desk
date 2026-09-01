/**
 * Holds the current access token in memory only (never localStorage, to
 * reduce XSS exposure). Both api-client.ts and auth-context.tsx read/write
 * through here so api-client doesn't need to be a React hook.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
