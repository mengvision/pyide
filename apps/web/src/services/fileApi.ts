/**
 * File API service for the web app.
 *
 * All paths are relative — Vite dev-server proxy routes `/api → localhost:8000`.
 * In production the web app is served from the same origin as the FastAPI server.
 */

import type { FileEntry } from '@pyide/platform';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve API base URL (env override or relative). */
function base(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function apiJson<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface WorkspaceInfo {
  root_path: string;
}

/** GET /api/workspace — returns the user's server-side workspace root. */
export async function getWorkspace(token: string): Promise<WorkspaceInfo> {
  return apiJson<WorkspaceInfo>(token, '/api/workspace');
}

// ── File listing ──────────────────────────────────────────────────────────────

/**
 * GET /api/files?path=xxx
 * List the contents of a directory. Returns a flat array of FileEntry objects.
 */
export async function listFiles(token: string, path?: string): Promise<FileEntry[]> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  const qs = params.toString() ? `?${params}` : '';
  return apiJson<FileEntry[]>(token, `/api/files${qs}`);
}

// ── File content ──────────────────────────────────────────────────────────────

/**
 * GET /api/files/content?path=xxx
 * Read the text content of a file.
 */
export async function readFile(token: string, path: string): Promise<string> {
  const res = await fetch(
    `${base()}/api/files/content?path=${encodeURIComponent(path)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { content: string };
  return data.content;
}

/**
 * PUT /api/files/content
 * Write / overwrite the text content of a file.
 */
export async function writeFile(
  token: string,
  path: string,
  content: string,
): Promise<void> {
  await apiJson<void>(token, '/api/files/content', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * POST /api/files — body { path, type: 'file' }
 */
export async function createFile(token: string, path: string): Promise<void> {
  await apiJson<void>(token, '/api/files', {
    method: 'POST',
    body: JSON.stringify({ path, type: 'file' }),
  });
}

/**
 * POST /api/files — body { path, type: 'directory' }
 */
export async function createDirectory(token: string, path: string): Promise<void> {
  await apiJson<void>(token, '/api/files', {
    method: 'POST',
    body: JSON.stringify({ path, type: 'directory' }),
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/files?path=xxx
 */
export async function deleteFile(token: string, path: string): Promise<void> {
  const res = await fetch(
    `${base()}/api/files?path=${encodeURIComponent(path)}`,
    { method: 'DELETE', headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/files — body { old_path, new_path }
 */
export async function renameFile(
  token: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  await apiJson<void>(token, '/api/files', {
    method: 'PATCH',
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * POST /api/files/upload (multipart/form-data)
 * Upload a browser File object to the server workspace.
 * `onProgress` receives byte counts as the XHR progresses.
 */
export function uploadFile(
  token: string,
  file: File,
  destPath: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dest_path', destPath);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base()}/api/files/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total });
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(formData);
  });
}

// ── Download ──────────────────────────────────────────────────────────────────

/**
 * GET /api/files/download?path=xxx
 * Fetches the file as a blob and triggers a browser download.
 */
export async function downloadFile(token: string, path: string): Promise<void> {
  const res = await fetch(
    `${base()}/api/files/download?path=${encodeURIComponent(path)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }

  const blob = await res.blob();
  const filename = path.split('/').pop() ?? 'download';

  // Create a temporary <a> element to trigger the download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
