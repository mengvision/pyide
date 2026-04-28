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
 * Install a skill from a URL (.md or .zip).
 * POST /api/skills/install-url  { url }
 */
export async function installSkillFromUrl(
  serverUrl: string,
  token: string,
  url: string,
): Promise<{ success: boolean; skillName?: string; error?: string }> {
  const apiUrl = `${serverUrl.replace(/\/$/, '')}/api/skills/install-url`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ url }),
  });
  return handleResponse<{ success: boolean; skillName?: string; error?: string }>(res, `installSkillFromUrl(${url})`);
}

/**
 * Install a skill from a ZIP file upload.
 * POST /api/skills/install-zip  (multipart/form-data)
 */
export async function installSkillFromZip(
  serverUrl: string,
  token: string,
  file: File,
): Promise<{ success: boolean; skillName?: string; error?: string }> {
  const apiUrl = `${serverUrl.replace(/\/$/, '')}/api/skills/install-zip`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return handleResponse<{ success: boolean; skillName?: string; error?: string }>(res, `installSkillFromZip(${file.name})`);
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
