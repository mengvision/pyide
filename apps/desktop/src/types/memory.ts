/**
 * Memory System Type Definitions
 */

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  context?: string;
  timestamp: string;
  sessionId?: string;
  projectId?: string;
  isPinned: boolean;
  
  // Phase 2 fields (inactive but reserved for future use)
  strength?: number;
  decayRate?: number;
  accessCount?: number;
  lastAccessed?: string;
  
  compressedFrom?: string[];
}

export interface MemoryLayer {
  type: 'session' | 'project' | 'user' | 'team';
  entries: MemoryEntry[];
  path: string;
}

export interface DreamReport {
  phase: string;
  actions: string[];
  timestamp: string;
  summary?: string;
  error?: string;
}

export interface MemoryFrontmatter {
  id?: string;
  type?: MemoryType;
  timestamp?: string;
  is_pinned?: boolean;
  session_id?: string;
  project_id?: string;
}
