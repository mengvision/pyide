/**
 * TauriPlatformService
 * Implements PlatformService by delegating every call to the Tauri `invoke()`
 * IPC bridge. This is the desktop implementation used in apps/desktop.
 */

import { invoke } from '@tauri-apps/api/core';
import type { PlatformService } from './PlatformService';
import type {
  FileEntry,
  VenvInfo,
  PackageInfo,
  KernelStartInfo,
  KernelStatus,
  SkillEntry,
  InstallSkillResult,
  MCPServerStatus,
} from './types';

/** Raw shape returned by the Rust backend for venv info (snake_case). */
interface RawVenvInfo {
  name: string;
  path: string;
  python_version: string;
}

function mapVenv(v: RawVenvInfo): VenvInfo {
  return { name: v.name, path: v.path, pythonVersion: v.python_version };
}

export class TauriPlatformService implements PlatformService {
  // ── File Operations ─────────────────────────────────────────────────────────

  file = {
    read: (path: string): Promise<string> =>
      invoke<string>('read_text_file', { path }),

    write: (path: string, content: string): Promise<void> =>
      invoke<void>('write_text_file', { path, content }),

    readDirectory: (path: string, recursive = false, maxDepth = 3): Promise<FileEntry[]> => {
      if (recursive) {
        return invoke<FileEntry[]>('read_directory_recursive', { path, maxDepth });
      }
      return invoke<FileEntry[]>('read_directory', { path });
    },

    createFile: (path: string): Promise<void> =>
      invoke<void>('create_file', { path }),

    createDirectory: (path: string): Promise<void> =>
      invoke<void>('create_directory', { path }),

    delete: (path: string): Promise<void> =>
      invoke<void>('delete_item', { path }),

    rename: (oldPath: string, newPath: string): Promise<void> =>
      invoke<void>('rename_item', { oldPath, newPath }),

    pickFolder: (): Promise<string | null> =>
      invoke<string | null>('pick_folder'),

    getHomeDir: (): Promise<string> =>
      invoke<string>('get_home_dir'),
  };

  // ── Environment Management ──────────────────────────────────────────────────

  env = {
    checkUv: (): Promise<boolean> =>
      invoke<boolean>('uv_check_installed'),

    listVenvs: async (projectPath: string): Promise<VenvInfo[]> => {
      const raw = await invoke<RawVenvInfo[]>('uv_list_venvs', { projectPath });
      return raw.map(mapVenv);
    },

    createVenv: async (
      name: string,
      projectPath: string,
      pythonVersion?: string,
    ): Promise<VenvInfo> => {
      const raw = await invoke<RawVenvInfo>('uv_create_venv', {
        name,
        pythonVersion: pythonVersion ?? null,
        projectPath,
      });
      return mapVenv(raw);
    },

    deleteVenv: (name: string, projectPath: string): Promise<void> =>
      invoke<void>('uv_delete_venv', { name, projectPath }),

    listPackages: async (venvPath: string): Promise<PackageInfo[]> => {
      const raw = await invoke<{ name: string; version: string }[]>('uv_list_packages', {
        venvPath,
      });
      return raw;
    },

    installPackage: (pkg: string, venvPath: string): Promise<string> =>
      invoke<string>('uv_install_package', { package: pkg, venvPath }),

    uninstallPackage: (pkg: string, venvPath: string): Promise<void> =>
      invoke<void>('uv_uninstall_package', { package: pkg, venvPath }),

    getPythonPath: (venvPath: string): Promise<string> =>
      invoke<string>('uv_get_python_path', { venvPath }),
  };

  // ── Kernel Management ───────────────────────────────────────────────────────

  kernel = {
    start: (pykernelPath: string, pythonPath?: string | null): Promise<KernelStartInfo> =>
      invoke<KernelStartInfo>('start_kernel', {
        pythonPath: pythonPath ?? null,
        pykernelPath,
      }),

    stop: (): Promise<void> => invoke<void>('stop_kernel'),

    interrupt: (): Promise<void> => invoke<void>('interrupt_kernel'),

    getStatus: async (): Promise<KernelStatus> => {
      // The Tauri backend does not expose a dedicated status command;
      // returning 'connected' as a sensible default for the desktop.
      return 'connected';
    },
  };

  // ── Skills System ───────────────────────────────────────────────────────────

  skills = {
    scanUserSkills: (basePath: string): Promise<SkillEntry[]> =>
      invoke<SkillEntry[]>('scan_skill_directories', { basePath }),

    scanClawHubSkills: (basePath: string): Promise<SkillEntry[]> =>
      invoke<SkillEntry[]>('scan_clawhub_skills', { basePath }),

    scanProjectSkills: (workspacePath: string): Promise<SkillEntry[]> =>
      invoke<SkillEntry[]>('scan_project_skills', { workspacePath }),

    getUserSkillsDir: async (baseDir: string): Promise<string> => {
      // The user skills dir is ~/.pyide/skills/
      return `${baseDir}/.pyide/skills`;
    },

    installFromZip: (
      basePath: string,
      zipBytes: number[],
      fileName: string,
    ): Promise<InstallSkillResult> =>
      invoke<InstallSkillResult>('install_skill_from_zip', {
        basePath,
        zipBytes,
        fileName,
      }),
  };

  // ── MCP Server Integration ──────────────────────────────────────────────────

  mcp = {
    startServer: (
      name: string,
      command: string,
      args: string[],
      env?: Record<string, string>,
    ): Promise<void> =>
      invoke<void>('start_mcp_server', { name, command, args, env: env ?? {} }),

    stopServer: (name: string): Promise<void> =>
      invoke<void>('stop_mcp_server', { name }),

    listServers: (): Promise<MCPServerStatus[]> =>
      invoke<MCPServerStatus[]>('list_mcp_servers'),

    getConfigPath: (homeDir: string): Promise<string> =>
      invoke<string>('get_mcp_config_path', { homeDir }),

    sendMessage: (serverName: string, message: string): Promise<void> =>
      invoke<void>('send_mcp_message', { serverName, message }),

    readMessage: (serverName: string): Promise<string> =>
      invoke<string>('read_mcp_message', { serverName }),
  };

  // ── Memory System ───────────────────────────────────────────────────────────

  memory = {
    getBaseDir: (homeDir: string): Promise<string> =>
      invoke<string>('get_memory_base_dir', { homeDir }),

    getUserMemoryPath: (homeDir: string): Promise<string> =>
      invoke<string>('get_user_memory_path', { homeDir }),

    getProjectMemoryPath: (homeDir: string, projectId: string): Promise<string> =>
      invoke<string>('get_project_memory_path', { homeDir, projectId }),
  };

  // ── Authentication ──────────────────────────────────────────────────────────

  auth = {
    saveToken: (token: string): Promise<void> =>
      invoke<void>('save_auth_token', { token }),

    loadToken: (): Promise<string | null> =>
      invoke<string | null>('load_auth_token'),

    clearToken: (): Promise<void> =>
      invoke<void>('clear_auth_token'),
  };
}
