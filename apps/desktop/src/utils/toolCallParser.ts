/**
 * Tool Call Parser
 * Parses and formats MCP tool call patterns in AI responses.
 */

export interface ToolCall {
  server: string;
  tool: string;
  arguments: Record<string, any>;
  raw: string; // Original matched text
}

/**
 * Parse AI response text for tool call patterns.
 * Format: [TOOL_CALL: server_name.tool_name({"arg": "value"})]
 *
 * Handles nested braces by matching greedily up to the last } before )]
 */
export function parseToolCalls(text: string): ToolCall[] {
  // Using a pattern that captures everything between the outer parens
  const pattern = /\[TOOL_CALL:\s*(\w+)\.(\w+)\((\{[\s\S]*?\})\)\]/g;
  const calls: ToolCall[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      calls.push({
        server: match[1],
        tool: match[2],
        arguments: JSON.parse(match[3]),
        raw: match[0],
      });
    } catch (e) {
      console.warn('Failed to parse tool call arguments:', match[0], e);
    }
  }

  return calls;
}

/**
 * Format tool result for injection back into conversation.
 */
export function formatToolResult(call: ToolCall, result: any, error?: string): string {
  if (error) {
    return `[TOOL_RESULT: ${call.server}.${call.tool} ERROR: ${error}]`;
  }
  return `[TOOL_RESULT: ${call.server}.${call.tool} => ${JSON.stringify(result)}]`;
}

/**
 * Strip all [TOOL_CALL: ...] patterns from a response string.
 */
export function stripToolCalls(text: string): string {
  return text.replace(/\[TOOL_CALL:\s*\w+\.\w+\(\{[\s\S]*?\}\)\]/g, '').trim();
}
