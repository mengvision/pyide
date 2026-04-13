/**
 * WebMemoryPanel
 *
 * Web adapter for the Memory sidebar panel.
 * Receives memory data and actions via props from useWebMemory hook.
 */

import React, { useState } from 'react';
import type { MemoryEntry, DreamStatus } from '../hooks/useWebMemory';

type MemoryFilterType = 'all' | 'user' | 'feedback' | 'project' | 'reference';

interface WebMemoryPanelProps {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;
  dreamStatus: DreamStatus | null;
  onDelete: (id: string) => void;
  onTriggerDream: () => void;
  onReload: () => void;
}

export const WebMemoryPanel: React.FC<WebMemoryPanelProps> = ({
  memories,
  loading,
  error,
  dreamStatus,
  onDelete,
  onTriggerDream,
  onReload,
}) => {
  const [filter, setFilter] = useState<MemoryFilterType>('all');

  const filteredMemories =
    filter === 'all' ? memories : memories.filter((m) => m.type === filter);

  const filterTypes: MemoryFilterType[] = [
    'all',
    'user',
    'feedback',
    'project',
    'reference',
  ];

  return (
    <div className="memory-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0 }}>Memory</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onReload}
            title="Refresh memories"
            style={iconBtnStyle}
          >
            ↻
          </button>
          <button
            onClick={onTriggerDream}
            title="Trigger Dream Mode consolidation"
            style={{
              ...iconBtnStyle,
              color: dreamStatus?.isRunning ? 'var(--accent)' : undefined,
            }}
          >
            💤
          </button>
        </div>
      </div>

      {dreamStatus?.isRunning && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          Dream Mode running…
        </div>
      )}

      {dreamStatus?.lastRun && !dreamStatus.isRunning && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}
        >
          Last consolidated:{' '}
          {new Date(dreamStatus.lastRun).toLocaleString()}
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div className="filter-tabs">
        {filterTypes.map((type) => (
          <button
            key={type}
            className={`filter-tab ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {type === 'all'
              ? 'All'
              : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading memories…</div>
      ) : filteredMemories.length === 0 ? (
        <div className="empty-state">
          <p>No memories yet</p>
          <p className="hint-text">
            Memories are automatically extracted from your conversations
          </p>
        </div>
      ) : (
        <div className="memory-list">
          {filteredMemories.map((memory) => (
            <WebMemoryCard
              key={memory.id}
              memory={memory}
              onDelete={() => onDelete(memory.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── WebMemoryCard ─────────────────────────────────────────────────────────────

interface WebMemoryCardProps {
  memory: MemoryEntry;
  onDelete: () => void;
}

const WebMemoryCard: React.FC<WebMemoryCardProps> = ({ memory, onDelete }) => (
  <div className={`memory-card ${memory.type}`}>
    <div className="memory-header">
      <span className={`memory-type-badge ${memory.type}`}>{memory.type}</span>
      {memory.isPinned && (
        <span className="pin-icon" title="Pinned">
          📌
        </span>
      )}
      <span className="memory-date">
        {new Date(memory.timestamp).toLocaleDateString()}
      </span>
      <button
        onClick={onDelete}
        title="Delete memory"
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 11,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>

    <p className="memory-content">{memory.content}</p>

    {memory.context && (
      <p className="memory-context">
        <strong>Context:</strong> {memory.context}
      </p>
    )}

    {memory.sessionId && (
      <p className="memory-meta">
        Session: {memory.sessionId.substring(0, 8)}…
      </p>
    )}
  </div>
);

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '2px 8px',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  fontSize: 12,
};
