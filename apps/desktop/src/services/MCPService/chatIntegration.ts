/**
 * MCP Integration for ChatEngine
 * Formats MCP tools into AI context and handles tool execution.
 */

import { mcpClient } from '../MCPService/client';
import { checkPermission } from '../MCPService/permissions';
import type { ChatMode } from '../../stores/chatStore';
import { parseToolCalls, formatToolResult, stripToolCalls, type ToolCall } from '../../utils/toolCallParser';

export type { ToolCall };

/** Result of a single tool execution */
export interface ToolExecutionResult {
  call: ToolCall;
  result: any;
  error?: string;
}

/** Callback used in Assist mode to ask the user for confirmation before running a tool */
export type ToolConfirmCallback = (call: ToolCall) => Promise<boolean>;

export class MCPChatIntegration {
  /**
   * Get all available MCP tools formatted for AI system prompt.
   */
  async getAvailableToolsForAI(): Promise<string> {
    const connections = mcpClient.getAllConnections();
    const connectedServers = connections.filter((c) => c.status === 'connected');

    if (connectedServers.length === 0) {
      return '';
    }

    const parts: string[] = ['\n\n=== AVAILABLE MCP TOOLS ==='];

    for (const connection of connectedServers) {
      if (connection.tools.length > 0) {
        parts.push(`\nServer: ${connection.serverName}`);

        for (const tool of connection.tools) {
          parts.push(`- ${tool.name}: ${tool.description}`);
          if (tool.inputSchema) {
            parts.push(`  Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}`);
          }
        }
      }
    }

    parts.push('\nTo use a tool, respond with: [TOOL_CALL: server_name.tool_name({"arg": "value"})]');

    return parts.join('\n');
  }

  /**
   * Execute a single tool call respecting permissions and chat mode.
   *
   * @param call        The parsed tool call.
   * @param chatMode    Current chat mode ('chat' | 'assist' | 'agent').
   * @param onConfirm   Callback shown in 'assist' mode when permission is 'ask'.
   *                    Return true to proceed, false to skip.
   */
  async executeToolCall(
    call: ToolCall,
    chatMode: ChatMode = 'chat',
    onConfirm?: ToolConfirmCallback,
  ): Promise<ToolExecutionResult> {
    // In pure 'chat' mode tools are informational only — never auto-execute.
    if (chatMode === 'chat') {
      return {
        call,
        result: null,
        error: 'Tool execution is disabled in Chat mode. Switch to Assist or Agent mode to run tools.',
      };
    }

    // Check stored permission
    const permission = await checkPermission(call.server, call.tool);

    if (permission === 'always_deny') {
      return {
        call,
        result: null,
        error: `Tool "${call.tool}" on server "${call.server}" is set to always deny.`,
      };
    }

    // In Assist mode, tools with 'ask' permission require confirmation
    if (chatMode === 'assist' && permission === 'ask' && onConfirm) {
      const confirmed = await onConfirm(call);
      if (!confirmed) {
        return {
          call,
          result: null,
          error: `User declined to run tool "${call.tool}".`,
        };
      }
    }

    // Execute via MCP client (JSON-RPC)
    try {
      const result = await mcpClient.callTool(call.server, call.tool, call.arguments);
      return { call, result };
    } catch (err) {
      return {
        call,
        result: null,
        error: String(err),
      };
    }
  }

  /**
   * Execute multiple tool calls (alias for executeAllToolCalls for compatibility).
   *
   * @param calls       List of parsed tool calls.
   * @param chatMode    Current chat mode.
   * @param onConfirm   Optional confirmation callback for Assist mode.
   */
  async executeToolCalls(
    calls: ToolCall[],
    chatMode: ChatMode = 'chat',
    onConfirm?: ToolConfirmCallback,
  ): Promise<ToolExecutionResult[]> {
    return this.executeAllToolCalls(calls, chatMode, onConfirm);
  }

  /**
   * Execute all tool calls found in an AI response.
   *
   * @param toolCalls   List of parsed tool calls.
   * @param chatMode    Current chat mode.
   * @param onConfirm   Optional confirmation callback for Assist mode.
   */
  async executeAllToolCalls(
    toolCalls: ToolCall[],
    chatMode: ChatMode = 'chat',
    onConfirm?: ToolConfirmCallback,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const call of toolCalls) {
      const result = await this.executeToolCall(call, chatMode, onConfirm);
      results.push(result);
    }
    return results;
  }

  /**
   * Format tool execution results as a context string for the next AI turn.
   */
  formatToolResults(results: ToolExecutionResult[]): string {
    if (results.length === 0) return '';

    const parts: string[] = ['\n\n=== TOOL EXECUTION RESULTS ==='];

    for (const { call, result, error } of results) {
      parts.push(formatToolResult(call, result, error));
    }

    parts.push('\nUse these results to inform your next response.');

    return parts.join('\n');
  }

  /**
   * Process a complete tool-calling cycle for an AI response.
   *
   * Returns:
   *   - hasToolCalls: whether any [TOOL_CALL:...] patterns were found
   *   - toolResults:  formatted string of execution results (inject into next message)
   *   - cleanResponse: AI response with [TOOL_CALL:...] syntax stripped
   */
  async processToolCycle(
    aiResponse: string,
    chatMode: ChatMode = 'chat',
    onConfirm?: ToolConfirmCallback,
  ): Promise<{
    hasToolCalls: boolean;
    toolResults?: string;
    cleanResponse?: string;
  }> {
    const toolCalls = parseToolCalls(aiResponse);

    if (toolCalls.length === 0) {
      return { hasToolCalls: false };
    }

    const results = await this.executeAllToolCalls(toolCalls, chatMode, onConfirm);
    const toolResults = this.formatToolResults(results);
    const cleanResponse = stripToolCalls(aiResponse);

    return {
      hasToolCalls: true,
      toolResults,
      cleanResponse,
    };
  }
}

// Singleton instance
export const mcpChatIntegration = new MCPChatIntegration();
