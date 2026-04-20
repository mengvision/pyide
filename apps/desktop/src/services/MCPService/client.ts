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
      console.log(`[MCPClient] Starting server: ${serverName}`);
      await platform.mcp.startServer(
        serverName,
        config.command,
        config.args,
        config.env || {}
      );
      console.log(`[MCPClient] Server process started: ${serverName}`);
      
      // Create JSON-RPC client for this server
      const jsonRpcClient = new JSONRPCClient(serverName, platform);
      this.jsonRpcClients.set(serverName, jsonRpcClient);
      
      // Start listening for messages
      await jsonRpcClient.startListening();
      console.log(`[MCPClient] Listening started: ${serverName}`);
      
      // Discover tools via JSON-RPC with timeout
      let tools: MCPTool[] = [];
      try {
        console.log(`[MCPClient] Discovering tools for: ${serverName}`);
        tools = await Promise.race([
          this.discoverTools(serverName),
          new Promise<MCPTool[]>((resolve) => 
            setTimeout(() => {
              console.warn(`[MCPClient] Tool discovery timeout for ${serverName}, using fallback`);
              resolve([]);
            }, 5000) // 5 second timeout
          )
        ]);
      } catch (discoverError) {
        console.warn(`[MCPClient] Tool discovery failed for ${serverName}:`, discoverError);
        tools = [];
      }
      
      // Fallback: If tool discovery fails, manually register known tools for DataHub
      if (tools.length === 0 && serverName === 'datahub') {
        console.log('[MCPClient] Tool discovery returned empty, using manual tool registration for DataHub');
        tools = this.getKnownDataHubTools();
      }
      
      this.connections.set(serverName, {
        serverName,
        status: 'connected',
        tools
      });
      
      console.log(`[MCPClient] Server ${serverName} connected with ${tools.length} tools`);
    } catch (error) {
      this.connections.set(serverName, {
        serverName,
        status: 'error',
        tools: [],
        error: String(error)
      });
      console.error(`[MCPClient] Failed to connect to MCP server ${serverName}:`, error);
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

  /**
   * Get known DataHub tools (fallback when tool discovery fails)
   * Based on DataHub MCP Server v2.14.7
   */
  private getKnownDataHubTools(): MCPTool[] {
    return [
      {
        name: 'search',
        description: 'Search DataHub using structured keyword search (/q syntax) with boolean logic, filters, pagination, and optional sorting by usage metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query using /q syntax, e.g., "revenue_*" or "tag:PII"' },
            start: { type: 'number', description: 'Starting offset for pagination' },
            count: { type: 'number', description: 'Number of results to return' }
          },
          required: ['query']
        },
        serverName: 'datahub'
      },
      {
        name: 'get_lineage',
        description: 'Retrieve upstream or downstream lineage for any entity (datasets, columns, dashboards, etc.) with filtering, query-within-lineage, pagination, and hop control.',
        inputSchema: {
          type: 'object',
          properties: {
            urn: { type: 'string', description: 'Entity URN to get lineage for' },
            direction: { type: 'string', enum: ['UPSTREAM', 'DOWNSTREAM'], description: 'Lineage direction' },
            max_hops: { type: 'number', description: 'Maximum number of hops to traverse' }
          },
          required: ['urn', 'direction']
        },
        serverName: 'datahub'
      },
      {
        name: 'get_dataset_queries',
        description: 'Fetch real SQL queries referencing a dataset or column—manual or system-generated—to understand usage patterns, joins, filters, and aggregation behavior.',
        inputSchema: {
          type: 'object',
          properties: {
            urn: { type: 'string', description: 'Dataset URN' },
            start: { type: 'number', description: 'Starting offset' },
            count: { type: 'number', description: 'Number of queries to return' }
          },
          required: ['urn']
        },
        serverName: 'datahub'
      },
      {
        name: 'get_entities',
        description: 'Fetch detailed metadata for one or more entities by URN; supports batch retrieval for efficient inspection of search results.',
        inputSchema: {
          type: 'object',
          properties: {
            urns: { type: 'array', items: { type: 'string' }, description: 'List of entity URNs to fetch' }
          },
          required: ['urns']
        },
        serverName: 'datahub'
      },
      {
        name: 'list_schema_fields',
        description: 'List schema fields for a dataset with keyword filtering and pagination, useful when search results truncate fields or when exploring large schemas.',
        inputSchema: {
          type: 'object',
          properties: {
            urn: { type: 'string', description: 'Dataset URN' },
            query: { type: 'string', description: 'Keyword filter for field names' },
            start: { type: 'number', description: 'Starting offset' },
            count: { type: 'number', description: 'Number of fields to return' }
          },
          required: ['urn']
        },
        serverName: 'datahub'
      },
      {
        name: 'get_lineage_paths_between',
        description: 'Retrieve the exact lineage paths between two assets or columns, including intermediate transformations and SQL query information.',
        inputSchema: {
          type: 'object',
          properties: {
            start_urn: { type: 'string', description: 'Starting entity URN' },
            end_urn: { type: 'string', description: 'Ending entity URN' }
          },
          required: ['start_urn', 'end_urn']
        },
        serverName: 'datahub'
      },
      {
        name: 'get_me',
        description: 'Retrieve information about the currently authenticated user, including profile details and group memberships.',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        serverName: 'datahub'
      }
    ];
  }
}

export const mcpClient = new MCPClient();
