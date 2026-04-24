/**
 * Skill Frontmatter Parser
 * Parses YAML frontmatter from SKILL.md files
 * Supports both legacy (snake_case) and new structured fields
 */

import yaml from 'js-yaml';
import type { SkillFrontmatter, SkillArg } from '../types/skill';

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  markdownContent: string;
}

/**
 * Parse YAML frontmatter and markdown content from a SKILL.md file.
 * Handles both `---\n...\n---\n` and content-only formats.
 */
export function parseSkillFrontmatter(content: string): ParsedSkill {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    // No frontmatter found, treat entire content as markdown
    return {
      frontmatter: {},
      markdownContent: content,
    };
  }

  try {
    const raw = yaml.load(match[1]) as Record<string, unknown>;
    const frontmatter = normalizeFrontmatter(raw);
    return {
      frontmatter,
      markdownContent: match[2],
    };
  } catch (error) {
    console.error('Failed to parse skill frontmatter:', error);
    return {
      frontmatter: {},
      markdownContent: content,
    };
  }
}

/**
 * Normalize raw YAML frontmatter into SkillFrontmatter.
 * Handles both camelCase and snake_case keys, normalizes arguments
 * from string to SkillArg[] format.
 */
function normalizeFrontmatter(raw: Record<string, unknown>): SkillFrontmatter {
  const fm: SkillFrontmatter = {};

  // Name & description
  fm.name = toString(raw.name ?? raw.Name);
  fm.description = toString(raw.description ?? raw.Description);

  // Allowed tools
  fm.allowed_tools = toStringArray(raw.allowed_tools ?? raw.allowedTools);

  // Argument hint (legacy)
  fm.argument_hint = toString(raw.argument_hint ?? raw.argumentHint);

  // Arguments (new structured format)
  fm.arguments = normalizeArguments(raw.arguments ?? raw.Args);

  // When to use
  fm.when_to_use = toString(raw.when_to_use ?? raw.whenToUse);

  // Paths (conditional activation glob patterns)
  fm.paths = toStringArray(raw.paths ?? raw.Paths);

  // Context (inline / fork)
  const ctx = raw.context ?? raw.Context;
  if (ctx === 'inline' || ctx === 'fork') {
    fm.context = ctx;
  }

  // Hooks
  fm.hooks = normalizeHooks(raw.hooks ?? raw.Hooks);

  // Files (supporting file list)
  fm.files = toStringArray(raw.files ?? raw.Files);

  // Model override
  fm.model = toString(raw.model ?? raw.Model);

  // Triggers (auto-activation configuration)
  if (raw.triggers && typeof raw.triggers === 'object') {
    fm.triggers = raw.triggers as Record<string, unknown>;
  }

  return fm;
}

/**
 * Normalize the `arguments` field.
 * Accepts: SkillArg[], "name1 name2", or undefined.
 */
function normalizeArguments(
  value: unknown,
): SkillArg[] | string | undefined {
  if (value === undefined || value === null) return undefined;

  // Already an array — validate and return
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      if (typeof item === 'string') {
        // Shorthand: ["foo", "bar"] → [{ name: "foo" }, { name: "bar" }]
        return { name: item, type: 'string' as const };
      }
      if (typeof item === 'object' && item !== null) {
        return {
          name: toString(item.name) ?? `arg${i}`,
          type: (item.type as SkillArg['type']) ?? 'string',
          default: item.default as SkillArg['default'],
          description: toString(item.description),
          required: item.required === true,
        };
      }
      return { name: `arg${i}`, type: 'string' as const };
    });
  }

  // String format: "foo bar baz"
  if (typeof value === 'string') return value;

  return undefined;
}

/**
 * Normalize the `hooks` field from raw YAML.
 */
function normalizeHooks(value: unknown): SkillFrontmatter['hooks'] {
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const hooks: NonNullable<SkillFrontmatter['hooks']> = {};

  if (Array.isArray(raw.PreToolUse)) {
    hooks.PreToolUse = raw.PreToolUse.map(normalizeHookHandler);
  }
  if (Array.isArray(raw.PostToolUse)) {
    hooks.PostToolUse = raw.PostToolUse.map(normalizeHookHandler);
  }

  return Object.keys(hooks).length > 0 ? hooks : undefined;
}

function normalizeHookHandler(item: unknown) {
  if (typeof item === 'string') {
    return { command: item };
  }
  if (typeof item === 'object' && item !== null) {
    return {
      command: toString(item.command) ?? '',
      timeout: typeof item.timeout === 'number' ? item.timeout : undefined,
    };
  }
  return { command: '' };
}

// ── Helpers ────────────────────────────────────────────────────────

function toString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const arr = value.map(v => String(v));
    return arr.length > 0 ? arr : undefined;
  }
  if (typeof value === 'string') {
    const arr = value.split(/[\s,]+/).filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }
  return undefined;
}

/**
 * Extract description from markdown content (first non-heading paragraph).
 */
export function extractDescriptionFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.substring(0, 200);
    }
  }
  return 'No description available';
}
