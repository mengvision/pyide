/**
 * Memory Query Service
 *
 * Retrieves memories relevant to a given query string using keyword matching.
 * Used before each AI chat message to inject contextual memories into the
 * system prompt without token bloat (capped at top-N most relevant entries).
 */

import type { PlatformService } from '@pyide/platform';
import { MemoryStorage } from './storage';
import type { MemoryEntry } from '../../types/memory';

/** Maximum number of memories to include in the context. */
const MAX_MEMORIES = 5;

/**
 * Score a single memory entry against the query tokens.
 * Returns the number of matching keywords (case-insensitive).
 */
function scoreMemory(entry: MemoryEntry, queryTokens: string[]): number {
  const haystack = `${entry.content} ${entry.context ?? ''}`.toLowerCase();
  return queryTokens.reduce((score, token) => {
    return score + (haystack.includes(token) ? 1 : 0);
  }, 0);
}

/**
 * Tokenise a query string into meaningful lowercase words (≥ 3 chars).
 */
function tokenise(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/**
 * Query memories relevant to the given message text.
 *
 * Strategy:
 *   1. Load all project + user memories from disk.
 *   2. Score each memory by counting query-token matches.
 *   3. Pinned memories always get a bonus score so they surface first.
 *   4. Return the top `maxResults` entries that have at least one match,
 *      falling back to all pinned memories if nothing else matches.
 *
 * @param query        The user's message text used as the retrieval query.
 * @param platform     Platform service for file I/O.
 * @param projectId    Optional project ID for project-scoped memories.
 * @param maxResults   Maximum number of memories to return (default 5).
 */
export async function queryRelevantMemories(
  query: string,
  platform: PlatformService,
  projectId?: string,
  maxResults: number = MAX_MEMORIES,
): Promise<MemoryEntry[]> {
  try {
    const storage = new MemoryStorage(platform);

    // Load all available memories in parallel
    const [userMemories, projectMemories] = await Promise.all([
      storage.loadUserMemory(),
      projectId ? storage.loadProjectMemory(projectId) : Promise.resolve([] as MemoryEntry[]),
    ]);

    const allMemories: MemoryEntry[] = [...projectMemories, ...userMemories];

    if (allMemories.length === 0) {
      return [];
    }

    const queryTokens = tokenise(query);

    if (queryTokens.length === 0) {
      // No meaningful query tokens — return pinned memories only
      return allMemories.filter((m) => m.isPinned).slice(0, maxResults);
    }

    // Score each memory
    const scored = allMemories.map((entry) => {
      const baseScore = scoreMemory(entry, queryTokens);
      // Pinned memories get a +2 bonus to always surface important entries
      const pinnedBonus = entry.isPinned ? 2 : 0;
      return { entry, score: baseScore + pinnedBonus };
    });

    // Sort by descending score; ties broken by recency (latest first)
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.entry.timestamp).getTime() -
        new Date(a.entry.timestamp).getTime()
      );
    });

    // Take top-N with at least 1 match (or pinned bonus)
    const relevant = scored
      .filter((s) => s.score > 0)
      .slice(0, maxResults)
      .map((s) => s.entry);

    return relevant;
  } catch (error) {
    console.warn('[MemoryQuery] Failed to retrieve memories:', error);
    return [];
  }
}

/**
 * Format retrieved memory entries into a compact string for the system prompt.
 *
 * Output example:
 *   [project] User prefers Plotly for visualizations
 *   [user] Prefers dark-mode themes
 */
export function formatMemoriesForPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) return '';

  return memories
    .map((m) => {
      const pinFlag = m.isPinned ? ' ★' : '';
      const contextNote = m.context ? ` (${m.context})` : '';
      return `[${m.type}]${pinFlag} ${m.content}${contextNote}`;
    })
    .join('\n');
}
