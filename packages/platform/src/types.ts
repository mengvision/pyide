/**
 * Shared types for the PlatformService abstraction layer.
 * These mirror the data shapes returned by the Tauri backend.
 */

/** A file or directory entry returned from file system operations. */
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

/** Information about a Python virtual environment. */
export interface VenvInfo {
  name: string;
  path: string;
  pythonVersion: string;
}

/** A Python package installed in a venv. */
export interface PackageInfo {
  name: string;
  version: string;
}

/** Information returned when a kernel is started. */
export interface KernelStartInfo {
  port: number;
  status: string;
}

/** Kernel connection status string. */
export type KernelStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/** A skill entry loaded from disk or ClawHub. */
export interface SkillEntry {
  name: string;
  path: string;
  content: string;
}

/** MCP server runtime status. */
export interface MCPServerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  error?: string;
}
