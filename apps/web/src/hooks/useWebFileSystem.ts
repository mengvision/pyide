/**
 * useWebFileSystem
 *
 * React state management hook for server-side file operations.
 * Provides the same surface as the desktop's `useFileSystem` hook where
 * possible, plus web-specific extras: upload, download, and workspace root
 * fetching.
 *
 * Polling: the hook refreshes the current directory listing every 5 seconds
 * while the tab is focused. Polling is paused on blur and resumed on focus.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileEntry } from '@pyide/platform';
import {
  getWorkspace,
  listFiles,
  readFile,
  writeFile,
  createFile as apiCreateFile,
  createDirectory as apiCreateDirectory,
  deleteFile as apiDeleteFile,
  renameFile as apiRenameFile,
  uploadFile as apiUploadFile,
  downloadFile as apiDownloadFile,
  type UploadProgress,
} from '../services/fileApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebFileSystemState {
  /** Server-provided workspace root path. Null until fetched. */
  workspaceRoot: string | null;
  /** Directory entries currently shown in the file tree. */
  entries: FileEntry[];
  /** Path being listed (workspaceRoot by default). */
  currentPath: string | null;
  /** Map of directory path → loaded children. */
  childrenMap: Map<string, FileEntry[]>;
  /** Set of expanded directory paths. */
  expandedDirs: Set<string>;
  /** Whether the initial workspace load is in progress. */
  loading: boolean;
  /** Non-fatal error message from the last failed operation. */
  error: string | null;
}

export interface WebFileSystemActions {
  /** Reload the root workspace directory listing. */
  loadDirectory(path?: string): Promise<void>;
  /** Read a file from the server and open it in the editor store. */
  openFile(path: string): Promise<string>;
  /** Save the given content to a server-side file. */
  saveFile(path: string, content: string): Promise<void>;
  /** Create a new empty file at the specified path. */
  createFile(path: string): Promise<void>;
  /** Create a new directory at the specified path. */
  createFolder(path: string): Promise<void>;
  /** Delete a file or directory. */
  deleteItem(path: string): Promise<void>;
  /** Rename / move a file or directory. */
  renameItem(oldPath: string, newPath: string): Promise<void>;
  /** Upload browser File objects to a destination directory on the server. */
  uploadFiles(
    files: File[],
    destDir: string,
    onProgress?: (file: string, p: UploadProgress) => void,
  ): Promise<void>;
  /** Trigger a browser download for a server-side file. */
  downloadFile(path: string): Promise<void>;
  /** Refresh children for a specific directory (used by the file tree). */
  refreshDirectory(path: string): Promise<FileEntry[]>;
  /** Clear the non-fatal error state. */
  clearError(): void;
}

export type UseWebFileSystemReturn = WebFileSystemState & WebFileSystemActions;

// ── Hook ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

export function useWebFileSystem(token: string | null): UseWebFileSystemReturn {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [childrenMap, setChildrenMap] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocusedRef = useRef(true);

  // ── Workspace root fetch on token ────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getWorkspace(token)
      .then((ws) => {
        if (cancelled) return;
        setWorkspaceRoot(ws.root_path);
        setCurrentPath(ws.root_path);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Non-fatal: workspace path unknown until the server responds.
        console.warn('Failed to fetch workspace root:', err);
      });

    return () => { cancelled = true; };
  }, [token]);

  // ── Load a directory ─────────────────────────────────────────────────────
  const loadDirectory = useCallback(async (path?: string) => {
    if (!token) return;
    const target = path ?? workspaceRoot;
    if (!target) return;

    setLoading(true);
    setError(null);
    try {
      const result = await listFiles(token, target);
      setEntries(result);
      setCurrentPath(target);
      // Reset tree state when root changes
      if (target !== currentPath) {
        setChildrenMap(new Map());
        setExpandedDirs(new Set());
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [token, workspaceRoot, currentPath]);

  // ── Initial load when workspace root becomes available ───────────────────
  useEffect(() => {
    if (workspaceRoot) {
      loadDirectory(workspaceRoot).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  // ── Polling (focus-aware) ────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      if (isFocusedRef.current && token && currentPath) {
        listFiles(token, currentPath)
          .then((result) => setEntries(result))
          .catch(() => { /* silent polling failure */ });
      }
    }, POLL_INTERVAL_MS);
  }, [token, currentPath]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onFocus = () => { isFocusedRef.current = true; };
    const onBlur = () => { isFocusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (token && currentPath) {
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [token, currentPath, startPolling, stopPolling]);

  // ── File operations ──────────────────────────────────────────────────────

  const openFile = useCallback(async (path: string): Promise<string> => {
    if (!token) throw new Error('Not authenticated');
    return readFile(token, path);
  }, [token]);

  const saveFile = useCallback(async (path: string, content: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await writeFile(token, path, content);
  }, [token]);

  const createFile = useCallback(async (path: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiCreateFile(token, path);
    await loadDirectory(currentPath ?? undefined);
  }, [token, currentPath, loadDirectory]);

  const createFolder = useCallback(async (path: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiCreateDirectory(token, path);
    await loadDirectory(currentPath ?? undefined);
  }, [token, currentPath, loadDirectory]);

  const deleteItem = useCallback(async (path: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiDeleteFile(token, path);
    await loadDirectory(currentPath ?? undefined);
  }, [token, currentPath, loadDirectory]);

  const renameItem = useCallback(async (oldPath: string, newPath: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiRenameFile(token, oldPath, newPath);
    await loadDirectory(currentPath ?? undefined);
  }, [token, currentPath, loadDirectory]);

  const uploadFiles = useCallback(async (
    files: File[],
    destDir: string,
    onProgress?: (file: string, p: UploadProgress) => void,
  ): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    for (const file of files) {
      const destPath = `${destDir}/${file.name}`;
      await apiUploadFile(
        token,
        file,
        destPath,
        onProgress ? (p) => onProgress(file.name, p) : undefined,
      );
    }
    await loadDirectory(currentPath ?? undefined);
  }, [token, currentPath, loadDirectory]);

  const downloadFile = useCallback(async (path: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await apiDownloadFile(token, path);
  }, [token]);

  const refreshDirectory = useCallback(async (path: string): Promise<FileEntry[]> => {
    if (!token) return [];
    try {
      const children = await listFiles(token, path);
      setChildrenMap((prev) => {
        const next = new Map(prev);
        next.set(path, children);
        return next;
      });
      return children;
    } catch {
      return [];
    }
  }, [token]);

  const clearError = useCallback(() => setError(null), []);

  return {
    workspaceRoot,
    entries,
    currentPath,
    childrenMap,
    expandedDirs,
    loading,
    error,
    loadDirectory,
    openFile,
    saveFile,
    createFile,
    createFolder,
    deleteItem,
    renameItem,
    uploadFiles,
    downloadFile,
    refreshDirectory,
    clearError,
  };
}
