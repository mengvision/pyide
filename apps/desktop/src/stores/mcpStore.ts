/**
 * MCP Global State (Zustand Store)
 * Manages MCP connection state independently of any UI component.
 * Consumed by MCPPanel (display), AIChatPanel (connection awareness),
 * and mcpInitializer / mcpClient (writers).
 */

import { create } from 'zustand';
import type { MCPConnection } from '../types/mcp';

export interface ToolExecutionState {
  server: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
}

interface MCPState {
  // Connection state
  connections: MCPConnection[];
  isInitialized: boolean;
  initError: string | null;

  /**
   * True after all configured MCP servers have attempted connection
   * (whether they succeeded or failed). Chat in assist/agent modes
   * should wait for this before fetching tools.
   */
  mcpReady: boolean;

  // Tool execution state (transient, per-session)
  toolExecutions: ToolExecutionState[];

  // Actions
  setConnections: (connections: MCPConnection[]) => void;
  setInitialized: (initialized: boolean) => void;
  setInitError: (error: string | null) => void;
  setMcpReady: (ready: boolean) => void;

  // Tool execution tracking
  setToolExecuting: (execution: ToolExecutionState) => void;
  clearToolExecutions: () => void;
}

export const useMCPStore = create<MCPState>((set) => ({
  connections: [],
  isInitialized: false,
  initError: null,
  mcpReady: false,
  toolExecutions: [],

  setConnections: (connections) => set(() => ({ connections })),

  setInitialized: (isInitialized) => set(() => ({ isInitialized })),

  setInitError: (initError) => set(() => ({ initError })),

  setMcpReady: (mcpReady) => set(() => ({ mcpReady })),

  setToolExecuting: (execution) =>
    set((state) => ({
      toolExecutions: [
        ...state.toolExecutions.filter(
          (t) => !(t.server === execution.server && t.tool === execution.tool)
        ),
        execution,
      ],
    })),

  clearToolExecutions: () => set(() => ({ toolExecutions: [] })),
}));
