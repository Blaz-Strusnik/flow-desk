import { getAccessToken, setAccessToken } from "./auth/token-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`API request failed with status ${status}`);
  }
}

let refreshPromise: Promise<string | null> | null = null;

/** Calls /auth/refresh using the httpOnly cookie; de-duped across concurrent callers. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return null;
        }
        const data = await res.json();
        setAccessToken(data.accessToken);
        return data.accessToken as string;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface ApiFetchOptions extends RequestInit {
  /** Skip attaching the Authorization header and the 401 refresh-retry (used by /auth/login, /auth/register). */
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const doFetch = async (token: string | null) => {
    const h = new Headers(headers);
    if (rest.body && !(rest.body instanceof FormData) && !h.has("Content-Type")) {
      h.set("Content-Type", "application/json");
    }
    if (token && !skipAuth) {
      h.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${API_URL}${path}`, { ...rest, headers: h, credentials: "include" });
  };

  let res = await doFetch(getAccessToken());

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, body);
  }

  // Any body-less success response (204 explicitly, or a 200 whose handler
  // forgot to return a value) — res.json() throws on an empty body, which
  // would otherwise reject the whole mutation even though the request
  // actually succeeded server-side.
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
