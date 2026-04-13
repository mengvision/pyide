/**
 * MCP Client
 * Manages connections to MCP servers via stdio transport with JSON-RPC
 */

import type { PlatformService } from '@pyide/platform';
import type { MCPTool, MCPConnection, MCPServerConfig } from '../../types/mcp';
import { JSONRPCClient } from './jsonRpcClient';

class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();
  private jsonRpcClients: Map<string, JSONRPCClient> = new Map();
  private platform: PlatformService | null = null;

  /** Inject the platform instance once at startup. */
  setPlatform(platform: PlatformService) {
    this.platform = platform;
  }

  private requirePlatform(): PlatformService {
    if (!this.platform) throw new Error('MCPClient: platform not initialized');
    return this.platform;
  }
  
  /**
   * Connect to an MCP server
   */
  async connectToServer(serverName: string, config: MCPServerConfig): Promise<void> {
    const platform = this.requirePlatform();

    this.connections.set(serverName, {
      serverName,
      status: 'connecting',
      tools: []
    });
    
    try {
      await platform.mcp.startServer(
        serverName,
        config.command,
        config.args,
        config.env || {}
      );
      
      // Create JSON-RPC client for this server
      const jsonRpcClient = new JSONRPCClient(serverName, platform);
      this.jsonRpcClients.set(serverName, jsonRpcClient);
      
      // Start listening for messages
      await jsonRpcClient.startListening();
      
      // Discover tools via JSON-RPC
      const tools = await this.discoverTools(serverName);
      
      this.connections.set(serverName, {
        serverName,
        status: 'connected',
        tools
      });
      
      console.log(`MCP server ${serverName} connected successfully with ${tools.length} tools`);
    } catch (error) {
      this.connections.set(serverName, {
        serverName,
        status: 'error',
        tools: [],
        error: String(error)
      });
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
    }
  }
  
  /**
   * Disconnect from an MCP server
   */
  async disconnectFromServer(serverName: string): Promise<void> {
    const platform = this.requirePlatform();

    try {
      // Clean up JSON-RPC client
      const jsonRpcClient = this.jsonRpcClients.get(serverName);
      if (jsonRpcClient) {
        jsonRpcClient.cleanup();
        this.jsonRpcClients.delete(serverName);
      }
      
      await platform.mcp.stopServer(serverName);
      this.connections.delete(serverName);
      console.log(`MCP server ${serverName} disconnected`);
    } catch (error) {
      console.error(`Failed to disconnect from MCP server ${serverName}:`, error);
    }
  }
  
  /**
   * Discover available tools from a connected server using JSON-RPC
   */
  async discoverTools(serverName: string): Promise<MCPTool[]> {
    const jsonRpcClient = this.jsonRpcClients.get(serverName);
    
    if (!jsonRpcClient) {
      console.error(`No JSON-RPC client for server ${serverName}`);
      return [];
    }
    
    try {
      // Send tools/list request per MCP specification
      const response = await jsonRpcClient.sendRequest('tools/list');
      
      if (response && response.tools && Array.isArray(response.tools)) {
        const tools: MCPTool[] = response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
          serverName
        }));
        
        console.log(`Discovered ${tools.length} tools from ${serverName}`);
        return tools;
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to discover tools from ${serverName}:`, error);
      return [];
    }
  }
  
  /**
   * Call a tool on an MCP server using JSON-RPC
   */
  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const jsonRpcClient = this.jsonRpcClients.get(serverName);
    
    if (!jsonRpcClient) {
      throw new Error(`No JSON-RPC client for server ${serverName}`);
    }
    
    try {
      // Send tools/call request per MCP specification
      const response = await jsonRpcClient.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });
      
      return response;
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }
  
  /**
   * Get connection status for a server
   */
  getConnection(serverName: string): MCPConnection | undefined {
    return this.connections.get(serverName);
  }
  
  /**
   * Get all connections
   */
  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }
  
  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    const conn = this.connections.get(serverName);
    return conn?.status === 'connected';
  }
}

export const mcpClient = new MCPClient();
