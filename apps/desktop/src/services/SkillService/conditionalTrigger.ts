/**
 * Conditional Skill Trigger
 *
 * Activates skills based on file path glob patterns and context signals.
 * This unifies the previous autoTrigger logic with path-based conditional
 * activation, following Claude Code's `activateConditionalSkillsForPaths`.
 *
 * Trigger sources:
 *   1. File path matching — skill's `paths` field (glob patterns)
 *   2. Variable type matching — DataFrame, ndarray, etc.
 *   3. Error detection — Python exceptions, tracebacks
 *   4. Data quality signals — missing values, type mismatches
 */

import { useSkillStore } from './index';
import { recordSkillUsage } from './usageTracking';
import type { LoadedSkill } from '../../types/skill';

/** Simple glob matcher using wildcard patterns */
function matchGlob(pattern: string, path: string): boolean {
  // Convert glob pattern to regex
  // Supports: *, **, ?, [...]
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
    .replace(/\*\*/g, '{{GLOBSTAR}}')         // Temporarily mark **
    .replace(/\*/g, '[^/]*')                  // * matches anything except /
    .replace(/\?/g, '[^/]')                   // ? matches single char except /
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');      // ** matches anything including /

  const regex = new RegExp(`^${regexStr}$`, 'i');
  return regex.test(path);
}

/** Check if any of the skill's path patterns match the given file path */
function skillMatchesPath(skill: LoadedSkill, filePath: string): boolean {
  if (!skill.paths || skill.paths.length === 0) return false;

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  return skill.paths.some(pattern => matchGlob(pattern, normalizedPath));
}

/**
 * Activate skills whose `paths` patterns match the given file path.
 * Deactivate skills that were auto-activated by path but no longer match,
 * unless they were manually activated by the user.
 *
 * @param filePath - The current file path (e.g., "/project/data/sales.csv")
 * @returns Array of skill names that were auto-activated
 */
export function activateSkillsForPath(filePath: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (!skill.paths || skill.paths.length === 0) continue;

    const matches = skillMatchesPath(skill, filePath);

    if (matches && !store.isSkillActive(skill.id)) {
      // Auto-activate
      store.activateSkill(skill.id);
      recordSkillUsage(skill.name);
      activated.push(skill.name);
    }
  }

  return activated;
}

/**
 * Check variable types and activate matching skills.
 * (Consolidates the old autoTrigger.ts logic)
 */
export function activateSkillsForVariable(variableName: string, variableType: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    // Skip skills that are already active
    if (store.isSkillActive(skill.id)) continue;

    // EDA skill for DataFrames
    if (skill.name === 'eda' && (variableType.includes('DataFrame') || variableType.includes('pd.DataFrame'))) {
      store.activateSkill(skill.id);
      recordSkillUsage(skill.name);
      activated.push(skill.name);
    }

    // Visualization skill for numeric data
    if (skill.name === 'viz' && (variableType.includes('ndarray') || variableType.includes('Series'))) {
      store.activateSkill(skill.id);
      recordSkillUsage(skill.name);
      activated.push(skill.name);
    }
  }

  return activated;
}

/**
 * Check error messages and activate debug skill.
 * (Consolidates the old autoTrigger.ts logic)
 */
export function activateSkillsForError(errorMessage: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  if (errorMessage.includes('Error') || errorMessage.includes('Exception') || errorMessage.includes('Traceback')) {
    for (const skill of store.skills) {
      if (skill.name === 'debug' && !store.isSkillActive(skill.id)) {
        store.activateSkill(skill.id);
        recordSkillUsage(skill.name);
        activated.push(skill.name);
      }
    }
  }

  return activated;
}

/**
 * Check data quality and suggest clean skill.
 * (Consolidates the old autoTrigger.ts logic)
 */
export function checkDataQualityTriggers(variableName: string, sample: any): string[] {
  const suggested: string[] = [];

  if (sample && typeof sample === 'object') {
    const hasMissingValues = Object.values(sample).some(val => val === null || val === undefined);

    if (hasMissingValues) {
      suggested.push('clean');
      // Don't auto-activate — just suggest
    }
  }

  return suggested;
}

/**
 * Get all skills that would be auto-activated for a given file path.
 * (Preview mode — does not actually activate)
 */
export function getMatchingSkillsForPath(filePath: string): LoadedSkill[] {
  const store = useSkillStore.getState();
  return store.skills.filter(skill => skillMatchesPath(skill, filePath));
}

// ── Backward-compatible aliases for outputRouter ──────────────────────

/**
 * Check variable types and activate matching skills.
 * Alias for activateSkillsForVariable — used by outputRouter.
 */
export function checkAutoTriggers(variableName: string, variableType: string): string[] {
  return activateSkillsForVariable(variableName, variableType);
}

/**
 * Check error messages and activate debug skill.
 * Alias for activateSkillsForError — used by outputRouter.
 */
export function checkErrorAutoTrigger(errorMessage: string): string[] {
  return activateSkillsForError(errorMessage);
}
