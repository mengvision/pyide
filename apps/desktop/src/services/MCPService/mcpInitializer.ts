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
 * Initialize all configured MCP servers.
 * Idempotent — safe to call multiple times, only runs once.
 */
export async function initializeMCPConnections(platform: PlatformService): Promise<void> {
  if (initialized) {
    console.log('[MCP Init] Already initialized, skipping');
    return;
  }
  initialized = true;

  const store = useMCPStore.getState();
  store.setInitialized(true);

  try {
    console.log('[MCP Init] Starting...');
    const config = await loadMCPConfig(platform);
    console.log('[MCP Init] Config loaded:', config);

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      console.log(`[MCP Init] Connecting to server: ${name}`);
      await mcpClient.connectToServer(name, serverConfig);
      console.log(`[MCP Init] Server ${name} connection complete`);
    }

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
    // Sync whatever connections we have
    store.setConnections(mcpClient.getAllConnections());
  }
}

/** Reset the initialized flag (for testing / re-init scenarios). */
export function resetMCPInitFlag(): void {
  initialized = false;
}
