/**
 * MCP API Service
 *
 * Wraps the server-side MCP management REST endpoints.
 * In the web app all MCP connections are managed server-side;
 * the browser never spawns stdio processes directly.
 */

import type { MCPServerConfig, MCPTool, MCPConnection } from '@desktop/types/mcp';

export type { MCPServerConfig, MCPTool, MCPConnection };

export interface MCPServerListItem {
  name: string;
  status: MCPConnection['status'];
  tools: MCPTool[];
  error?: string;
  config?: MCPServerConfig;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

function base(serverUrl: string): string {
  return serverUrl.replace(/\/$/, '');
}

// ── Servers ───────────────────────────────────────────────────────────────────

/**
 * List all configured MCP servers and their current connection status.
 * GET /api/mcp/servers
 */
export async function listServers(
  serverUrl: string,
  token: string,
): Promise<MCPServerListItem[]> {
  const res = await fetch(`${base(serverUrl)}/api/mcp/servers`, {
    headers: authHeaders(token),
  });
  return handleResponse<MCPServerListItem[]>(res, 'listMCPServers');
}

/**
 * Connect (or reconnect) to an MCP server.
 * POST /api/mcp/servers  { name, config }
 */
export async function connectServer(
  serverUrl: string,
  token: string,
  name: string,
  config: MCPServerConfig,
): Promise<MCPServerListItem> {
  const res = await fetch(`${base(serverUrl)}/api/mcp/servers`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, config }),
  });
  return handleResponse<MCPServerListItem>(res, `connectMCPServer(${name})`);
}

/**
 * Disconnect from a running MCP server.
 * DELETE /api/mcp/servers/{name}
 */
export async function disconnectServer(
  serverUrl: string,
  token: string,
  name: string,
): Promise<void> {
  const res = await fetch(
    `${base(serverUrl)}/api/mcp/servers/${encodeURIComponent(name)}`,
    { method: 'DELETE', headers: authHeaders(token) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`disconnectMCPServer(${name}) failed (${res.status}): ${body}`);
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

/**
 * List available tools for a specific server.
 * GET /api/mcp/servers/{name}/tools
 */
export async function listTools(
  serverUrl: string,
  token: string,
  serverName: string,
): Promise<MCPTool[]> {
  const res = await fetch(
    `${base(serverUrl)}/api/mcp/servers/${encodeURIComponent(serverName)}/tools`,
    { headers: authHeaders(token) },
  );
  return handleResponse<MCPTool[]>(res, `listMCPTools(${serverName})`);
}

/**
 * Execute a tool on a specific MCP server.
 * POST /api/mcp/servers/{name}/tools/{toolName}
 */
export async function executeTool(
  serverUrl: string,
  token: string,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(
    `${base(serverUrl)}/api/mcp/servers/${encodeURIComponent(serverName)}/tools/${encodeURIComponent(toolName)}`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ arguments: args }),
    },
  );
  return handleResponse<unknown>(res, `executeMCPTool(${serverName}.${toolName})`);
}

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Fetch the current MCP configuration from the server.
 * GET /api/mcp/config
 */
export async function getMCPConfig(
  serverUrl: string,
  token: string,
): Promise<MCPConfig> {
  const res = await fetch(`${base(serverUrl)}/api/mcp/config`, {
    headers: authHeaders(token),
  });
  return handleResponse<MCPConfig>(res, 'getMCPConfig');
}

/**
 * Overwrite the MCP configuration on the server.
 * PUT /api/mcp/config
 */
export async function updateMCPConfig(
  serverUrl: string,
  token: string,
  config: MCPConfig,
): Promise<MCPConfig> {
  const res = await fetch(`${base(serverUrl)}/api/mcp/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });
  return handleResponse<MCPConfig>(res, 'updateMCPConfig');
}
