/**
 * MCP Config Loader
 * Loads and saves MCP server configuration
 */

import type { PlatformService } from '@pyide/platform';
import type { MCPConfig } from '../../types/mcp';

const DEFAULT_CONFIG: MCPConfig = {
  mcpServers: {}
};

/**
 * Load MCP configuration from file
 */
export async function loadMCPConfig(platform: PlatformService): Promise<MCPConfig> {
  try {
    const homeDir = await platform.file.getHomeDir();
    const configPath = await platform.mcp.getConfigPath(homeDir);
    
    try {
      const content = await platform.file.read(configPath);
      return JSON.parse(content) as MCPConfig;
    } catch (error) {
      // File doesn't exist, return default config
      console.log('No MCP config found, using default');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error('Failed to load MCP config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save MCP configuration to file
 */
export async function saveMCPConfig(platform: PlatformService, config: MCPConfig): Promise<void> {
  try {
    const homeDir = await platform.file.getHomeDir();
    const configPath = await platform.mcp.getConfigPath(homeDir);
    
    await platform.file.write(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save MCP config:', error);
    throw error;
  }
}

/**
 * Add or update an MCP server configuration
 */
export async function addMCPServer(
  platform: PlatformService,
  name: string,
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<void> {
  const config = await loadMCPConfig(platform);
  
  config.mcpServers[name] = {
    command,
    args,
    env
  };
  
  await saveMCPConfig(platform, config);
}

/**
 * Remove an MCP server configuration
 */
export async function removeMCPServer(platform: PlatformService, name: string): Promise<void> {
  const config = await loadMCPConfig(platform);
  
  delete config.mcpServers[name];
  
  await saveMCPConfig(platform, config);
}
