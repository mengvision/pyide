/**
 * MCP Permission System
 * Manages user permissions for MCP tool execution
 */

import type { MCPPermissionMap, MCPPermission } from '../../types/mcp';

const PERMISSIONS_KEY = 'mcp_permissions';

/**
 * Get all MCP permissions from localStorage
 */
export async function getMCPPermissions(): Promise<MCPPermissionMap> {
  try {
    const stored = localStorage.getItem(PERMISSIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load MCP permissions:', error);
    return {};
  }
}

/**
 * Set permission for a specific tool on a server
 */
export async function setMCPPermission(
  serverName: string,
  toolName: string,
  permission: MCPPermission
): Promise<void> {
  try {
    const permissions = await getMCPPermissions();
    
    if (!permissions[serverName]) {
      permissions[serverName] = {};
    }
    
    permissions[serverName][toolName] = permission;
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  } catch (error) {
    console.error('Failed to save MCP permission:', error);
    throw error;
  }
}

/**
 * Check permission for a specific tool
 * Returns 'ask' if no permission is set
 */
export async function checkPermission(
  serverName: string,
  toolName: string
): Promise<MCPPermission> {
  try {
    const permissions = await getMCPPermissions();
    return permissions[serverName]?.[toolName] || 'ask';
  } catch (error) {
    console.error('Failed to check MCP permission:', error);
    return 'ask';
  }
}

/**
 * Clear all permissions for a server
 */
export async function clearServerPermissions(serverName: string): Promise<void> {
  try {
    const permissions = await getMCPPermissions();
    delete permissions[serverName];
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  } catch (error) {
    console.error('Failed to clear server permissions:', error);
  }
}

/**
 * Reset all MCP permissions
 */
export async function resetAllPermissions(): Promise<void> {
  try {
    localStorage.removeItem(PERMISSIONS_KEY);
  } catch (error) {
    console.error('Failed to reset permissions:', error);
  }
}
