/**
 * Skill Hooks Execution Engine
 *
 * Executes PreToolUse and PostToolUse hooks defined in skill frontmatter.
 * Hooks are shell commands that run before/after tool invocations, allowing
 * skills to inspect, modify, or block tool calls.
 *
 * Hook flow:
 *   1. PreToolUse hooks run BEFORE a tool is executed
 *      - Can block the tool call by returning { blocked: true }
 *      - Can modify tool arguments
 *   2. The tool executes (if not blocked)
 *   3. PostToolUse hooks run AFTER the tool completes
 *      - Can process/transform the result
 *
 * Following Claude Code's registerSkillHooks pattern.
 */

import { useSkillStore } from './index';
import type { HookHandler, SkillHooks } from '../../types/skill';

/** Default timeout for hook commands (ms) */
const DEFAULT_HOOK_TIMEOUT = 30_000;

/** Result of a PreToolUse hook execution */
export interface PreHookResult {
  /** Whether the tool call should be blocked */
  blocked: boolean;
  /** Reason for blocking (shown to user if blocked) */
  reason?: string;
  /** Modified tool arguments (if the hook changed them) */
  modifiedArgs?: Record<string, unknown>;
}

/** Result of a PostToolUse hook execution */
export interface PostHookResult {
  /** Modified tool result (if the hook changed it) */
  modifiedResult?: string;
  /** Whether to suppress the result from the conversation */
  suppressOutput?: boolean;
}

/** Context passed to hook executors */
export interface HookContext {
  /** Name of the tool being called */
  toolName: string;
  /** Server name (for MCP tools) */
  serverName?: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result (only for PostToolUse) */
  result?: string;
}

/**
 * Collect all PreToolUse hooks from active skills for a given tool.
 */
export function getPreToolUseHooks(toolName: string): HookHandler[] {
  const { skills, activeSkills } = useSkillStore.getState();
  const hooks: HookHandler[] = [];

  for (const skill of skills) {
    if (!activeSkills.includes(skill.id)) continue;
    if (!skill.hooks?.PreToolUse) continue;

    // Include hooks that apply to all tools or specifically to this tool
    for (const hook of skill.hooks.PreToolUse) {
      if (!hook.command) continue;
      hooks.push(hook);
    }
  }

  return hooks;
}

/**
 * Collect all PostToolUse hooks from active skills for a given tool.
 */
export function getPostToolUseHooks(toolName: string): HookHandler[] {
  const { skills, activeSkills } = useSkillStore.getState();
  const hooks: HookHandler[] = [];

  for (const skill of skills) {
    if (!activeSkills.includes(skill.id)) continue;
    if (!skill.hooks?.PostToolUse) continue;

    for (const hook of skill.hooks.PostToolUse) {
      if (!hook.command) continue;
      hooks.push(hook);
    }
  }

  return hooks;
}

/**
 * Execute PreToolUse hooks for a given tool call.
 *
 * @param toolName - Name of the tool about to be called
 * @param args - Tool arguments
 * @param serverName - MCP server name (optional)
 * @returns PreHookResult indicating whether to block/modify the call
 */
export async function executePreToolUseHooks(
  toolName: string,
  args: Record<string, unknown>,
  serverName?: string,
): Promise<PreHookResult> {
  const hooks = getPreToolUseHooks(toolName);

  if (hooks.length === 0) {
    return { blocked: false };
  }

  const context: HookContext = { toolName, serverName, args };

  for (const hook of hooks) {
    try {
      const result = await executeHook(hook, context);

      // Parse hook output for block signals
      if (result) {
        const parsed = parseHookOutput(result);

        if (parsed.blocked) {
          return {
            blocked: true,
            reason: parsed.reason || `Blocked by hook: ${hook.command}`,
          };
        }

        if (parsed.modifiedArgs) {
          return {
            blocked: false,
            modifiedArgs: parsed.modifiedArgs,
          };
        }
      }
    } catch (error) {
      console.warn(`[SkillHooks] PreToolUse hook failed: ${hook.command}`, error);
      // Don't block on hook errors — fail open
    }
  }

  return { blocked: false };
}

/**
 * Execute PostToolUse hooks for a given tool call.
 *
 * @param toolName - Name of the tool that was called
 * @param args - Tool arguments
 * @param result - Tool execution result
 * @param serverName - MCP server name (optional)
 * @returns PostHookResult with optional modifications
 */
