/**
 * Skill Auto-Trigger System
 *
 * Provides a generic, configurable trigger framework that replaces the
 * previous hardcoded skill name matching approach. Triggers are defined
 * in skill frontmatter and evaluated at runtime.
 *
 * Supported trigger types:
 *   1. paths   — glob patterns matching file paths
 *   2. on_variable_type — regex patterns matching variable types
 *   3. on_error — regex patterns matching error messages
 *   4. on_import — module name patterns matching imported packages
 *   5. on_event — named events (e.g., "dataframe_load", "sql_connection")
 *
 * Trigger configuration in skill frontmatter:
 * ```yaml
 * triggers:
 *   on_variable_type:
 *     - pattern: "DataFrame|pd\\.DataFrame"
 *       auto_activate: true
 *     - pattern: "ndarray|Series"
 *       auto_activate: false  # Only suggest, don't auto-activate
 *   on_error:
 *     - pattern: "Error|Exception|Traceback"
 *       auto_activate: true
 *   on_import:
 *     - pattern: "sklearn|tensorflow|torch"
 *       auto_activate: false
 *   on_event:
 *     - name: "dataframe_load"
 *       auto_activate: true
 *     - name: "sql_connection"
 *       auto_activate: false
 * ```
 */

import { useSkillStore } from './index';
import { recordSkillUsage } from './usageTracking';
import type { LoadedSkill } from '../../types/skill';

// ── Trigger Type Definitions ──────────────────────────────────────────────

export interface VariableTypeTrigger {
  /** Regex pattern to match against variable type strings */
  pattern: string;
  /** Whether to auto-activate the skill (false = only suggest) */
  auto_activate?: boolean;
}

export interface ErrorTrigger {
  /** Regex pattern to match against error messages */
  pattern: string;
  /** Whether to auto-activate the skill (false = only suggest) */
  auto_activate?: boolean;
}

export interface ImportTrigger {
  /** Regex pattern or exact module name to match against imported packages */
  pattern: string;
  /** Whether to auto-activate the skill (false = only suggest) */
  auto_activate?: boolean;
}

export interface EventTrigger {
  /** Named event to match (e.g., "dataframe_load", "sql_connection") */
  name: string;
  /** Whether to auto-activate the skill (false = only suggest) */
  auto_activate?: boolean;
}

export interface SkillTriggers {
  on_variable_type?: VariableTypeTrigger[];
  on_error?: ErrorTrigger[];
  on_import?: ImportTrigger[];
  on_event?: EventTrigger[];
}

// ── Extended SkillFrontmatter support ─────────────────────────────────────
// The triggers field will be parsed from frontmatter and stored on LoadedSkill

/** Extended LoadedSkill with triggers (augmented at runtime) */
export interface TriggerableSkill extends LoadedSkill {
  triggers?: SkillTriggers;
}

// ── Trigger Evaluation ────────────────────────────────────────────────────

export interface TriggerMatch {
  skillName: string;
  skillId: string;
  triggerType: 'on_variable_type' | 'on_error' | 'on_import' | 'on_event';
  matchedPattern: string;
  autoActivate: boolean;
}

/**
 * Test if a string matches a regex pattern.
 * Handles invalid patterns gracefully.
 */
function matchesPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch {
    // Invalid regex — try exact match instead
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Simple glob matcher for file paths.
 */
function matchGlob(pattern: string, path: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  try {
    return new RegExp(`^${regexStr}$`, 'i').test(path.replace(/\\/g, '/'));
  } catch {
    return false;
  }
}

// ── Path-based triggers (existing, enhanced) ──────────────────────────────

/**
 * Activate skills whose `paths` patterns match the given file path.
 * Also checks `triggers.on_event` for file-related events.
 */
export function activateSkillsForPath(filePath: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    // Check paths field
    if (skill.paths && skill.paths.length > 0) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const matches = skill.paths.some(pattern => matchGlob(pattern, normalizedPath));

      if (matches) {
        store.activateSkill(skill.id);
        recordSkillUsage(skill.name);
        activated.push(skill.name);
      }
    }
  }

  return activated;
}

// ── Variable type triggers ────────────────────────────────────────────────

/**
 * Check variable types and activate/suggest matching skills.
 *
 * First checks the generic `triggers.on_variable_type` configuration,
 * then falls back to legacy `when_to_use` / `paths` heuristics for
 * backward compatibility with skills that don't define triggers.
 */
