/**
 * SkillTool - AI-invocable tool for activating skills
 *
 * When the AI determines that a skill matches the user's request,
 * it can invoke this tool to load the skill content into the conversation.
 * This replaces the previous "static injection" approach — skills are now
 * dynamically loaded on demand by the AI.
 *
 * The tool is registered as an MCP tool available to the AI in Agent mode.
 */

import { useSkillStore } from './index';
import { parseArgumentNames } from '../../utils/argumentSubstitution';
import type { LoadedSkill } from '../../types/skill';

/** Skill tool input schema */
export interface SkillToolInput {
  /** Name of the skill to invoke (e.g., "eda", "debug") */
  skill: string;
  /** Optional arguments string (e.g., "my_dataframe") */
  args?: string;
}

/** Skill tool output */
export interface SkillToolOutput {
  success: boolean;
  skillName?: string;
  content?: string;
  error?: string;
}

/**
 * Get the MCP tool definition for the SkillTool.
 * This is injected into the AI's available tools list.
 */
export function getSkillToolDefinition() {
  return {
    name: 'skill',
    description: `Execute a skill within the main conversation.

When users ask you to perform tasks, check if any of the available skills match. Skills provide specialized capabilities and domain knowledge.

When users reference a "slash command" or "/<something>" (e.g., "/eda", "/debug"), they are referring to a skill. Use this tool to invoke it.

How to invoke:
- Use this tool with the skill name and optional arguments
- Examples:
  - skill: "eda", args: "my_dataframe" - invoke EDA skill on a DataFrame
  - skill: "debug" - invoke the debug skill
  - skill: "viz", args: "sales_data scatter" - invoke viz skill with arguments

Important:
- Available skills are listed in the system prompt
- When a skill matches the user's request, invoke the relevant Skill tool BEFORE generating any other response
- Do not invoke a skill that is already active`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        skill: {
          type: 'string',
          description: 'Name of the skill to invoke',
        },
        args: {
          type: 'string',
          description: 'Optional arguments for the skill',
        },
      },
      required: ['skill'],
    },
  };
}

/**
 * Format the skill listing for injection into the system prompt.
 * Uses budget-aware truncation: 1% of context window, with
 * bundled skills getting full descriptions and others truncated.
 *
 * @param skills - List of all loaded skills
 * @param charBudget - Maximum character budget for the listing
 */
export function formatSkillListing(skills: LoadedSkill[], charBudget = 8000): string {
  if (skills.length === 0) return '';

  const MAX_DESC_CHARS = 250;
  const parts: string[] = [];

  for (const skill of skills) {
    const desc = skill.whenToUse
      ? `${skill.description} - ${skill.whenToUse}`
      : skill.description;

    const truncatedDesc = desc.length > MAX_DESC_CHARS
      ? desc.slice(0, MAX_DESC_CHARS - 1) + '\u2026'
      : desc;

    const argHint = skill.argumentHint ? ` ${skill.argumentHint}` : '';
    const line = `- /${skill.name}${argHint}: ${truncatedDesc}`;
    parts.push(line);
  }

  const fullListing = parts.join('\n');

  // Truncate to budget if needed
  if (fullListing.length <= charBudget) {
    return fullListing;
  }

  // Progressive truncation: keep names only for non-bundled skills
  const result: string[] = [];
  let remaining = charBudget;

  for (const skill of skills) {
    const name = `/- ${skill.name}`;
    if (remaining < name.length + 20) break;

    if (skill.source === 'bundled') {
      const desc = skill.whenToUse
        ? `${skill.description} - ${skill.whenToUse}`
        : skill.description;
      const truncated = desc.length > MAX_DESC_CHARS
        ? desc.slice(0, MAX_DESC_CHARS - 1) + '\u2026'
        : desc;
      const line = `- /${skill.name}${skill.argumentHint ? ` ${skill.argumentHint}` : ''}: ${truncated}`;
      result.push(line);
      remaining -= line.length + 1;
    } else {
      const line = `- /${skill.name}`;
      result.push(line);
      remaining -= line.length + 1;
    }
  }

  return result.join('\n');
}

/**
 * Execute a skill tool invocation.
 * Called when the AI uses the "skill" MCP tool.
 */
export function executeSkillTool(input: SkillToolInput): SkillToolOutput {
  const store = useSkillStore.getState();
  const skillName = input.skill;

  // Find the skill by name (case-insensitive)
  const skill = store.skills.find(
    s => s.name.toLowerCase() === skillName.toLowerCase()
  );

  if (!skill) {
    return {
      success: false,
      error: `Skill "${skillName}" not found. Available skills: ${store.skills.map(s => s.name).join(', ')}`,
    };
  }

  // Activate the skill in the store
  store.activateSkill(skill.id);

  // Resolve content with argument substitution
  const argNames = skill.args
    ? skill.args.map(a => a.name)
    : parseArgumentNames(skill.argumentHint);
  const resolvedContent = store.resolveSkillContent(skill.id, input.args);

  return {
    success: true,
    skillName: skill.name,
    content: resolvedContent,
  };
}

/**
 * Build the SkillTool system prompt section.
 * Injects the skill listing and instructions into the system prompt.
 */
export function buildSkillToolPrompt(skills: LoadedSkill[]): string {
  if (skills.length === 0) return '';

  const listing = formatSkillListing(skills);

  return `\n\n=== AVAILABLE SKILLS ===

You can invoke skills using the "skill" tool. When a user's request matches a skill, invoke it BEFORE generating a response.

Available skills:
${listing}

Use the "skill" tool to invoke any of these. Example: { "skill": "eda", "args": "my_dataframe" }`;
}
