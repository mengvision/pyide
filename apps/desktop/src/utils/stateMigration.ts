/**
 * stateMigration.ts
 *
 * Utilities for migrating Python kernel namespace variables when the user
 * switches between LOCAL and REMOTE kernel modes.
 *
 * Strategy:
 *  - Variables under SIZE_THRESHOLD are serialised to JSON and re-assigned in
 *    the destination kernel via a code execution call.
 *  - Variables over the threshold (e.g. large DataFrames / ndarrays) get a
 *    commented-out rebuild stub injected instead.
 *  - Non-serialisable variables (functions, modules, etc.) are dropped.
 */

export interface VariableInfo {
  name: string;
  type: string;
  /** Estimated size in bytes */
  size: number;
  /** Serialised value, if available */
  value?: unknown;
  /** Commented-out rebuild hint for large / complex objects */
  rebuildCode?: string;
}

export interface MigrationReport {
  /** Variables that will be transferred directly (<= SIZE_THRESHOLD) */
  transferred: VariableInfo[];
  /** Variables too large to copy — a rebuild stub will be created */
  stubbed: VariableInfo[];
  /** Variables that cannot be migrated (functions, modules, etc.) */
  dropped: VariableInfo[];
}

/** Variables larger than 1 MB will be stubbed instead of copied */
const SIZE_THRESHOLD = 1024 * 1024;

/** Python types that are never serialisable across kernels */
const NON_SERIALISABLE_TYPES = new Set([
  'function',
  'module',
  'builtin_function_or_method',
  'method',
  'method-wrapper',
  'type',
  'classobj',
  'instancemethod',
  'generator',
  'coroutine',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Infinity; // treat unserializable as infinite size
  }
}

/**
 * Produce a commented rebuild hint for common heavy Python types.
 */
function generateRebuildCode(v: { name: string; type: string }): string | undefined {
  switch (v.type) {
    case 'DataFrame':
      return (
        `# '${v.name}' was too large to migrate automatically.\n` +
        `# Rebuild it by re-reading its source:\n` +
        `# ${v.name} = pd.read_csv('your_data.csv')`
      );
    case 'ndarray':
      return (
        `# '${v.name}' was too large to migrate automatically.\n` +
        `# Rebuild it by loading from disk:\n` +
        `# ${v.name} = np.load('your_data.npy')`
      );
    case 'Series':
      return (
        `# '${v.name}' was too large to migrate automatically.\n` +
        `# Rebuild it:\n` +
        `# ${v.name} = pd.read_csv('your_data.csv')['column']`
      );
    default:
      return undefined;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call `inspectAll` on the *current* kernel and normalise the result into a
 * list of {@link VariableInfo} objects ready for classification.
 *
 * @param inspectAll  The `inspectAll` function from the active kernel hook.
 *                    It must return (or resolve to) an object with a
 *                    `variables` array, each item having at minimum `name` and
 *                    `type` fields.  The optional `value` field is used for
 *                    size estimation and direct transfer.
 */
export async function analyzeNamespace(
  inspectAll: () => Promise<{ variables: Array<{ name: string; type: string; size?: number; value?: unknown }> } | undefined | void>,
): Promise<VariableInfo[]> {
  let result: { variables: Array<{ name: string; type: string; size?: number; value?: unknown }> } | undefined | void;

  try {
    result = await inspectAll();
  } catch (err) {
    console.warn('[stateMigration] analyzeNamespace: inspectAll failed', err);
    return [];
  }

  const raw = result?.variables ?? [];

  return raw.map((v) => ({
    name: v.name,
    type: v.type ?? 'unknown',
    size: v.size ?? estimateSize(v.value),
    value: v.value,
    rebuildCode: generateRebuildCode(v),
  }));
}

/**
 * Classify a list of variables into the three migration buckets.
 */
export function classifyVariables(vars: VariableInfo[]): MigrationReport {
  const transferred: VariableInfo[] = [];
  const stubbed: VariableInfo[] = [];
  const dropped: VariableInfo[] = [];

  for (const v of vars) {
    // Drop non-serialisable types immediately
    if (NON_SERIALISABLE_TYPES.has(v.type)) {
      dropped.push(v);
      continue;
    }

    // Variables with an Infinity size are non-serialisable at runtime
    if (v.size === Infinity) {
      dropped.push(v);
      continue;
    }

    if (v.size <= SIZE_THRESHOLD) {
      // Only include if we actually have a value to re-assign
      if (v.value !== undefined) {
        transferred.push(v);
      } else {
        // No value available — drop unless we have a rebuild stub
        if (v.rebuildCode) {
          stubbed.push(v);
        } else {
          dropped.push(v);
        }
      }
    } else {
      // Over threshold
      if (v.rebuildCode) {
        stubbed.push(v);
      } else {
        dropped.push(v);
      }
    }
  }

  return { transferred, stubbed, dropped };
}

/**
 * Execute the migration against the *destination* kernel:
 *
 * 1. Re-assign each "transferred" variable as a JSON literal.
 * 2. Inject commented rebuild stubs for "stubbed" variables so the user sees
 *    them in the output area.
 *
 * Errors are caught per-variable; a partial failure does NOT abort the entire
 * migration.
 *
 * @param report       The classified migration report.
 * @param executeCode  The `executeCode` function from the *destination* kernel
 *                     hook (already switched to the new mode at call time).
 * @returns            A list of variable names that failed to transfer.
 */
export async function executeMigration(
  report: MigrationReport,
  executeCode: (code: string, cellId?: string) => Promise<unknown>,
): Promise<string[]> {
  const failed: string[] = [];

  // Re-assign lightweight variables
  for (const v of report.transferred) {
    if (v.value === undefined) continue;
    try {
      const serialised = JSON.stringify(v.value);
      const code = `${v.name} = ${serialised}`;
      await executeCode(code, `migration-${v.name}`);
    } catch (err) {
      console.warn(`[stateMigration] Failed to transfer '${v.name}':`, err);
      failed.push(v.name);
    }
  }

  // Inject rebuild stubs so the user sees guidance
  for (const v of report.stubbed) {
    if (!v.rebuildCode) continue;
    try {
      const sizeMb = (v.size / 1024 / 1024).toFixed(1);
      const code =
        `# ── Migration stub for '${v.name}' (${sizeMb} MB — too large to copy) ──\n` +
        v.rebuildCode;
      await executeCode(code, `migration-stub-${v.name}`);
    } catch {
      // Non-fatal — stubs are informational only
    }
  }

  return failed;
}
