/**
 * Skills API Service
 *
 * Wraps the server-side skill management REST endpoints.
 * The web app does not scan the local filesystem — all skill data
 * comes from the Phase 3 server.
 */

import type { LoadedSkill } from '@desktop/types/skill';

export type { LoadedSkill };

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

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * List all available skills (bundled + user + ClawHub-installed).
 * GET /api/skills
 */
export async function listSkills(
  serverUrl: string,
  token: string,
): Promise<LoadedSkill[]> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/skills`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return handleResponse<LoadedSkill[]>(res, 'listSkills');
}

/**
 * Get the full content for a single skill.
 * GET /api/skills/{id}
 */
export async function getSkill(
  serverUrl: string,
  token: string,
  id: string,
): Promise<LoadedSkill> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/skills/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return handleResponse<LoadedSkill>(res, `getSkill(${id})`);
}

/**
 * Toggle a skill's active state.
 * PATCH /api/skills/{id}  { enabled: boolean }
 */
export async function toggleSkill(
  serverUrl: string,
  token: string,
  id: string,
  enabled: boolean,
): Promise<{ id: string; enabled: boolean }> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/skills/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ enabled }),
  });
  return handleResponse<{ id: string; enabled: boolean }>(res, `toggleSkill(${id})`);
}

/**
 * Install a skill from ClawHub.
 * POST /api/skills  { name, source: 'clawhub' }
 */
export async function installSkill(
  serverUrl: string,
  token: string,
  skillData: { name: string; source?: string; content?: string },
): Promise<LoadedSkill> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/skills`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(skillData),
  });
  return handleResponse<LoadedSkill>(res, `installSkill(${skillData.name})`);
}

/**
 * Uninstall a skill (ClawHub-installed or user-created).
 * DELETE /api/skills/{id}
 */
export async function uninstallSkill(
  serverUrl: string,
  token: string,
  id: string,
): Promise<void> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/skills/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`uninstallSkill(${id}) failed (${res.status}): ${body}`);
  }
}
