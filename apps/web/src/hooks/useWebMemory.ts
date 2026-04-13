/**
 * useWebMemory Hook
 *
 * React hook that loads and manages memory entries through the Phase 3 server
 * REST API. Memories are grouped by scope for display in the sidebar panel.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import * as memoryApi from '../services/memoryApi';
import type { MemoryEntry, DreamStatus, MemoryScope } from '../services/memoryApi';

export type { MemoryEntry, DreamStatus, MemoryScope };

interface UseWebMemoryOptions {
  /** Auth token from useWebAuth */
  token: string | null;
  /** Initial scope filter (default: load all) */
  defaultScope?: MemoryScope;
}

/** Memories grouped by scope */
export interface MemoriesByScope {
  session: MemoryEntry[];
  project: MemoryEntry[];
  user: MemoryEntry[];
  global: MemoryEntry[];
}

export interface UseWebMemoryReturn {
  /** All loaded memory entries */
  memories: MemoryEntry[];
  /** Memories grouped by scope */
  memoriesByScope: MemoriesByScope;
  /** True while the initial load is in progress */
  loading: boolean;
  /** Last error from any API call */
  error: string | null;
  /** Current dream-mode status (polled periodically) */
  dreamStatus: DreamStatus | null;
  /** Save (create) a new memory entry on the server */
  saveMemory: (memory: Omit<MemoryEntry, 'id'>) => Promise<void>;
  /** Delete a memory entry by ID */
  deleteMemory: (id: string) => Promise<void>;
  /** Promote a memory to a higher scope */
  promoteMemory: (id: string, targetScope: MemoryScope) => Promise<void>;
  /** Manually trigger dream-mode consolidation */
  triggerDreamMode: () => Promise<void>;
  /** Reload the full memory list from the server */
  reloadMemories: () => Promise<void>;
  /** Build a context string of all memories for system-prompt injection */
  getMemoriesContext: () => string;
}

export function useWebMemory({
  token,
  defaultScope,
}: UseWebMemoryOptions): UseWebMemoryReturn {
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dreamStatus, setDreamStatus] = useState<DreamStatus | null>(null);

  const loadingRef = useRef(false);

  // ── Load memories ─────────────────────────────────────────────────────────

  const reloadMemories = useCallback(async () => {
    if (!token || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await memoryApi.listMemories(serverUrl, token, defaultScope);
      setMemories(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWebMemory] reloadMemories error:', msg);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [token, serverUrl, defaultScope]);

  useEffect(() => {
    reloadMemories();
  }, [reloadMemories]);

  // ── Poll dream status ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const poll = async () => {
      try {
        const status = await memoryApi.getDreamStatus(serverUrl, token);
        setDreamStatus(status);
      } catch {
        // Silently ignore poll errors — server may not be running yet
      }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 30_000); // every 30 s
    return () => clearInterval(interval);
  }, [token, serverUrl]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveMemory = useCallback(
    async (memory: Omit<MemoryEntry, 'id'>) => {
      if (!token) return;
      setError(null);
      try {
        const created = await memoryApi.saveMemory(serverUrl, token, memory);
        setMemories((prev) => [...prev, created]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebMemory] saveMemory error:', msg);
        throw err;
      }
    },
    [token, serverUrl],
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMemory = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);

      // Optimistic removal
      setMemories((prev) => prev.filter((m) => m.id !== id));

      try {
        await memoryApi.deleteMemory(serverUrl, token, id);
      } catch (err) {
        // Restore on failure
        await reloadMemories();
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebMemory] deleteMemory error:', msg);
      }
    },
    [token, serverUrl, reloadMemories],
  );

  // ── Promote ───────────────────────────────────────────────────────────────

  const promoteMemory = useCallback(
    async (id: string, targetScope: MemoryScope) => {
      if (!token) return;
      setError(null);
      try {
        const updated = await memoryApi.promoteMemory(
          serverUrl,
          token,
          id,
          targetScope,
        );
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? updated : m)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebMemory] promoteMemory error:', msg);
      }
    },
    [token, serverUrl],
  );

  // ── Trigger dream mode ────────────────────────────────────────────────────

  const triggerDreamMode = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const report = await memoryApi.triggerDreamMode(serverUrl, token);
      setDreamStatus({ isRunning: false, lastRun: report.timestamp, lastReport: report });
      // Reload memories after consolidation
      await reloadMemories();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWebMemory] triggerDreamMode error:', msg);
    }
  }, [token, serverUrl, reloadMemories]);

  // ── Derived: memories grouped by scope ───────────────────────────────────

  const memoriesByScope: MemoriesByScope = {
    session: memories.filter((m) => m.sessionId && !m.projectId),
    project: memories.filter((m) => m.projectId),
    user: memories.filter((m) => m.type === 'user'),
    global: memories.filter(
      (m) => !m.sessionId && !m.projectId && m.type !== 'user',
    ),
  };

  // ── Derived: context string for system prompt ─────────────────────────────

  const getMemoriesContext = useCallback((): string => {
    if (memories.length === 0) return '';

    const parts: string[] = [];

    const projectMems = memories.filter((m) => m.projectId);
    if (projectMems.length > 0) {
      parts.push('Project Memories:');
      projectMems.forEach((m) => parts.push(`- [${m.type}] ${m.content}`));
    }

    const userPrefs = memories.filter((m) => m.type === 'user');
    if (userPrefs.length > 0) {
      parts.push('\nUser Preferences:');
      userPrefs.forEach((m) => parts.push(`- ${m.content}`));
    }

    return parts.join('\n');
  }, [memories]);

  return {
    memories,
    memoriesByScope,
    loading,
    error,
    dreamStatus,
    saveMemory,
    deleteMemory,
    promoteMemory,
    triggerDreamMode,
    reloadMemories,
    getMemoriesContext,
  };
}
