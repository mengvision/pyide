/**
 * Skill File Watcher
 *
 * Watches skill directories for file changes and triggers
 * automatic skill list reload. Uses Tauri's FS watcher API
 * (or falls back to polling for web platform).
 *
 * Following Claude Code's skillChangeDetector pattern:
 * - Debounce rapid changes (300ms)
 * - Ignore initial scan
 * - Preserve activation state across reloads
 */

import { useSkillStore } from './index';

const RELOAD_DEBOUNCE_MS = 300;
const POLL_INTERVAL_MS = 5000; // Fallback polling interval

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isWatching = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

// Track file hashes for change detection
let lastFileHash = '';

/**
 * Compute a simple hash of the current skill file states.
 * Used by the polling fallback to detect changes.
 */
async function computeFileHash(): Promise<string> {
  const store = useSkillStore.getState();
  // Simple hash: concatenation of name + path + content length
  return store.skills
    .map(s => `${s.name}:${s.directory}:${s.content.length}`)
    .join('|');
}

/**
 * Trigger a debounced skill reload.
 * Multiple rapid changes are collapsed into a single reload.
 */
function scheduleReload(): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    console.log('[SkillWatcher] Reloading skills due to file changes...');
    await useSkillStore.getState().loadSkills();
  }, RELOAD_DEBOUNCE_MS);
}

/**
 * Initialize the skill file watcher.
 *
 * On Tauri desktop, uses the Tauri FS watcher event.
 * On web, falls back to periodic polling.
 *
 * @param platform - The platform service instance
 */
export async function initSkillWatcher(platform: any): Promise<void> {
  if (isWatching) return;
  isWatching = true;

  // Capture initial state
  lastFileHash = await computeFileHash();

  // Try Tauri event-based watching
  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen('skill-file-changed', () => {
      scheduleReload();
    });
    console.log('[SkillWatcher] Tauri event listener registered');
    return;
  } catch {
    // Not running in Tauri — fall back to polling
  }

  // Fallback: poll for changes
  pollIntervalId = setInterval(async () => {
    try {
      const currentHash = await computeFileHash();
      if (currentHash !== lastFileHash) {
        lastFileHash = currentHash;
        scheduleReload();
      }
    } catch {
      // Ignore errors during polling
    }
  }, POLL_INTERVAL_MS);

  console.log('[SkillWatcher] Polling fallback initialized');
}

/**
 * Stop watching for skill file changes.
 */
export function disposeSkillWatcher(): void {
  isWatching = false;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}
