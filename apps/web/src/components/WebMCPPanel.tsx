/**
 * WebMCPPanel
 *
 * Web adapter for the MCP sidebar panel.
 * Receives server data and actions via props from useWebMCP hook.
 * No local stdio processes — all MCP is managed server-side.
 */

import React from 'react';
import type { MCPServerListItem } from '../hooks/useWebMCP';

interface WebMCPPanelProps {
  servers: MCPServerListItem[];
  loading: boolean;
  error: string | null;
  onDisconnect: (name: string) => void;
  onReload: () => void;
}

export const WebMCPPanel: React.FC<WebMCPPanelProps> = ({
  servers,
  loading,
  error,
  onDisconnect,
  onReload,
}) => {
  if (loading) {
    return (
      <div className="mcp-panel">
        <h3>MCP Servers</h3>
        <div className="loading">Loading MCP servers…</div>
      </div>
    );
  }

  return (
    <div className="mcp-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>MCP Servers</h3>
        <button
          onClick={onReload}
          title="Refresh server list"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {servers.length === 0 ? (
        <div className="empty-state">
          <p>No MCP servers configured</p>
          <div className="hint">
            <p>Add servers via the server API or configuration.</p>
          </div>
        </div>
      ) : (
        <div className="server-list">
          {servers.map((conn) => (
            <div key={conn.name} className={`server-card ${conn.status}`}>
              <div className="server-header">
                <div className="server-info">
                  <span className="server-name">{conn.name}</span>
                  <span className={`status-badge ${conn.status}`}>
                    {conn.status}
                  </span>
                </div>
                {conn.status === 'connected' && (
                  <button
                    className="disconnect-btn"
                    onClick={() => onDisconnect(conn.name)}
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
