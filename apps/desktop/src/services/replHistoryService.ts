/**
 * replHistoryService — REPL history persistence service.
 *
 * Saves/loads REPL execution history to/from the workspace directory:
 *   - `.pyide_history`      — human-readable plain text (for grep/reading)
 *   - `.pyide_history.json` — full JSON (for reliable restoration)
 */

import type { PlatformService } from '@pyide/platform';
import type { ReplEntry, OutputData } from '@pyide/protocol/kernel';

const MAX_HISTORY_ENTRIES = 200;

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function formatOutput(output: OutputData): string {
  switch (output.type) {
    case 'text':
      return typeof output.data === 'string' ? output.data : String(output.data ?? '');
    case 'error':
      return typeof output.data === 'string' ? output.data : String(output.data ?? '');
    case 'dataframe':
      return '[DataFrame output]';
    case 'chart':
      return '[Chart output]';
    default:
      return String(output.data ?? '');
  }
}

function entryToText(entry: ReplEntry): string {
  const header = `# [${formatTimestamp(entry.timestamp)}] In [${entry.executionCount}]`;
  const codeLines = entry.code
    .split('\n')
    .map((line) => `>>> ${line}`)
    .join('\n');
  const outputLines = entry.outputs.map(formatOutput).filter(Boolean).join('\n');
  return outputLines ? `${header}\n${codeLines}\n${outputLines}` : `${header}\n${codeLines}`;
}

function historyToText(history: ReplEntry[]): string {
  return history.map(entryToText).join('\n\n') + '\n';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Save REPL history to the workspace.
 *
 * Writes two files:
 *   - `{workspacePath}/.pyide_history`      — human-readable text
 *   - `{workspacePath}/.pyide_history.json` — full JSON for restoration
 *
 * Silently trims to the most recent MAX_HISTORY_ENTRIES entries.
 */
export async function saveHistory(
  platform: PlatformService,
  workspacePath: string,
  history: ReplEntry[],
): Promise<void> {
  if (!workspacePath) return;

  // Trim to last MAX_HISTORY_ENTRIES
  const trimmed = history.length > MAX_HISTORY_ENTRIES
    ? history.slice(history.length - MAX_HISTORY_ENTRIES)
    : history;

  const textPath = `${workspacePath}/.pyide_history`;
  const jsonPath = `${workspacePath}/.pyide_history.json`;

  // Write both files concurrently
  await Promise.all([
    platform.file.write(textPath, historyToText(trimmed)),
    platform.file.write(jsonPath, JSON.stringify(trimmed, null, 2)),
  ]);
}

/**
 * Load REPL history from the workspace.
 *
 * Prefers `.pyide_history.json` for complete data.
 * Falls back to an empty array if the file doesn't exist or is malformed.
 */
export async function loadHistory(
  platform: PlatformService,
  workspacePath: string,
): Promise<ReplEntry[]> {
  if (!workspacePath) return [];

  const jsonPath = `${workspacePath}/.pyide_history.json`;

  try {
    const raw = await platform.file.read(jsonPath);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[replHistoryService] .pyide_history.json is not an array, ignoring');
      return [];
    }
    // Basic shape validation — keep only well-formed entries
    const valid: ReplEntry[] = parsed.filter(
      (e: any) =>
        e &&
        typeof e.id === 'string' &&
        typeof e.code === 'string' &&
        Array.isArray(e.outputs) &&
        typeof e.executionCount === 'number' &&
        typeof e.timestamp === 'number',
    );
    return valid;
  } catch (err: any) {
    // File not found is expected on first launch — not an error worth logging
    const isNotFound =
      err?.message?.includes('No such file') ||
      err?.message?.includes('not found') ||
      err?.message?.includes('os error 2') ||
      err?.message?.includes('ENOENT') ||
      err?.code === 'ENOENT';

    if (!isNotFound) {
      console.warn('[replHistoryService] Failed to load history:', err);
    }
    return [];
  }
}
