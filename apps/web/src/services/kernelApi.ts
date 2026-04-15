/**
 * kernelApi
 *
 * REST API helpers for kernel lifecycle management.
 * All requests include `Authorization: Bearer <token>`.
 *
 * Endpoints (implemented by the server):
 *   POST   /api/v1/kernels/create              → { kernel_id, ws_url }
 *   DELETE /api/v1/kernels/destroy             → 204 No Content
 *   GET    /api/v1/kernels/status              → { status, kernel }
 *   POST   /api/v1/kernels/:kernelId/ws-token  → { ws_token }
 */

// ── Response types ────────────────────────────────────────────────────────────

export interface KernelStartResponse {
  kernel_id: string;
  /** WebSocket URL for the kernel, e.g. ws://localhost:8000/ws/kernel/<id> */
  ws_url: string;
}

export interface KernelStatusResponse {
  kernel_id: string | null;
  /** 'starting' | 'idle' | 'busy' | 'stopped' | 'error' */
  status: string;
  uptime_seconds?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function apiPost<T>(
  serverUrl: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kernel API ${res.status} (${path}): ${text}`);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

async function apiGet<T>(
  serverUrl: string,
  path: string,
  token: string,
): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kernel API ${res.status} (${path}): ${text}`);
  }

  return res.json() as Promise<T>;
}

async function apiDelete(
  serverUrl: string,
  path: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kernel API ${res.status} (${path}): ${text}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ask the server to start a new kernel for the authenticated user.
 * Returns the kernel ID and a WebSocket URL to connect to.
 */
export async function startKernel(
  serverUrl: string,
  token: string,
): Promise<KernelStartResponse> {
  return apiPost<KernelStartResponse>(serverUrl, '/api/v1/kernels/create', token);
}

/**
 * Stop the running kernel. The server will clean up the process.
 */
export async function stopKernel(
  serverUrl: string,
  token: string,
  kernelId: string,
): Promise<void> {
  void kernelId;
  return apiDelete(serverUrl, '/api/v1/kernels/destroy', token);
}

/**
 * Restart the kernel (stop + start). Returns the new kernel ID and WS URL.
 */
export async function restartKernel(
  serverUrl: string,
  token: string,
  kernelId: string,
): Promise<KernelStartResponse> {
  await stopKernel(serverUrl, token, kernelId);
  return startKernel(serverUrl, token);
}

/**
 * Poll the current status of the kernel.
 */
export async function getKernelStatus(
  serverUrl: string,
  token: string,
  kernelId: string,
): Promise<KernelStatusResponse> {
  void kernelId;
  return apiGet<KernelStatusResponse>(serverUrl, '/api/v1/kernels/status', token);
}

/**
 * Obtain a short-lived, opaque WebSocket session token.
 *
 * Exchanges the JWT (Authorization header) for a one-time `ws_token` that can
 * be passed safely in the WebSocket URL query string without exposing the raw
 * JWT in server logs or Referer headers.
 *
 * Server endpoint: POST /api/v1/kernels/:kernelId/ws-token
 * Response:        { ws_token: string }
 */
export async function getWsToken(
  serverUrl: string,
  token: string,
  kernelId: string,
): Promise<string> {
  const base = serverUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/kernels/${encodeURIComponent(kernelId)}/ws-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to obtain WebSocket token: ${res.status}`);
  }
  const data = await res.json() as { ws_token: string };
  return data.ws_token;
}