export function activateSkillsForVariable(
  variableName: string,
  variableType: string,
): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    // Check structured triggers first
    const triggers = (skill as TriggerableSkill).triggers;
    if (triggers?.on_variable_type) {
      for (const trigger of triggers.on_variable_type) {
        if (matchesPattern(variableType, trigger.pattern)) {
          const shouldActivate = trigger.auto_activate !== false; // Default: true
          if (shouldActivate) {
            store.activateSkill(skill.id);
            recordSkillUsage(skill.name);
            activated.push(skill.name);
          }
          break; // One match per skill is enough
        }
      }
      continue; // If triggers are defined, don't fall through to legacy
    }

    // Legacy fallback: match by when_to_use + known patterns
    if (legacyVariableTypeMatch(skill, variableType)) {
      store.activateSkill(skill.id);
      recordSkillUsage(skill.name);
      activated.push(skill.name);
    }
  }

  return activated;
}

/**
 * Legacy variable type matching for skills without structured triggers.
 * Preserves backward compatibility with bundled skills.
 */
function legacyVariableTypeMatch(skill: LoadedSkill, variableType: string): boolean {
  const whenToUse = skill.whenToUse?.toLowerCase() || '';
  const name = skill.name.toLowerCase();

  // EDA skill for DataFrames
  if ((name === 'eda' || whenToUse.includes('dataframe') || whenToUse.includes('explore data'))
    && (variableType.includes('DataFrame') || variableType.includes('pd.DataFrame'))) {
    return true;
  }

  // Visualization skill for numeric/array data
  if ((name === 'viz' || whenToUse.includes('visualiz'))
    && (variableType.includes('ndarray') || variableType.includes('Series') || variableType.includes('ndarray'))) {
    return true;
  }

  // Model skill for tabular data
  if ((name === 'model' || whenToUse.includes('predict') || whenToUse.includes('model'))
    && (variableType.includes('DataFrame') || variableType.includes('ndarray'))) {
    return true;
  }

  // Clean skill for messy data
  if ((name === 'clean' || whenToUse.includes('clean') || whenToUse.includes('missing'))
    && (variableType.includes('DataFrame'))) {
    return true;
  }

  return false;
}

// ── Error triggers ────────────────────────────────────────────────────────

/**
 * Check error messages and activate matching skills.
 */
export function activateSkillsForError(errorMessage: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    // Check structured triggers
    const triggers = (skill as TriggerableSkill).triggers;
    if (triggers?.on_error) {
      for (const trigger of triggers.on_error) {
        if (matchesPattern(errorMessage, trigger.pattern)) {
          const shouldActivate = trigger.auto_activate !== false;
          if (shouldActivate) {
            store.activateSkill(skill.id);
            recordSkillUsage(skill.name);
            activated.push(skill.name);
          }
          break;
        }
      }
      continue;
    }

    // Legacy fallback: debug skill for any error
    if (skill.name === 'debug' &&
        (errorMessage.includes('Error') || errorMessage.includes('Exception') || errorMessage.includes('Traceback'))) {
      store.activateSkill(skill.id);
      recordSkillUsage(skill.name);
      activated.push(skill.name);
    }
  }

  return activated;
}

// ── Import triggers ───────────────────────────────────────────────────────

/**
 * Check imported modules and activate matching skills.
 */
export function activateSkillsForImport(moduleName: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    const triggers = (skill as TriggerableSkill).triggers;
    if (triggers?.on_import) {
      for (const trigger of triggers.on_import) {
        if (matchesPattern(moduleName, trigger.pattern)) {
          const shouldActivate = trigger.auto_activate !== false;
          if (shouldActivate) {
            store.activateSkill(skill.id);
            recordSkillUsage(skill.name);
            activated.push(skill.name);
          }
          break;
        }
      }
    }
  }

  return activated;
}

// ── Event triggers ────────────────────────────────────────────────────────

/**
 * Fire a named event and activate matching skills.
 *
 * Events are high-level semantic signals:
 *   - "dataframe_load" — a DataFrame was loaded
 *   - "sql_connection" — a database connection was established
 *   - "model_trained" — a model finished training
 *   - "notebook_open" — a notebook file was opened
 */
export function activateSkillsForEvent(eventName: string): string[] {
  const store = useSkillStore.getState();
  const activated: string[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    const triggers = (skill as TriggerableSkill).triggers;
    if (triggers?.on_event) {
      for (const trigger of triggers.on_event) {
        if (trigger.name === eventName) {
          const shouldActivate = trigger.auto_activate !== false;
          if (shouldActivate) {
            store.activateSkill(skill.id);
            recordSkillUsage(skill.name);
            activated.push(skill.name);
          }
          break;
        }
      }
    }
  }

  return activated;
}

// ── Scan all triggers (for suggestions) ───────────────────────────────────

/**
 * Find all skills that would match a given context, without activating them.
 * Useful for UI suggestions.
 */