export async function executePostToolUseHooks(
  toolName: string,
  args: Record<string, unknown>,
  result: string,
  serverName?: string,
): Promise<PostHookResult> {
  const hooks = getPostToolUseHooks(toolName);

  if (hooks.length === 0) {
    return {};
  }

  const context: HookContext = { toolName, serverName, args, result };
  let currentResult = result;

  for (const hook of hooks) {
    try {
      const hookOutput = await executeHook(hook, context);

      if (hookOutput) {
        const parsed = parseHookOutput(hookOutput);

        if (parsed.suppressOutput) {
          return { suppressOutput: true };
        }

        if (parsed.modifiedResult) {
          currentResult = parsed.modifiedResult;
        }
      }
    } catch (error) {
      console.warn(`[SkillHooks] PostToolUse hook failed: ${hook.command}`, error);
      // Fail open — don't suppress or modify on error
    }
  }

  return currentResult !== result ? { modifiedResult: currentResult } : {};
}

/**
 * Execute a single hook command.
 *
 * In the current implementation, hook commands are executed via the kernel's
 * shell execution capability. For safety, hooks run with a timeout.
 *
 * @param hook - The hook handler to execute
 * @param context - Context data available to the hook
 * @returns The hook's stdout output, or null on failure
 */
async function executeHook(hook: HookHandler, context: HookContext): Promise<string | null> {
  const timeout = hook.timeout || DEFAULT_HOOK_TIMEOUT;

  // Inject context variables into the command
  let command = hook.command;
  command = command.replace(/\$TOOL_NAME/g, context.toolName);
  command = command.replace(/\$SERVER_NAME/g, context.serverName || '');
  command = command.replace(/\$ARGS/g, JSON.stringify(context.args));
  if (context.result) {
    command = command.replace(/\$RESULT/g, context.result);
  }

  // Execute via kernel if available, otherwise try platform
  try {
    const { useKernelStore } = await import('../../stores/kernelStore');
    const kernel = useKernelStore.getState();

    if (kernel.connectionStatus === 'connected') {
      // Use Python subprocess to execute the hook command
      const hookCode = `
import subprocess
import json
result = subprocess.run(
    ${JSON.stringify(command)},
    shell=True,
    capture_output=True,
    text=True,
    timeout=${Math.floor(timeout / 1000)}
)
print(result.stdout)
if result.returncode != 0:
    print(f"HOOK_ERROR: {result.stderr}", file=__import__('sys').stderr)
`;
      // Import and execute via the kernel's executeCode
      const platform = getPlatform();
      if (platform) {
        const output = await platform.kernel.executeCode(hookCode);
        return typeof output === 'string' ? output : JSON.stringify(output);
      }
    }
  } catch {
    // Kernel not available — try direct execution
  }

  // Fallback: log the hook (no execution in web-only mode)
  console.log(`[SkillHooks] Would execute hook: ${command}`);
  return null;
}

/** Get platform service instance */
function getPlatform(): any {
  try {
    // Access the platform through the skill store's init
    const { _platform } = require('./index');
    return _platform;
  } catch {
    return null;
  }
}

/**
 * Parse hook output for structured signals.
 *
 * Hook commands can output special JSON to control execution:
 *   - { "blocked": true, "reason": "..." } — block the tool call
 *   - { "modifiedArgs": { ... } } — change tool arguments
 *   - { "modifiedResult": "..." } — change tool result
 *   - { "suppressOutput": true } — hide the result
 */
function parseHookOutput(output: string): {
  blocked?: boolean;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
  modifiedResult?: string;
  suppressOutput?: boolean;
} {
  // Try to parse as JSON
  try {
    // Look for JSON in the output (might be mixed with other text)
    const jsonMatch = output.match(/\{[\s\S]*"blocked"[\s\S]*\}|\{[\s\S]*"modifiedArgs"[\s\S]*\}|\{[\s\S]*"modifiedResult"[\s\S]*\}|\{[\s\S]*"suppressOutput"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Not JSON — check for plain text signals
  }

  // Simple text-based blocking
  if (output.includes('BLOCK:')) {
    const reason = output.split('BLOCK:')[1]?.trim() || 'Blocked by hook';
    return { blocked: true, reason };
  }

  return {};
}

/**
 * Check if any active skill has hooks defined.
 * Useful for UI indication.
 */
export function hasActiveHooks(): boolean {
  const { skills, activeSkills } = useSkillStore.getState();
  return skills.some(
    s => activeSkills.includes(s.id) &&
    s.hooks &&
    ((s.hooks.PreToolUse && s.hooks.PreToolUse.length > 0) ||
     (s.hooks.PostToolUse && s.hooks.PostToolUse.length > 0))
  );
}
