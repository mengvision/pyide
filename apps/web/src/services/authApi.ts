/**
 * Auth API service for the web app.
 *
 * All paths are relative so Vite's dev-server proxy (`/api → localhost:8000`)
 * handles routing.  In production the web app is served from the same origin
 * as the FastAPI server, so relative paths work there too.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  access_token: string;
  token_type: string;
  id: number;
  username: string;
  email: string;
}

export interface MeResponse {
  id: number;
  username: string;
  email: string;
}

// ── API base ──────────────────────────────────────────────────────────────────

/** Resolve base URL: env var → relative path (handled by Vite proxy). */
function base(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * Returns a JWT access token on success.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${base()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error((err as { detail?: string })?.detail ?? `Login failed (${res.status})`);
  }

  return res.json() as Promise<LoginResponse>;
}

/**
 * POST /api/v1/auth/register
 * Creates a new user and returns the created user object.
 */
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const res = await fetch(`${base()}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error((err as { detail?: string })?.detail ?? `Registration failed (${res.status})`);
  }

  return res.json() as Promise<RegisterResponse>;
}

/**
 * POST /api/v1/auth/refresh
 * Sends the current Bearer token in the Authorization header to obtain a
 * new access token.  Returns null when the token is absent, invalid, or
 * the server rejects the request.
 */
export async function refreshToken(
  serverUrl?: string,
  currentToken?: string | null,
): Promise<string | null> {
  try {
    const url = serverUrl
      ? `${serverUrl}/api/v1/auth/refresh`
      : `${base()}/api/v1/auth/refresh`;

    const headers: Record<string, string> = {};
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/v1/auth/me
 * Lightweight endpoint to validate that the current access token is still
 * accepted by the server.  Returns null on any error.
 */
export async function fetchMe(token: string, serverUrl?: string): Promise<MeResponse | null> {
  try {
    const url = serverUrl
      ? `${serverUrl}/api/v1/auth/me`
      : `${base()}/api/v1/auth/me`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });

    if (!res.ok) return null;
    return res.json() as Promise<MeResponse>;
  } catch {
    return null;
  }
}

// ── Authenticated fetch helper ────────────────────────────────────────────────

/**
 * Wraps `fetch` to attach the current Bearer token.
 * If a 401 is received, attempts a token refresh once and retries.
 * If the refresh also fails, returns the 401 response as-is so the caller can
 * decide how to handle it (e.g. redirect to login).
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit & { getToken: () => string | null; onRefresh: (t: string) => void },
): Promise<Response> {
  const { getToken, onRefresh, ...fetchOptions } = options;

  const makeHeaders = (token: string | null): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const firstToken = getToken();
  const res = await fetch(url, { ...fetchOptions, headers: makeHeaders(firstToken) });

  if (res.status !== 401) return res;

  // Try a silent token refresh
  const newToken = await refreshToken(undefined, firstToken);
  if (!newToken) return res; // propagate 401 — caller should logout

  onRefresh(newToken);
  return fetch(url, { ...fetchOptions, headers: makeHeaders(newToken) });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
