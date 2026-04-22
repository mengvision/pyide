/**
 * MCP Panel Component
 * Displays MCP server connections and status from mcpStore.
 * Initialization is handled by mcpInitializer at App startup.
 */

import React from 'react';
import { useMCPStore } from '../../stores/mcpStore';
import { mcpClient } from '../../services/MCPService/client';
import './MCPPanel.css';

export const MCPPanel: React.FC = () => {
  const connections = useMCPStore((s) => s.connections);
  const isInitialized = useMCPStore((s) => s.isInitialized);
  const initError = useMCPStore((s) => s.initError);

  async function handleDisconnect(serverName: string) {
    await mcpClient.disconnectFromServer(serverName);
    // syncToStore in client.ts will update the store
  }

  if (!isInitialized) {
    return (
      <div className="mcp-panel">
        <h3>MCP Servers</h3>
        <div className="loading">Initializing MCP servers...</div>
      </div>
    );
  }

  return (
    <div className="mcp-panel">
      <h3>MCP Servers</h3>

      {initError && (
        <div className="error-banner">
          <strong>Init Error:</strong> {initError}
        </div>
      )}

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
          {connections.map((conn) => (
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
                    {conn.tools.map((tool) => (
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
