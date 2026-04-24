/**
 * MCP Skill Discovery
 *
 * Discovers skills from connected MCP servers that expose prompt-type
 * resources. Following Claude Code's mcpSkillBuilders pattern, this module
 * allows MCP servers to dynamically register skills into the PyIDE skill system.
 *
 * MCP Skill Discovery Protocol:
 *   1. After connecting to an MCP server, check if it supports "prompts" capability
 *   2. If so, call "prompts/list" to discover available prompts
 *   3. Each prompt becomes a skill with:
 *      - name: prompt name
 *      - description: prompt description
 *      - content: the prompt template (fetched via prompts/get)
 *      - source: 'mcp'
 *      - allowedTools: derived from the server's tool list
 *
 * This enables MCP server developers to ship domain-specific skills
 * alongside their tools, creating a richer AI experience.
 */

import { mcpClient } from '../MCPService/client';
import { useSkillStore } from './index';
import { recordSkillUsage } from './usageTracking';
import type { LoadedSkill } from '../../types/skill';

/** Skill source type extended with 'mcp' */
type MCPSkillSource = 'bundled' | 'project' | 'disk' | 'clawhub' | 'mcp';

/** Cache of discovered MCP skills to avoid re-fetching */
let mcpSkillCache: Map<string, LoadedSkill> = new Map();

/**
 * Discover skills from all connected MCP servers.
 * Called after MCP server connections are established.
 *
 * @returns Array of newly discovered skill names
 */
export async function discoverMCPSkills(): Promise<string[]> {
  const discovered: string[] = [];

  const connections = mcpClient.getAllConnections();
  const connectedServers = connections.filter(c => c.status === 'connected');

  for (const connection of connectedServers) {
    try {
      const skills = await discoverSkillsFromServer(connection.serverName);
      discovered.push(...skills);
    } catch (error) {
      console.warn(`[MCPSkillDiscovery] Failed to discover skills from ${connection.serverName}:`, error);
    }
  }

  // Reload skills to include newly discovered MCP skills
  if (discovered.length > 0) {
    await useSkillStore.getState().loadSkills();
  }

  return discovered;
}

/**
 * Discover skills from a single MCP server.
 * Checks if the server supports prompts and converts them to skills.
 */
async function discoverSkillsFromServer(serverName: string): Promise<string[]> {
  const discovered: string[] = [];

  // Check if the server supports prompts via JSON-RPC
  // Access the internal jsonRpcClients map through a getter method
  const jsonRpcClientsMap = (mcpClient as { jsonRpcClients: Map<string, any> }).jsonRpcClients;
  const jsonRpcClient = jsonRpcClientsMap?.get(serverName);
  if (!jsonRpcClient) {
    return discovered;
  }

  try {
    // Call prompts/list to discover available prompts
    const response = await jsonRpcClient.sendRequest('prompts/list');

    if (!response || !Array.isArray(response.prompts)) {
      // Server doesn't support prompts — that's fine
      return discovered;
    }

    for (const prompt of response.prompts) {
      const skillName = `mcp_${serverName}_${prompt.name}`;
      const skillId = `mcp-${serverName}-${prompt.name}`;

      // Fetch the full prompt content
      let promptContent = '';
      try {
        const promptResponse = await jsonRpcClient.sendRequest('prompts/get', {
          name: prompt.name,
        });
        promptContent = formatPromptAsSkillContent(promptResponse, prompt);
      } catch {
        // If we can't fetch the content, use the description as a fallback
        promptContent = prompt.description || `MCP skill from ${serverName}`;
      }

      // Build the skill from the prompt
      const skill: LoadedSkill = {
        id: skillId,
        name: skillName,
        description: prompt.description || `Skill from MCP server: ${serverName}`,
        content: promptContent,
        allowedTools: getServerToolNames(serverName),
        source: 'mcp' as MCPSkillSource as any,
        directory: `mcp://${serverName}`,
        isActive: false,
        whenToUse: `Available via MCP server ${serverName}`,
      };

      mcpSkillCache.set(skillId, skill);
      discovered.push(skillName);
    }
  } catch (error) {
    // prompts/list not supported — silently skip
  }

  return discovered;
}

/**
 * Format an MCP prompt response as skill content.
 */
function formatPromptAsSkillContent(promptResponse: any, promptMeta: any): string {
  const parts: string[] = [];

  // Add frontmatter
  parts.push('---');
  parts.push(`name: mcp_${promptMeta.name}`);
  parts.push(`description: ${promptMeta.description || 'MCP skill'}`);
  parts.push('---');
  parts.push('');

  // Add prompt messages as skill content
  if (promptResponse.messages && Array.isArray(promptResponse.messages)) {
    for (const message of promptResponse.messages) {
      if (message.role === 'system') {
        parts.push(`## System Instructions\n${message.content?.text || message.content || ''}`);
      } else if (message.role === 'user') {
        parts.push(`## Instructions\n${message.content?.text || message.content || ''}`);
      } else {
        parts.push(message.content?.text || message.content || '');
      }
    }
  }

  // If no messages, use the raw description
  if (parts.length <= 3) {
    parts.push(promptMeta.description || 'Execute this skill to use MCP server capabilities.');
  }

  return parts.join('\n');
}

/**
 * Get tool names from a connected MCP server.
 */
function getServerToolNames(serverName: string): string[] {
  const connections = mcpClient.getAllConnections();
  const connection = connections.find(c => c.serverName === serverName);
  if (!connection) return [];

  return connection.tools.map(t => `${serverName}.${t.name}`);
}

/**
 * Get all cached MCP skills.
 * Called by the skill loading process to include MCP skills.
 */
export function getMCPSkills(): LoadedSkill[] {
  return Array.from(mcpSkillCache.values());
}

/**
 * Clear MCP skill cache when a server disconnects.
 */
export function clearMCPSkillsForServer(serverName: string): void {
  const prefix = `mcp-${serverName}-`;
  for (const [key, _] of mcpSkillCache) {
    if (key.startsWith(prefix)) {
      mcpSkillCache.delete(key);
    }
  }
}

/**
 * Clear all MCP skill cache.
 */
export function clearAllMCPSkills(): void {
  mcpSkillCache.clear();
}
