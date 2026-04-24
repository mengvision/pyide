/**
 * Model Override Resolver
 *
 * Resolves the AI model to use based on a three-level priority:
 *   skill_override > user_override > default_config
 *
 * This follows the design documented in docs/03-ai-chat-skill-mcp.md:
 * When a skill declares a `model:` field in its frontmatter,
 * that model takes precedence over the user's preferred model,
 * which in turn takes precedence over the system default.
 */

import { useSkillStore } from './index';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Resolve the model ID to use for the current chat context.
 *
 * Priority:
 *   1. Active skill's `model` field (skill_override) — highest
 *   2. User's `aiConfig.modelId` setting (user_override)
 *   3. System default ("gpt-4o") — lowest
 *
 * @returns The resolved model ID
 */
export function resolveModelId(): string {
  // Level 1: Skill override
  const skillOverride = useSkillStore.getState().getActiveModelOverride();
  if (skillOverride) {
    return skillOverride;
  }

  // Level 2: User preference (already includes Level 3 as fallback)
  const userConfig = useSettingsStore.getState().aiConfig;
  return userConfig.modelId || 'gpt-4o';
}

/**
 * Get a description of why a particular model was selected.
 * Useful for UI display and debugging.
 */
export function getModelResolutionInfo(): {
  modelId: string;
  source: 'skill' | 'user' | 'default';
  skillName?: string;
} {
  const skillOverride = useSkillStore.getState().getActiveModelOverride();
  if (skillOverride) {
    // Find which skill provided the override
    const { skills, activeSkills } = useSkillStore.getState();
    const overrideSkill = skills.find(
      s => activeSkills.includes(s.id) && s.model === skillOverride
    );
    return {
      modelId: skillOverride,
      source: 'skill',
      skillName: overrideSkill?.name,
    };
  }

  const userConfig = useSettingsStore.getState().aiConfig;
  if (userConfig.modelId && userConfig.modelId !== 'gpt-4o') {
    return {
      modelId: userConfig.modelId,
      source: 'user',
    };
  }

  return {
    modelId: userConfig.modelId || 'gpt-4o',
    source: 'default',
  };
}
