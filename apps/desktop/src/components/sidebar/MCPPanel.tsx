/**
 * MCP Panel Component
 * Displays MCP server connections and status
 */

import React, { useEffect, useState, useRef } from 'react';
import { mcpClient } from '../../services/MCPService/client';
import { loadMCPConfig } from '../../services/MCPService/configLoader';
import type { MCPConnection } from '../../types/mcp';
import { usePlatform } from '@pyide/platform';
import './MCPPanel.css';

export const MCPPanel: React.FC = () => {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const platform = usePlatform();
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initializedRef.current) {
      console.log('[MCP] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;
    initializeMCP();
  }, []);
  
  async function initializeMCP() {
    setLoading(true);
    try {
      console.log('[MCP] Starting initialization...');
      const config = await loadMCPConfig(platform);
      console.log('[MCP] Config loaded:', config);
      
      // Connect to all configured servers
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        console.log(`[MCP] Connecting to server: ${name}`);
        await mcpClient.connectToServer(name, serverConfig);
        console.log(`[MCP] Server ${name} connection complete`);
      }
      
      const connections = mcpClient.getAllConnections();
      console.log('[MCP] All connections:', connections);
      setConnections(connections);
    } catch (error) {
      console.error('[MCP] Failed to initialize MCP:', error);
      // Still set connections to whatever we have
      try {
        setConnections(mcpClient.getAllConnections());
      } catch (e) {
        console.error('[MCP] Failed to get connections:', e);
      }
    } finally {
      console.log('[MCP] Initialization complete, setting loading=false');
      setLoading(false);
    }
  }
  
  async function handleDisconnect(serverName: string) {
    await mcpClient.disconnectFromServer(serverName);
    setConnections(mcpClient.getAllConnections());
  }
  
  if (loading) {
    return (
      <div className="mcp-panel">
        <h3>MCP Servers</h3>
        <div className="loading">Loading MCP servers...</div>
      </div>
    );
  }
  
  return (
    <div className="mcp-panel">
      <h3>MCP Servers</h3>
      
      {connections.length === 0 ? (
        <div className="empty-state">
          <p>No MCP servers configured</p>
          <div className="hint">
            <p>Add servers to:</p>
            <code>~/.pyide/mcp_config.json</code>
          </div>
        </div>
      ) : (
        <div className="server-list">
          {connections.map(conn => (
            <div key={conn.serverName} className={`server-card ${conn.status}`}>
              <div className="server-header">
                <div className="server-info">
                  <span className="server-name">{conn.serverName}</span>
                  <span className={`status-badge ${conn.status}`}>
                    {conn.status}
                  </span>
                </div>
                {conn.status === 'connected' && (
                  <button 
                    className="disconnect-btn"
                    onClick={() => handleDisconnect(conn.serverName)}
                    title="Disconnect"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {conn.error && (
                <div className="error-message">
                  <strong>Error:</strong> {conn.error}
                </div>
              )}
              
              {conn.tools.length > 0 ? (
                <div className="tools-section">
                  <h4>Available Tools ({conn.tools.length})</h4>
                  <ul className="tool-list">
                    {conn.tools.map(tool => (
                      <li key={tool.name} className="tool-item">
                        <strong>{tool.name}</strong>
                        <p>{tool.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : conn.status === 'connected' ? (
                <p className="no-tools">No tools discovered yet</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
