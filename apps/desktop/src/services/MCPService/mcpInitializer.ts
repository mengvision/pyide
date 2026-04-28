/**
 * MCP Initializer
 * Initializes MCP server connections at app startup (not tied to any UI component).
 * Extracted from MCPPanel to ensure MCP is available before AI Chat needs it.
 */

import type { PlatformService } from '@pyide/platform';
import { mcpClient } from './client';
import { loadMCPConfig } from './configLoader';
import { useMCPStore } from '../../stores/mcpStore';
import { discoverMCPSkills } from '../SkillService/mcpSkillDiscovery';

let initialized = false;

/**
 * A promise that resolves when MCP initialization has completed (success or partial).
 * Callers can await this to ensure MCP tools are available before use.
 */
let initPromise: Promise<void> | null = null;

/**
 * Initialize all configured MCP servers.
 * Idempotent — safe to call multiple times, only runs once.
 * Returns the shared initialization promise so callers can await readiness.
 */
export function initializeMCPConnections(platform: PlatformService): Promise<void> {
  if (initialized && initPromise) {
    console.log('[MCP Init] Already initialized, skipping');
    return initPromise;
  }
  initialized = true;

  const store = useMCPStore.getState();
  store.setInitialized(true);

  initPromise = (async () => {
    try {
      console.log('[MCP Init] Starting...');
      const config = await loadMCPConfig(platform);
      console.log('[MCP Init] Config loaded:', config);

      const serverEntries = Object.entries(config.mcpServers);

      // Connect to all servers concurrently; never let one failure block the others
      const results = await Promise.allSettled(
        serverEntries.map(([name, serverConfig]) => {
          console.log(`[MCP Init] Connecting to server: ${name}`);
          return mcpClient.connectToServer(name, serverConfig).then(() => {
            console.log(`[MCP Init] Server ${name} connection complete`);
          });
        }),
      );

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.warn(
            `[MCP Init] Server "${serverEntries[i][0]}" failed:`,
            result.reason,
          );
        }
      });

      const connections = mcpClient.getAllConnections();
      store.setConnections(connections);
      console.log('[MCP Init] All connections:', connections);

      // Discover skills from MCP servers that support prompts
      try {
        const discovered = await discoverMCPSkills();
        if (discovered.length > 0) {
          console.log(`[MCP Init] Discovered ${discovered.length} MCP skills:`, discovered);
        }
      } catch (error) {
        console.warn('[MCP Init] MCP skill discovery failed:', error);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[MCP Init] Failed to initialize MCP:', error);
      store.setInitError(errMsg);
      // Don't throw — partial connections may still work
      store.setConnections(mcpClient.getAllConnections());
    } finally {
      // Signal readiness regardless of partial failures so chat is never blocked
      store.setMcpReady(true);
      console.log('[MCP Init] MCP ready (all servers attempted)');
    }
  })();

  return initPromise;
}

/**
 * Returns the current initialization promise (or a resolved promise if init
 * has not started yet — unlikely after App.tsx triggers it on mount).
 */
export function getMCPInitPromise(): Promise<void> {
  return initPromise ?? Promise.resolve();
}

/** Reset the initialized flag (for testing / re-init scenarios). */
export function resetMCPInitFlag(): void {
  initialized = false;
  initPromise = null;
}
