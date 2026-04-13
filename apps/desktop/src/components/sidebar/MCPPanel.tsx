/**
 * MCP Panel Component
 * Displays MCP server connections and status
 */

import React, { useEffect, useState } from 'react';
import { mcpClient } from '../../services/MCPService/client';
import { loadMCPConfig } from '../../services/MCPService/configLoader';
import type { MCPConnection } from '../../types/mcp';
import { usePlatform } from '@pyide/platform';
import './MCPPanel.css';

export const MCPPanel: React.FC = () => {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const platform = usePlatform();
  
  useEffect(() => {
    initializeMCP();
  }, []);
  
  async function initializeMCP() {
    setLoading(true);
    try {
      const config = await loadMCPConfig(platform);
      
      // Connect to all configured servers
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        await mcpClient.connectToServer(name, serverConfig);
      }
      
      setConnections(mcpClient.getAllConnections());
    } catch (error) {
      console.error('Failed to initialize MCP:', error);
    } finally {
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
