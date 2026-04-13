/**
 * Memory Panel Component
 * Displays stored memories from project and user layers
 */

import React, { useEffect, useState } from 'react';
import { MemoryStorage } from '../../services/MemoryService/storage';
import type { MemoryEntry } from '../../types/memory';
import { usePlatform } from '@pyide/platform';
import './MemoryPanel.css';

export const MemoryPanel: React.FC = () => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | MemoryEntry['type']>('all');
  const platform = usePlatform();
  
  useEffect(() => {
    loadMemories();
  }, []);
  
  async function loadMemories() {
    setLoading(true);
    try {
      const storage = new MemoryStorage(platform);
      // For now, load project memories with a placeholder ID
      // In production, this would use the actual current project ID
      const projectMemories = await storage.loadProjectMemory('current-project');
      setMemories(projectMemories);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  }
  
  const filteredMemories = filter === 'all' 
    ? memories 
    : memories.filter(m => m.type === filter);
  
  const memoryTypes: Array<'all' | MemoryEntry['type']> = ['all', 'user', 'feedback', 'project', 'reference'];
  
  return (
    <div className="memory-panel">
      <h3>Memory</h3>
      
      <div className="filter-tabs">
        {memoryTypes.map(type => (
          <button
            key={type}
            className={`filter-tab ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      
      {loading ? (
        <div className="loading">Loading memories...</div>
      ) : filteredMemories.length === 0 ? (
        <div className="empty-state">
          <p>No memories yet</p>
          <p className="hint-text">
            Memories are automatically extracted from your conversations
          </p>
        </div>
      ) : (
        <div className="memory-list">
          {filteredMemories.map(memory => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      )}
    </div>
  );
};

interface MemoryCardProps {
  memory: MemoryEntry;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ memory }) => {
  return (
    <div className={`memory-card ${memory.type}`}>
      <div className="memory-header">
        <span className={`memory-type-badge ${memory.type}`}>
          {memory.type}
        </span>
        {memory.isPinned && <span className="pin-icon" title="Pinned">📌</span>}
        <span className="memory-date">
          {new Date(memory.timestamp).toLocaleDateString()}
        </span>
      </div>
      
      <p className="memory-content">{memory.content}</p>
      
      {memory.context && (
        <p className="memory-context">
          <strong>Context:</strong> {memory.context}
        </p>
      )}
      
      {memory.sessionId && (
        <p className="memory-meta">
          Session: {memory.sessionId.substring(0, 8)}...
        </p>
      )}
    </div>
  );
};
