/**
 * useWebSkills Hook
 *
 * React hook that loads skill data from the server API and maintains
 * local enabled/disabled state in sync with the server.
 *
 * Auto-trigger logic mirrors the desktop `autoTrigger.ts` module:
 *   - DataFrame variables → activate EDA skill
 *   - ndarray / Series  → activate Viz skill
 *   - Error output       → activate Debug skill
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import * as skillsApi from '../services/skillsApi';
import type { LoadedSkill } from '../services/skillsApi';

export type { LoadedSkill };

interface UseWebSkillsOptions {
  /** Auth token from useWebAuth */
  token: string | null;
}

export interface UseWebSkillsReturn {
  /** Full list of skills returned by the server */
  skills: LoadedSkill[];
  /** Set of currently-active skill IDs (local state, synced to server) */
  activeSkillIds: Set<string>;
  /** True while the initial load is in progress */
  loading: boolean;
  /** Last error from any API call */
  error: string | null;
  /** Toggle a skill on / off (calls server then updates local state) */
  toggleSkill: (id: string) => Promise<void>;
  /** Install a ClawHub skill by name */
  installSkill: (name: string) => Promise<void>;
  /** Uninstall a skill by ID */
  uninstallSkill: (id: string) => Promise<void>;
  /** Reload the skill list from the server */
  reloadSkills: () => Promise<void>;
  /** Returns concatenated content of all active skills for system-prompt injection */
  getActiveSkillContent: () => string;
  /** Auto-trigger skills based on a variable inspection result */
  checkAutoTriggers: (variableName: string, variableType: string) => void;
  /** Auto-trigger the debug skill on error output */
  checkErrorAutoTrigger: (errorMessage: string) => void;
}

export function useWebSkills({ token }: UseWebSkillsOptions): UseWebSkillsReturn {
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const [skills, setSkills] = useState<LoadedSkill[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate concurrent loads
  const loadingRef = useRef(false);

  // ── Load skills ───────────────────────────────────────────────────────────

  const reloadSkills = useCallback(async () => {
    if (!token || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await skillsApi.listSkills(serverUrl, token);
      setSkills(data);
      // Restore active state from skill metadata returned by server
      const active = new Set<string>(
        data.filter((s) => s.isActive).map((s) => s.id),
      );
      setActiveSkillIds(active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWebSkills] reloadSkills error:', msg);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [token, serverUrl]);

  // Load on mount / when auth changes
  useEffect(() => {
    reloadSkills();
  }, [reloadSkills]);

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggleSkill = useCallback(
    async (id: string) => {
      if (!token) return;
      const currentlyEnabled = activeSkillIds.has(id);
      const newEnabled = !currentlyEnabled;

      // Optimistic update
      setActiveSkillIds((prev) => {
        const next = new Set(prev);
        if (newEnabled) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
      setSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: newEnabled } : s)),
      );

      try {
        await skillsApi.toggleSkill(serverUrl, token, id, newEnabled);
      } catch (err) {
        // Revert on failure
        setActiveSkillIds((prev) => {
          const next = new Set(prev);
          if (currentlyEnabled) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
        setSkills((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, isActive: currentlyEnabled } : s,
          ),
        );
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebSkills] toggleSkill error:', msg);
      }
    },
    [token, serverUrl, activeSkillIds],
  );

  // ── Install ───────────────────────────────────────────────────────────────

  const installSkill = useCallback(
    async (name: string) => {
      if (!token) return;
      setError(null);
      try {
        await skillsApi.installSkill(serverUrl, token, {
          name,
          source: 'clawhub',
        });
        await reloadSkills();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebSkills] installSkill error:', msg);
      }
    },
    [token, serverUrl, reloadSkills],
  );

  // ── Uninstall ─────────────────────────────────────────────────────────────

  const uninstallSkill = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);
      try {
        await skillsApi.uninstallSkill(serverUrl, token, id);
        await reloadSkills();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useWebSkills] uninstallSkill error:', msg);
      }
    },
    [token, serverUrl, reloadSkills],
  );

  // ── Derived helpers ───────────────────────────────────────────────────────

  const getActiveSkillContent = useCallback((): string => {
    const activeContents = skills
      .filter((s) => activeSkillIds.has(s.id))
      .map((s) => `## Skill: ${s.name}\n\n${s.content}`);

    if (activeContents.length === 0) return '';
    return '\n\n---\n\n' + activeContents.join('\n\n---\n\n');
  }, [skills, activeSkillIds]);

  // ── Auto-trigger logic ────────────────────────────────────────────────────

  const checkAutoTriggers = useCallback(
    (variableName: string, variableType: string) => {
      if (
        variableType.includes('DataFrame') ||
        variableType.includes('pd.DataFrame')
      ) {
        const edaSkill = skills.find((s) => s.name === 'eda');
        if (edaSkill && !activeSkillIds.has(edaSkill.id)) {
          toggleSkill(edaSkill.id);
          console.log(`[useWebSkills] EDA skill auto-triggered for ${variableName}`);
        }
      }

      if (
        variableType.includes('ndarray') ||
        variableType.includes('Series')
      ) {
        const vizSkill = skills.find((s) => s.name === 'viz');
        if (vizSkill && !activeSkillIds.has(vizSkill.id)) {
          toggleSkill(vizSkill.id);
          console.log(`[useWebSkills] Viz skill auto-triggered for ${variableName}`);
        }
      }
    },
    [skills, activeSkillIds, toggleSkill],
  );

  const checkErrorAutoTrigger = useCallback(
    (errorMessage: string) => {
      if (
        errorMessage.includes('Error') ||
        errorMessage.includes('Exception') ||
        errorMessage.includes('Traceback')
      ) {
        const debugSkill = skills.find((s) => s.name === 'debug');
        if (debugSkill && !activeSkillIds.has(debugSkill.id)) {
          toggleSkill(debugSkill.id);
          console.log('[useWebSkills] Debug skill auto-triggered on error');
        }
      }
    },
    [skills, activeSkillIds, toggleSkill],
  );

  return {
    skills,
    activeSkillIds,
    loading,
    error,
    toggleSkill,
    installSkill,
    uninstallSkill,
    reloadSkills,
    getActiveSkillContent,
    checkAutoTriggers,
    checkErrorAutoTrigger,
  };
}
