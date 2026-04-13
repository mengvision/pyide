/**
 * MCP (Model Context Protocol) Type Definitions
 */

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverName: string;
}

export interface MCPConnection {
  serverName: string;
  status: 'connecting' | 'connected' | 'error' | 'disconnected';
  tools: MCPTool[];
  error?: string;
}

export type MCPPermission = 'always_allow' | 'ask' | 'always_deny';

export interface MCPPermissionMap {
  [serverName: string]: {
    [toolName: string]: MCPPermission;
  };
}

export interface MCPToolCall {
  type: 'mcp';
  serverName: string;
  toolName: string;
  arguments: any;
}
