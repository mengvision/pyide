/**
 * JSON-RPC Client for MCP Communication
 * Handles bidirectional stdio communication with MCP servers
 */

import type { PlatformService } from '@pyide/platform';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

type MessageHandler = (message: JSONRPCResponse | JSONRPCNotification) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class JSONRPCClient {
  private serverName: string;
  private platform: PlatformService;
  private messageId: number = 0;
  private pendingRequests: Map<number | string, PendingRequest> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private buffer: string = '';
  private isListening: boolean = false;

  constructor(serverName: string, platform: PlatformService) {
    this.serverName = serverName;
    this.platform = platform;
  }

  /**
   * Start listening for messages from the MCP server
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.listenForMessages();
  }

  /**
   * Stop listening for messages
   */
  stopListening(): void {
    this.isListening = false;
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest(method: string, params?: any, timeout: number = 30000): Promise<any> {
    const id = ++this.messageId;
    
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method} (id: ${id})`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutId
      });

      // Send the request
      this.sendMessage(request).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  /**
   * Send a notification (no response expected)
   */
  async sendNotification(method: string, params?: any): Promise<void> {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params
    };

    await this.sendMessage(notification);
  }

  /**
   * Register a message handler for notifications
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Send a raw message to the server
   */
  private async sendMessage(message: JSONRPCRequest | JSONRPCNotification): Promise<void> {
    const json = JSON.stringify(message) + '\n';
    
    try {
      await this.platform.mcp.sendMessage(this.serverName, json);
    } catch (error) {
      console.error(`Failed to send message to ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Listen for incoming messages from the server
   */
  private async listenForMessages(): Promise<void> {
    while (this.isListening) {
      try {
        // Read a line from the server's stdout
        const line = await this.platform.mcp.readMessage(this.serverName);

        if (!line || line.trim() === '') {
          continue;
        }

        this.processMessage(line.trim());
      } catch (error) {
        if (this.isListening) {
          console.error(`Error reading from ${this.serverName}:`, error);
        }
        break;
      }
    }
  }

  /**
   * Process an incoming message
   */
  private processMessage(jsonString: string): void {
    try {
      const message = JSON.parse(jsonString) as JSONRPCResponse | JSONRPCNotification;

      // Check if it's a response to a pending request
      if ('id' in message && typeof message.id === 'number') {
        const pending = this.pendingRequests.get(message.id);
        
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if ('error' in message && message.error) {
            pending.reject(new Error(`JSON-RPC Error: ${message.error.message}`));
          } else {
            pending.resolve(message.result);
          }
          return;
        }
      }

      // It's a notification or unmatched response, notify handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('Failed to parse JSON-RPC message:', error, jsonString);
    }
  }

  /**
   * Clean up pending requests
   */
  cleanup(): void {
    this.pendingRequests.forEach((pending, id) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
    this.messageHandlers.clear();
    this.isListening = false;
  }
}
