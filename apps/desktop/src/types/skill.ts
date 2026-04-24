/**
 * Skill System Type Definitions
 * Aligned with Claude Code's skill architecture for parameterized,
 * conditionally-activatable, tool-scoped AI workflow units.
 */

// ── Skill argument definition ──────────────────────────────────────

export interface SkillArg {
  name: string;
  type: 'string' | 'number' | 'boolean';
  default?: string | number | boolean;
  description?: string;
  required?: boolean;
}

// ── Skill hooks ────────────────────────────────────────────────────

export type HookHandler = {
  /** Command to run */
  command: string;
  /** Optional timeout in ms */
  timeout?: number;
};

export interface SkillHooks {
  /** Runs before a tool is executed; can modify or block the call */
  PreToolUse?: HookHandler[];
  /** Runs after a tool is executed; can process results */
  PostToolUse?: HookHandler[];
}

// ── Skill execution context ────────────────────────────────────────

/** How the skill content is injected into the conversation */
export type SkillContext = 'inline' | 'fork';

// ── Skill source ───────────────────────────────────────────────────

export type SkillSource = 'bundled' | 'project' | 'disk' | 'clawhub' | 'plugin' | 'managed' | 'mcp';

// ── Core type definitions ──────────────────────────────────────────

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;           // Markdown content (template with $ARGUMENTS etc.)
  allowedTools: string[];    // Tool whitelist — enforced at execution time
  argumentHint?: string;     // Legacy: plain-text hint like "<file> <mode>"
  args?: SkillArg[];         // Structured argument definitions
  whenToUse?: string;        // Detailed usage scenarios for AI matching
  paths?: string[];          // Glob patterns for conditional activation (e.g. "**/*.py")
  context?: SkillContext;    // Execution context: 'inline' (default) or 'fork'
  hooks?: SkillHooks;        // Lifecycle hooks
  files?: string[];          // Supporting file paths relative to skill directory
  model?: string;            // Model override — e.g. "claude-sonnet-4-20250514"
  triggers?: Record<string, unknown>;  // Auto-trigger configuration
  source: SkillSource;
  directory: string;         // Base directory of the skill
}

export interface LoadedSkill extends SkillDefinition {
  id: string;
  isActive: boolean;
  lastUsed?: Date;
  /** Computed usage score (7-day half-life exponential decay) */
  usageScore?: number;
}

// ── Frontmatter (YAML snake_case) ──────────────────────────────────

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  allowed_tools?: string[];
  argument_hint?: string;                // Legacy
  arguments?: SkillArg[] | string;       // New: structured or space-separated
  when_to_use?: string;
  paths?: string[];
  context?: 'inline' | 'fork';
  hooks?: SkillHooks;
  files?: string[];
  model?: string;                        // Model override — e.g. "claude-sonnet-4-20250514"
  triggers?: Record<string, unknown>;    // Auto-trigger configuration
}

// ── Skill usage tracking ───────────────────────────────────────────

export interface SkillUsageRecord {
  usageCount: number;
  lastUsedAt: number;  // Date.now() timestamp
}
