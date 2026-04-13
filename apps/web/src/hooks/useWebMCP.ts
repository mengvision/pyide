/**
 * useWebMCP Hook
 *
 * React hook that manages MCP server connections through the Phase 3 server
 * REST API. The browser never spawns local processes — the server handles all
 * stdio MCP transport.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import * as mcpApi from '../services/mcpApi';
import type { MCPServerListItem, MCPServerConfig, MCPTool } from '../services/mcpApi';

export type { MCPServerListItem, MCPServerConfig, MCPTool };

interface UseWebMCPOptions {
  /** Auth token from useWebAuth */
  token: string | null;
}

export interface UseWebMCPReturn {
  /** All configured MCP servers with their connection status */
  servers: MCPServerListItem[];
  /** True while the initial server list load is in progress */
  loading: boolean;
  /** Last error from any API call */
  error: string | null;
  /** Connect to (or reconnect) an MCP server */
  connectServer: (name: string, config: MCPServerConfig) => Promise<void>;
  /** Disconnect from a running MCP server */
  disconnectServer: (name: string) => Promise<void>;
  /** Execute a tool on a connected server */
  executeToolCall: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  /** Reload the server list from the server */
  reloadServers: () => Promise<void>;
  /** Get a formatted tools description for injection into system prompt */
  getToolsForAI: () => string;
}

export function useWebMCP({ token }: UseWebMCPOptions): UseWebMCPReturn {
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const [servers, setServers] = useState<MCPServerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);

  // ── Load server list ──────────────────────────────────────────────────────

  const reloadServers = useCallback(async () => {
    if (!token || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await mcpApi.listServers(serverUrl, token);
      setServers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWebMCP] reloadServers error:', msg);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [token, serverUrl]);

  useEffect(() => {
    reloadServers();
  }, [reloadServers]);

  // ── Connect ───────────────────────────────────────────────────────────────

  const connectServer = useCallback(
    async (name: string, config: MCPServerConfig) => {
      if (!token) return;
      setError(null);

      // Optimistic: mark as connecting
      setServers((prev) => {
        const existing = prev.find((s) => s.name === name);
        if (existing) {
          return prev.map((s) =>
            s.name === name ? { ...s, status: 'connecting' as const } : s,
          );
        }
        return [
          ...prev,
          { name, status: 'connecting' as const, tools: [], config },
        ];
      });

      try {
        const updated = await mcpApi.connectServer(serverUrl, token, name, config);
        setServers((prev) =>
          prev.map((s) => (s.name === name ? updated : s)),
        );
      } catch (err) {
        setServers((prev) =>
          prev.map((s) =>
            s.name === name
              ? {
                  ...s,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : String(err),
                }
              : s,
          ),
        );
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error(`[useWebMCP] connectServer(${name}) error:`, msg);
      }
    },
    [token, serverUrl],
  );

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnectServer = useCallback(
    async (name: string) => {
      if (!token) return;
      setError(null);

      try {
        await mcpApi.disconnectServer(serverUrl, token, name);
        setServers((prev) => prev.filter((s) => s.name !== name));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error(`[useWebMCP] disconnectServer(${name}) error:`, msg);
      }
    },
    [token, serverUrl],
  );

  // ── Execute tool ──────────────────────────────────────────────────────────

  const executeToolCall = useCallback(
    async (
      serverName: string,
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<unknown> => {
      if (!token) throw new Error('Not authenticated');
      return mcpApi.executeTool(serverUrl, token, serverName, toolName, args);
    },
    [token, serverUrl],
  );

  // ── Derived: tools description for system prompt ──────────────────────────

  const getToolsForAI = useCallback((): string => {
    const connected = servers.filter((s) => s.status === 'connected');
    if (connected.length === 0) return '';

    const parts: string[] = ['\n\n=== AVAILABLE MCP TOOLS ==='];

    for (const server of connected) {
      if (server.tools.length > 0) {
        parts.push(`\nServer: ${server.name}`);
        for (const tool of server.tools) {
          parts.push(`- ${tool.name}: ${tool.description}`);
          if (tool.inputSchema) {
            parts.push(
              `  Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}`,
            );
          }
        }
      }
    }

    parts.push(
      '\nTo use a tool, respond with: [TOOL_CALL: server_name.tool_name({"arg": "value"})]',
    );

    return parts.join('\n');
  }, [servers]);

  return {
    servers,
    loading,
    error,
    connectServer,
    disconnectServer,
    executeToolCall,
    reloadServers,
    getToolsForAI,
  };
}
