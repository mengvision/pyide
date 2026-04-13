/**
 * WebPlatformService
 * Implements PlatformService using REST API calls to the Phase 3 server.
 * Auth tokens are stored in localStorage (no Tauri secure store).
 *
 * Base URL example: 'http://localhost:8000'
 */

import type { PlatformService } from './PlatformService';
import type {
  FileEntry,
  KernelStartInfo,
  KernelStatus,
  SkillEntry,
  MCPServerStatus,
} from './types';

const AUTH_TOKEN_KEY = 'pyide_auth_token';

export class WebPlatformService implements PlatformService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }

  private async apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.apiFetch(path, init);
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  // ── File Operations ─────────────────────────────────────────────────────────

  file = {
    read: async (path: string): Promise<string> => {
      const res = await this.apiFetch(
        `/api/files/read?path=${encodeURIComponent(path)}`,
      );
      if (!res.ok) throw new Error(`read failed: ${res.statusText}`);
      return res.text();
    },

    write: async (path: string, content: string): Promise<void> => {
      await this.apiFetch('/api/files/write', {
        method: 'POST',
        body: JSON.stringify({ path, content }),
      });
    },

    readDirectory: async (
      path: string,
      recursive = false,
      maxDepth = 3,
    ): Promise<FileEntry[]> => {
      const params = new URLSearchParams({
        path,
        recursive: String(recursive),
        maxDepth: String(maxDepth),
      });
      return this.apiJson<FileEntry[]>(`/api/files/directory?${params}`);
    },

    createFile: async (path: string): Promise<void> => {
      await this.apiFetch('/api/files/create-file', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });
    },

    createDirectory: async (path: string): Promise<void> => {
      await this.apiFetch('/api/files/create-directory', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });
    },

    delete: async (path: string): Promise<void> => {
      await this.apiFetch(`/api/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
    },

    rename: async (oldPath: string, newPath: string): Promise<void> => {
      await this.apiFetch('/api/files/rename', {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
      });
    },

    pickFolder: async (): Promise<string | null> => {
      // Not available in a web browser — return null
      return null;
    },

    getHomeDir: async (): Promise<string> => {
      const data = await this.apiJson<{ homeDir: string }>('/api/system/home-dir');
      return data.homeDir;
    },
  };

  // ── Environment Management — desktop-only, not supported in web ─────────────

  env = undefined;

  // ── Kernel Management ───────────────────────────────────────────────────────

  kernel = {
    start: async (pykernelPath: string, pythonPath?: string | null): Promise<KernelStartInfo> => {
      return this.apiJson<KernelStartInfo>('/api/kernel/start', {
        method: 'POST',
        body: JSON.stringify({ pykernelPath, pythonPath: pythonPath ?? null }),
      });
    },

    stop: async (): Promise<void> => {
      await this.apiFetch('/api/kernel/stop', { method: 'POST' });
    },

    interrupt: async (): Promise<void> => {
      await this.apiFetch('/api/kernel/interrupt', { method: 'POST' });
    },

    getStatus: async (): Promise<KernelStatus> => {
      const data = await this.apiJson<{ status: KernelStatus }>('/api/kernel/status');
      return data.status;
    },
  };

  // ── Skills System ───────────────────────────────────────────────────────────

  skills = {
    scanUserSkills: async (basePath: string): Promise<SkillEntry[]> => {
      return this.apiJson<SkillEntry[]>(
        `/api/skills/user?basePath=${encodeURIComponent(basePath)}`,
      );
    },

    scanClawHubSkills: async (basePath: string): Promise<SkillEntry[]> => {
      return this.apiJson<SkillEntry[]>(
        `/api/skills/clawhub?basePath=${encodeURIComponent(basePath)}`,
      );
    },

    getUserSkillsDir: async (baseDir: string): Promise<string> => {
      return `${baseDir}/.pyide/skills`;
    },
  };

  // ── MCP Server Integration ──────────────────────────────────────────────────

  mcp = {
    startServer: async (
      name: string,
      command: string,
      args: string[],
      env?: Record<string, string>,
    ): Promise<void> => {
      await this.apiFetch('/api/mcp/start', {
        method: 'POST',
        body: JSON.stringify({ name, command, args, env }),
      });
    },

    stopServer: async (name: string): Promise<void> => {
      await this.apiFetch('/api/mcp/stop', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },

    listServers: async (): Promise<MCPServerStatus[]> => {
      return this.apiJson<MCPServerStatus[]>('/api/mcp/servers');
    },

    getConfigPath: async (homeDir: string): Promise<string> => {
      const data = await this.apiJson<{ configPath: string }>(
        `/api/mcp/config-path?homeDir=${encodeURIComponent(homeDir)}`,
      );
      return data.configPath;
    },

    sendMessage: async (serverName: string, message: string): Promise<void> => {
      await this.apiFetch('/api/mcp/message/send', {
        method: 'POST',
        body: JSON.stringify({ serverName, message }),
      });
    },

    readMessage: async (serverName: string): Promise<string> => {
      const data = await this.apiJson<{ message: string }>(
        `/api/mcp/message/read?serverName=${encodeURIComponent(serverName)}`,
      );
      return data.message;
    },
  };

  // ── Memory System ───────────────────────────────────────────────────────────

  memory = {
    getBaseDir: async (homeDir: string): Promise<string> => {
      const data = await this.apiJson<{ baseDir: string }>(
        `/api/memory/base-dir?homeDir=${encodeURIComponent(homeDir)}`,
      );
      return data.baseDir;
    },

    getUserMemoryPath: async (homeDir: string): Promise<string> => {
      const data = await this.apiJson<{ path: string }>(
        `/api/memory/user-path?homeDir=${encodeURIComponent(homeDir)}`,
      );
      return data.path;
    },

    getProjectMemoryPath: async (homeDir: string, projectId: string): Promise<string> => {
      const data = await this.apiJson<{ path: string }>(
        `/api/memory/project-path?homeDir=${encodeURIComponent(homeDir)}&projectId=${encodeURIComponent(projectId)}`,
      );
      return data.path;
    },
  };

  // ── Authentication ──────────────────────────────────────────────────────────

  auth = {
    saveToken: async (token: string): Promise<void> => {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    },

    loadToken: async (): Promise<string | null> => {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    },

    clearToken: async (): Promise<void> => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    },
  };
}
