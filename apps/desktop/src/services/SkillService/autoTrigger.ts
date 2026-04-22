/**
 * Auto-Trigger Logic for Skills (Legacy API)
 *
 * This module re-exports the conditional trigger functions for backward
 * compatibility. All new code should import from conditionalTrigger.ts.
 *
 * The actual implementation has been consolidated into conditionalTrigger.ts
 * which adds path-based activation and usage tracking.
 */

export {
  activateSkillsForVariable as checkAutoTriggers,
  activateSkillsForError as checkErrorAutoTrigger,
  checkDataQualityTriggers,
  activateSkillsForPath,
} from './conditionalTrigger';
