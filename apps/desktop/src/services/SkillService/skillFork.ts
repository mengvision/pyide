/**
 * Skill Fork Execution Engine
 *
 * Executes skills in an isolated sub-agent context, following Claude Code's
 * forked agent execution pattern. A "forked" skill runs with its own:
 *   - Message history (isolated from main conversation)
 *   - Token budget
 *   - Model selection (skill-level model override)
 *   - Tool permissions (skill's allowedTools only)
 *
 * In contrast, "inline" skills (the default) inject their content directly
 * into the main conversation's system prompt.
 *
 * Usage:
 *   - When a skill's `context` field is "fork", executeSkillInFork() is called
 *   - The main conversation receives a summary of the fork's result
 *   - The fork's full message history is stored for inspection
 */

import { ChatEngine } from '../ChatEngine';
import { useSkillStore } from './index';
import { useSettingsStore } from '../../stores/settingsStore';
import { recordSkillUsage } from './usageTracking';
import { agentManager } from '../AgentManager';
import type { LoadedSkill } from '../../types/skill';
import type { ChatCompletionMessage } from '../ChatEngine';

/** Maximum tokens for a forked skill execution */
const FORK_MAX_OUTPUT_TOKENS = 4096;

/** Result of a forked skill execution */
export interface SkillForkResult {
  /** Whether the fork completed successfully */
  success: boolean;
  /** Summary of the fork's result (injected into main conversation) */
  summary: string;
  /** Full message history from the fork (for inspection) */
  forkMessages: ChatCompletionMessage[];
  /** Token usage in the fork */
  tokenUsage: { input: number; output: number };
  /** Error message if fork failed */
  error?: string;
}

/**
 * Execute a skill in a forked (isolated) sub-agent context.
 *
 * @param skill - The skill to execute
 * @param userMessage - The user's original message that triggered the skill
 * @param args - Optional arguments for the skill
 * @returns Summary and full result of the fork execution
 */
export async function executeSkillInFork(
  skill: LoadedSkill,
  userMessage: string,
  args?: string,
): Promise<SkillForkResult> {
  recordSkillUsage(skill.name);

  // Resolve the model: skill override > user preference > default
  const skillModel = skill.model;
  const userConfig = useSettingsStore.getState().aiConfig;
  const modelId = skillModel || userConfig.modelId || 'gpt-4o';

  // Create a dedicated ChatEngine for the fork
  const forkEngine = new ChatEngine({
    baseUrl: userConfig.baseUrl,
    apiKey: userConfig.apiKey,
    modelId,
  });

  // Build the fork's system prompt
  const resolvedContent = useSkillStore.getState().resolveSkillContent(skill.id, args);
  const forkSystemPrompt = buildForkSystemPrompt(skill, resolvedContent);

  // Build the fork's message history
  const forkMessages: ChatCompletionMessage[] = [
    { role: 'system', content: forkSystemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Spawn a worker agent in AgentManager
  const worker = agentManager.spawnWorker(
    `Skill: ${skill.name}`,
    `Execute skill "${skill.name}" in forked context`,
    skill.allowedTools,
  );
  agentManager.setStatus(worker.id, 'running');

  // Add the fork's system context to the worker's messages
  worker.messages = [...forkMessages];

  try {
    let fullContent = '';

    await forkEngine.sendMessage(
      forkMessages.slice(1), // Exclude system message (ChatEngine handles it)
      (token) => {
        fullContent += token;
      },
      (complete) => {
        // Track usage
        const inputText = [forkSystemPrompt, userMessage].join('');
        const inputTokens = forkEngine.estimateTokens(inputText);
        const outputTokens = forkEngine.estimateTokens(complete);
        agentManager.trackUsage(worker.id, inputTokens, outputTokens);
      },
      (error) => {
        agentManager.setStatus(worker.id, 'error');
      },
      undefined, // No abort signal for forks (run to completion)
      forkSystemPrompt,
    );

    // Update the worker's status and messages
    agentManager.setStatus(worker.id, 'completed');

    // Build summary for the main conversation
    const summary = buildForkSummary(skill, fullContent);

    return {
      success: true,
      summary,
      forkMessages: [
        ...forkMessages,
        { role: 'assistant', content: fullContent },
      ],
      tokenUsage: {
        input: worker.tokenUsage.input,
        output: worker.tokenUsage.output,
      },
    };
  } catch (error) {
    agentManager.setStatus(worker.id, 'error');

    return {
      success: false,
      summary: `Skill "${skill.name}" execution failed: ${(error as Error).message}`,
      forkMessages,
      tokenUsage: {
        input: worker.tokenUsage.input,
        output: worker.tokenUsage.output,
      },
      error: (error as Error).message,
    };
  }
}

/**
 * Build the system prompt for a forked skill execution.
 * Includes skill instructions, tool restrictions, and output constraints.
 */
function buildForkSystemPrompt(skill: LoadedSkill, resolvedContent: string): string {
  const toolRestriction = skill.allowedTools.length > 0
    ? `\n\n## Tool Restrictions\nYou may ONLY use the following tools: ${skill.allowedTools.join(', ')}. Do not attempt to use any other tools.`
    : '';

  return `You are executing the skill "${skill.name}" in an isolated context.

## Skill Instructions
${resolvedContent}
${toolRestriction}

## Execution Constraints
- You are running in a forked context — your output will be summarized back to the main conversation.
- Be focused and concise. Complete the requested task efficiently.
- If you encounter an error, describe it clearly so the main agent can handle it.
- Maximum output: ~${FORK_MAX_OUTPUT_TOKENS} tokens.`;
}

/**
 * Build a summary of the fork execution result for the main conversation.
 */
function buildForkSummary(skill: LoadedSkill, forkOutput: string): string {
  // Truncate very long outputs to keep the main conversation manageable
  const maxSummaryLength = 2000;
  const truncated = forkOutput.length > maxSummaryLength
    ? forkOutput.slice(0, maxSummaryLength) + '\n\n*(output truncated)*'
    : forkOutput;

  return `[Forked Skill: ${skill.name}]\n\n${truncated}`;
}

/**
 * Check if a skill should be executed in fork context.
 * Skills with `context: 'fork'` in their frontmatter use forked execution.
 */
export function shouldFork(skill: LoadedSkill): boolean {
  return skill.context === 'fork';
}