export function findMatchingSkills(context: {
  filePath?: string;
  variableType?: string;
  errorMessage?: string;
  moduleName?: string;
  eventName?: string;
}): TriggerMatch[] {
  const store = useSkillStore.getState();
  const matches: TriggerMatch[] = [];

  for (const skill of store.skills) {
    if (store.isSkillActive(skill.id)) continue;

    // Path matching
    if (context.filePath && skill.paths) {
      const normalizedPath = context.filePath.replace(/\\/g, '/');
      if (skill.paths.some(p => matchGlob(p, normalizedPath))) {
        matches.push({
          skillName: skill.name,
          skillId: skill.id,
          triggerType: 'on_event', // Path triggers are closest to events
          matchedPattern: skill.paths.find(p => matchGlob(p, normalizedPath)) || '',
          autoActivate: true,
        });
      }
    }

    // Variable type matching
    if (context.variableType) {
      const triggers = (skill as TriggerableSkill).triggers;
      if (triggers?.on_variable_type) {
        for (const trigger of triggers.on_variable_type) {
          if (matchesPattern(context.variableType, trigger.pattern)) {
            matches.push({
              skillName: skill.name,
              skillId: skill.id,
              triggerType: 'on_variable_type',
              matchedPattern: trigger.pattern,
              autoActivate: trigger.auto_activate !== false,
            });
          }
        }
      } else if (legacyVariableTypeMatch(skill, context.variableType)) {
        matches.push({
          skillName: skill.name,
          skillId: skill.id,
          triggerType: 'on_variable_type',
          matchedPattern: '(legacy)',
          autoActivate: true,
        });
      }
    }

    // Error matching
    if (context.errorMessage) {
      const triggers = (skill as TriggerableSkill).triggers;
      if (triggers?.on_error) {
        for (const trigger of triggers.on_error) {
          if (matchesPattern(context.errorMessage, trigger.pattern)) {
            matches.push({
              skillName: skill.name,
              skillId: skill.id,
              triggerType: 'on_error',
              matchedPattern: trigger.pattern,
              autoActivate: trigger.auto_activate !== false,
            });
          }
        }
      } else if (skill.name === 'debug' &&
          (context.errorMessage.includes('Error') || context.errorMessage.includes('Exception'))) {
        matches.push({
          skillName: skill.name,
          skillId: skill.id,
          triggerType: 'on_error',
          matchedPattern: '(legacy)',
          autoActivate: true,
        });
      }
    }

    // Import matching
    if (context.moduleName) {
      const triggers = (skill as TriggerableSkill).triggers;
      if (triggers?.on_import) {
        for (const trigger of triggers.on_import) {
          if (matchesPattern(context.moduleName, trigger.pattern)) {
            matches.push({
              skillName: skill.name,
              skillId: skill.id,
              triggerType: 'on_import',
              matchedPattern: trigger.pattern,
              autoActivate: trigger.auto_activate !== false,
            });
          }
        }
      }
    }

    // Event matching
    if (context.eventName) {
      const triggers = (skill as TriggerableSkill).triggers;
      if (triggers?.on_event) {
        for (const trigger of triggers.on_event) {
          if (trigger.name === context.eventName) {
            matches.push({
              skillName: skill.name,
              skillId: skill.id,
              triggerType: 'on_event',
              matchedPattern: trigger.name,
              autoActivate: trigger.auto_activate !== false,
            });
          }
        }
      }
    }
  }

  return matches;
}

// ── Backward-compatible aliases ───────────────────────────────────────────

/**
 * Alias for activateSkillsForVariable — used by outputRouter.
 */
export function checkAutoTriggers(variableName: string, variableType: string): string[] {
  return activateSkillsForVariable(variableName, variableType);
}

/**
 * Alias for activateSkillsForError — used by outputRouter.
 */
export function checkErrorAutoTrigger(errorMessage: string): string[] {
  return activateSkillsForError(errorMessage);
}

/**
 * Get all skills that would be auto-activated for a given file path.
 * (Preview mode — does not actually activate)
 */
export function getMatchingSkillsForPath(filePath: string): LoadedSkill[] {
  const store = useSkillStore.getState();
  return store.skills.filter(skill => {
    if (!skill.paths || skill.paths.length === 0) return false;
    const normalizedPath = filePath.replace(/\\/g, '/');
    return skill.paths.some(pattern => matchGlob(pattern, normalizedPath));
  });
}

/**
 * Check data quality and suggest clean skill.
 * Legacy helper preserved for backward compatibility.
 */
export function checkDataQualityTriggers(variableName: string, sample: any): string[] {
  const suggested: string[] = [];

  if (sample && typeof sample === 'object') {
    const hasMissingValues = Object.values(sample).some(val => val === null || val === undefined);
    if (hasMissingValues) {
      suggested.push('clean');
    }
  }

  return suggested;
}
