/**
 * Memory Storage Service
 * Handles reading/writing memories to markdown files
 */

import type { PlatformService } from '@pyide/platform';
import type { MemoryEntry, MemoryFrontmatter } from '../../types/memory';

export class MemoryStorage {
  private platform: PlatformService;

  constructor(platform: PlatformService) {
    this.platform = platform;
  }

  /**
   * Save session memories to file
   */
  async saveSessionMemory(sessionId: string, entries: MemoryEntry[]): Promise<void> {
    const content = this.formatMemoriesAsMarkdown(entries);
    const homeDir = await this.platform.file.getHomeDir();
    const baseDir = await this.platform.memory.getBaseDir(homeDir);
    const path = `${baseDir}/sessions/session_${sessionId}.md`;
    
    await this.platform.file.write(path, content);
  }
  
  /**
   * Promote session memories to project memory
   */
  async promoteToProjectMemory(
    projectId: string,
    entries: MemoryEntry[]
  ): Promise<void> {
    const existing = await this.loadProjectMemory(projectId);
    const updated = [...existing, ...entries];
    const content = this.formatMemoriesAsMarkdown(updated);
    
    const homeDir = await this.platform.file.getHomeDir();
    const path = await this.platform.memory.getProjectMemoryPath(homeDir, projectId);
    
    await this.platform.file.write(path, content);
  }
  
  /**
   * Load project memories
   */
  async loadProjectMemory(projectId: string): Promise<MemoryEntry[]> {
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const path = await this.platform.memory.getProjectMemoryPath(homeDir, projectId);
      const content = await this.platform.file.read(path);
      return this.parseMemoriesFromMarkdown(content);
    } catch (error) {
      // File doesn't exist or is empty
      return [];
    }
  }
  
  /**
   * Load user memories
   */
  async loadUserMemory(): Promise<MemoryEntry[]> {
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const path = await this.platform.memory.getUserMemoryPath(homeDir);
      const content = await this.platform.file.read(path);
      return this.parseMemoriesFromMarkdown(content);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Save user memory
   */
  async saveUserMemory(entries: MemoryEntry[]): Promise<void> {
    const content = this.formatMemoriesAsMarkdown(entries);
    const homeDir = await this.platform.file.getHomeDir();
    const path = await this.platform.memory.getUserMemoryPath(homeDir);
    
    await this.platform.file.write(path, content);
  }
  
  /**
   * Format memories as markdown with YAML frontmatter
   */
  private formatMemoriesAsMarkdown(entries: MemoryEntry[]): string {
    if (entries.length === 0) {
      return '';
    }
    
    return entries.map(entry => {
      const frontmatter = `---
id: ${entry.id}
type: ${entry.type}
timestamp: ${entry.timestamp}
is_pinned: ${entry.isPinned}${entry.sessionId ? `\nsession_id: ${entry.sessionId}` : ''}${entry.projectId ? `\nproject_id: ${entry.projectId}` : ''}
---

${entry.content}

Context: ${entry.context || 'N/A'}
`;
      return frontmatter;
    }).join('\n---\n\n');
  }
  
  /**
   * Parse memories from markdown format
   */
  private parseMemoriesFromMarkdown(content: string): MemoryEntry[] {
    if (!content || content.trim().length === 0) {
      return [];
    }
    
    // Split by separator
    const blocks = content.split(/\n---\n\s*\n/).filter(b => b.trim());
    
    return blocks.map(block => {
      const match = block.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) return null;
      
      try {
        const frontmatter = this.parseYAML(match[1]);
        const body = match[2].trim();
        
        // Extract context from body
        const contextMatch = body.match(/Context:\s*(.+)$/m);
        const context = contextMatch ? contextMatch[1].trim() : undefined;
        const contentWithoutContext = body.replace(/Context:\s*.+$/m, '').trim();
        
        return {
          id: frontmatter.id || `mem-${Date.now()}`,
          type: frontmatter.type || 'project',
          content: contentWithoutContext,
          context,
          timestamp: frontmatter.timestamp || new Date().toISOString(),
          sessionId: frontmatter.session_id,
          projectId: frontmatter.project_id,
          isPinned: frontmatter.is_pinned || false
        } as MemoryEntry;
      } catch (error) {
        console.error('Failed to parse memory block:', error);
        return null;
      }
    }).filter(Boolean) as MemoryEntry[];
  }
  
  /**
   * Simple YAML parser for frontmatter
   */
  private parseYAML(yaml: string): MemoryFrontmatter {
    const result: any = {};
    yaml.split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value: any = match[2].trim();
        
        // Parse boolean
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        
        result[key] = value;
      }
    });
    return result;
  }
}
