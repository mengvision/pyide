/**
 * Memory API Service
 *
 * Wraps the server-side memory REST endpoints.
 * All memory storage and dream-mode processing lives on the server.
 */

import type { MemoryEntry, MemoryType, DreamReport } from '@desktop/types/memory';

export type { MemoryEntry, MemoryType, DreamReport };

export type MemoryScope = 'session' | 'project' | 'user' | 'global';

export interface DreamStatus {
  isRunning: boolean;
  lastRun?: string;
  lastReport?: DreamReport;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

function base(serverUrl: string): string {
  return serverUrl.replace(/\/$/, '');
}

// ── Memory CRUD ───────────────────────────────────────────────────────────────

/**
 * List memories, optionally filtered by scope.
 * GET /api/memory?scope=session|project|user|global
 */
export async function listMemories(
  serverUrl: string,
  token: string,
  scope?: MemoryScope,
): Promise<MemoryEntry[]> {
  const params = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  const res = await fetch(`${base(serverUrl)}/api/memory${params}`, {
    headers: authHeaders(token),
  });
  return handleResponse<MemoryEntry[]>(res, 'listMemories');
}

/**
 * Retrieve a single memory entry by ID.
 * GET /api/memory/{id}
 */
export async function getMemory(
  serverUrl: string,
  token: string,
  id: string,
): Promise<MemoryEntry> {
  const res = await fetch(`${base(serverUrl)}/api/memory/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  return handleResponse<MemoryEntry>(res, `getMemory(${id})`);
}

/**
 * Save (create) a new memory entry.
 * POST /api/memory
 */
export async function saveMemory(
  serverUrl: string,
  token: string,
  memory: Omit<MemoryEntry, 'id'>,
): Promise<MemoryEntry> {
  const res = await fetch(`${base(serverUrl)}/api/memory`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(memory),
  });
  return handleResponse<MemoryEntry>(res, 'saveMemory');
}

/**
 * Delete a memory entry by ID.
 * DELETE /api/memory/{id}
 */
export async function deleteMemory(
  serverUrl: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${base(serverUrl)}/api/memory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`deleteMemory(${id}) failed (${res.status}): ${body}`);
  }
}

/**
 * Promote a memory entry to a higher scope (e.g. session → project → user → global).
 * POST /api/memory/{id}/promote  { targetScope }
 */
export async function promoteMemory(
  serverUrl: string,
  token: string,
  id: string,
  targetScope: MemoryScope,
): Promise<MemoryEntry> {
  const res = await fetch(
    `${base(serverUrl)}/api/memory/${encodeURIComponent(id)}/promote`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ targetScope }),
    },
  );
  return handleResponse<MemoryEntry>(res, `promoteMemory(${id} → ${targetScope})`);
}

// ── Dream mode ────────────────────────────────────────────────────────────────

/**
 * Manually trigger a Dream-mode consolidation run on the server.
 * POST /api/memory/dream
 */
export async function triggerDreamMode(
  serverUrl: string,
  token: string,
): Promise<DreamReport> {
  const res = await fetch(`${base(serverUrl)}/api/memory/dream`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse<DreamReport>(res, 'triggerDreamMode');
}

/**
 * Poll the current Dream-mode processing status.
 * GET /api/memory/dream/status
 */
export async function getDreamStatus(
  serverUrl: string,
  token: string,
): Promise<DreamStatus> {
  const res = await fetch(`${base(serverUrl)}/api/memory/dream/status`, {
    headers: authHeaders(token),
  });
  return handleResponse<DreamStatus>(res, 'getDreamStatus');
}
