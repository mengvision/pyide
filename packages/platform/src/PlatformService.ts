/**
 * PlatformService — the single abstraction interface over all platform-specific
 * I/O operations. Implementations exist for Tauri (desktop) and REST (web).
 */

import type {
  FileEntry,
  VenvInfo,
  PackageInfo,
  KernelStartInfo,
  KernelStatus,
  SkillEntry,
  MCPServerStatus,
} from './types';

export interface PlatformService {
  // ── File Operations ─────────────────────────────────────────────────────────
  file: {
    /** Read the text content of a file. */
    read(path: string): Promise<string>;
    /** Write text content to a file, creating it if necessary. */
    write(path: string, content: string): Promise<void>;
    /** List the contents of a directory. */
    readDirectory(path: string, recursive?: boolean, maxDepth?: number): Promise<FileEntry[]>;
    /** Create an empty file at the given path. */
    createFile(path: string): Promise<void>;
    /** Create a directory (and any intermediate directories) at the given path. */
    createDirectory(path: string): Promise<void>;
    /** Delete a file or directory. */
    delete(path: string): Promise<void>;
    /** Rename / move a file or directory. */
    rename(oldPath: string, newPath: string): Promise<void>;
    /** Open a native folder picker dialog and return the chosen path, or null. */
    pickFolder(): Promise<string | null>;
    /** Return the current user's home directory path. */
    getHomeDir(): Promise<string>;
  };

  // ── Environment Management (desktop-only, optional for web) ─────────────────
  env?: {
    /** Check whether the `uv` tool is installed on the system. */
    checkUv(): Promise<boolean>;
    /** List virtual environments found in the given project directory. */
    listVenvs(projectPath: string): Promise<VenvInfo[]>;
    /** Create a new virtual environment. */
    createVenv(name: string, projectPath: string, pythonVersion?: string): Promise<VenvInfo>;
    /** Delete an existing virtual environment. */
    deleteVenv(name: string, projectPath: string): Promise<void>;
    /** List packages installed in a virtual environment. */
    listPackages(venvPath: string): Promise<PackageInfo[]>;
    /** Install a package into a virtual environment and return stdout. */
    installPackage(pkg: string, venvPath: string): Promise<string>;
    /** Uninstall a package from a virtual environment. */
    uninstallPackage(pkg: string, venvPath: string): Promise<void>;
    /** Return the absolute path to the Python interpreter inside a venv. */
    getPythonPath(venvPath: string): Promise<string>;
  };

  // ── Kernel Management ───────────────────────────────────────────────────────
  kernel: {
    /** Start the Python kernel and return connection info. */
    start(pykernelPath: string, pythonPath?: string | null): Promise<KernelStartInfo>;
    /** Stop the running kernel. */
    stop(): Promise<void>;
    /** Send an interrupt signal to the running kernel. */
    interrupt(): Promise<void>;
    /** Return the current kernel status. */
    getStatus(): Promise<KernelStatus>;
  };

  // ── Skills System ───────────────────────────────────────────────────────────
  skills: {
    /** Scan the user's local skill directories and return skill entries. */
    scanUserSkills(basePath: string): Promise<SkillEntry[]>;
    /** Scan the ClawHub-installed skills directory. */
    scanClawHubSkills(basePath: string): Promise<SkillEntry[]>;
    /** Return the absolute path to the user skills directory, creating it if needed. */
    getUserSkillsDir(baseDir: string): Promise<string>;
  };

  // ── MCP Server Integration ──────────────────────────────────────────────────
  mcp: {
    /** Start a named MCP server process. */
    startServer(name: string, command: string, args: string[], env?: Record<string, string>): Promise<void>;
    /** Stop a running MCP server process. */
    stopServer(name: string): Promise<void>;
    /** List all known MCP servers and their statuses. */
    listServers(): Promise<MCPServerStatus[]>;
    /** Return the path to the MCP configuration file. */
    getConfigPath(homeDir: string): Promise<string>;
    /** Write a message to an MCP server's stdin. */
    sendMessage(serverName: string, message: string): Promise<void>;
    /** Read a line from an MCP server's stdout. */
    readMessage(serverName: string): Promise<string>;
  };

  // ── Memory System ───────────────────────────────────────────────────────────
  memory: {
    /** Return the base directory where all memory files are stored. */
    getBaseDir(homeDir: string): Promise<string>;
    /** Return the path to the global user memory file. */
    getUserMemoryPath(homeDir: string): Promise<string>;
    /** Return the path to a project-specific memory file. */
    getProjectMemoryPath(homeDir: string, projectId: string): Promise<string>;
  };

  // ── Authentication ──────────────────────────────────────────────────────────
  auth: {
    /** Persist an authentication token in secure (or local) storage. */
    saveToken(token: string): Promise<void>;
    /** Load a previously persisted authentication token, or null if absent. */
    loadToken(): Promise<string | null>;
    /** Remove the stored authentication token. */
    clearToken(): Promise<void>;
  };
}
