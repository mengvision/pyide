/**
 * Dream Mode - Neuroscience-inspired memory consolidation
 * Implements 4-phase cycle: N1 (scan) → N3 (transfer) → REM-C (contradictions) → Wake (report)
 */

import type { PlatformService } from '@pyide/platform';
import { MemoryStorage } from './storage';
import type { MemoryEntry, DreamReport } from '../../types/memory';

export class DreamMode {
  private storage: MemoryStorage;
  private platform: PlatformService;
  
  constructor(storage: MemoryStorage, platform: PlatformService) {
    this.storage = storage;
    this.platform = platform;
  }
  
  /**
   * Check if Dream Mode should trigger
   * Trigger conditions: 24 hours since last dream OR > 5 sessions
   */
  async shouldTriggerDream(projectId: string): Promise<boolean> {
    const lastDreamTime = await this.getLastDreamTime(projectId);
    const sessionCount = await this.getSessionCount(projectId);
    
    const hoursSinceLastDream = lastDreamTime 
      ? (Date.now() - lastDreamTime) / (1000 * 60 * 60)
      : Infinity;
    
    return hoursSinceLastDream >= 24 || sessionCount > 5;
  }
  
  /**
   * Execute full Dream Mode cycle
   */
  async executeDreamCycle(projectId: string): Promise<DreamReport> {
    const report: DreamReport = {
      phase: 'starting',
      actions: [],
      timestamp: new Date().toISOString()
    };
    
    console.log('[Dream Mode] Starting dream cycle for project:', projectId);
    
    try {
      // Phase N1: Weight Scan - Collect recent session memories
      report.phase = 'N1: Weight Scan';
      console.log('[Dream Mode] Phase N1: Scanning session memories...');
      const sessionMemories = await this.collectRecentSessionMemories(projectId);
      report.actions.push(`Scanned ${sessionMemories.length} session memories`);
      
      // Phase N3: Memory Transfer - Promote important memories to project layer
      report.phase = 'N3: Memory Transfer';
      console.log('[Dream Mode] Phase N3: Transferring memories to project layer...');
      const memoriesToPromote = await this.identifyMemoriesForPromotion(sessionMemories);
      
      if (memoriesToPromote.length > 0) {
        await this.storage.promoteToProjectMemory(projectId, memoriesToPromote);
        report.actions.push(`Promoted ${memoriesToPromote.length} memories to project layer`);
        console.log(`[Dream Mode] Promoted ${memoriesToPromote.length} memories`);
      } else {
        report.actions.push('No memories selected for promotion');
      }
      
      // Phase REM-C: Contradiction Detection
      report.phase = 'REM-C: Contradiction Detection';
      console.log('[Dream Mode] Phase REM-C: Checking for contradictions...');
      const contradictions = await this.detectContradictions(projectId);
      
      if (contradictions.length > 0) {
        report.actions.push(`Found ${contradictions.length} contradictions to review`);
        console.warn(`[Dream Mode] Found ${contradictions.length} contradictions`);
        // In a full implementation, flag these for user review
      } else {
        report.actions.push('No contradictions detected');
      }
      
      // Phase Wake: Generate Report
      report.phase = 'Wake: Report Generation';
      console.log('[Dream Mode] Phase Wake: Generating dream report...');
      report.summary = this.generateDreamSummary(report);
      
      // Save dream log
      await this.saveDreamLog(projectId, report);
      
      report.phase = 'complete';
      console.log('[Dream Mode] Dream cycle complete');
      
      return report;
    } catch (error) {
      report.phase = 'error';
      report.error = String(error);
      console.error('[Dream Mode] Error during dream cycle:', error);
      return report;
    }
  }
  
  /**
   * Collect all session memories for a project
   */
  private async collectRecentSessionMemories(projectId: string): Promise<MemoryEntry[]> {
    const allEntries: MemoryEntry[] = [];
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const baseDir = await this.platform.memory.getBaseDir(homeDir);
      const sessionDir = `${baseDir}/sessions`;

      let entries: any[];
      try {
        entries = await this.platform.file.readDirectory(sessionDir);
      } catch {
        return allEntries;
      }

      // Filter session files for this project (or all sessions if no match)
      const sessionFiles = entries
        .filter((e: any) => !e.is_dir && e.name.endsWith('.md'))
        .sort((a: any, b: any) => b.name.localeCompare(a.name))
        .slice(0, 20);

      for (const file of sessionFiles) {
        try {
          const content = await this.platform.file.read(file.path);
          // Parse entries using the same format as MemoryStorage
          const blocks = content.split(/\n---\n\s*\n/).filter((b: string) => b.trim());
          for (const block of blocks) {
            const match = block.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (!match) continue;
            try {
              const frontmatter: Record<string, any> = {};
              match[1].split('\n').forEach((line: string) => {
                const m = line.match(/^(\w+):\s*(.+)$/);
                if (m) {
                  let v: any = m[2].trim();
                  if (v === 'true') v = true;
                  else if (v === 'false') v = false;
                  frontmatter[m[1]] = v;
                }
              });
              // Only include entries belonging to this project
              if (frontmatter.project_id && frontmatter.project_id !== projectId) continue;
              const body = match[2].trim();
              const contextMatch = body.match(/Context:\s*(.+)$/m);
              allEntries.push({
                id: frontmatter.id || `mem-${Date.now()}`,
                type: frontmatter.type || 'project',
                content: body.replace(/Context:\s*.+$/m, '').trim(),
                context: contextMatch ? contextMatch[1].trim() : undefined,
                timestamp: frontmatter.timestamp || new Date().toISOString(),
                sessionId: frontmatter.session_id,
                projectId: frontmatter.project_id,
                isPinned: frontmatter.is_pinned || false
              } as MemoryEntry);
            } catch {
              // skip malformed block
            }
          }
        } catch {
          // skip unreadable file
        }
      }
      return allEntries.slice(0, 20);
    } catch (error) {
      console.error('[Dream Mode] Failed to collect session memories:', error);
      return allEntries;
    }
  }
  
  /**
   * Identify which session memories should be promoted to project memory
   * Criteria: repeated mentions, high importance, project-relevant
   */
  private async identifyMemoriesForPromotion(
    sessionMemories: MemoryEntry[]
  ): Promise<MemoryEntry[]> {
    // Simple heuristic: promote project and feedback type memories
    return sessionMemories.filter(m => 
      m.type === 'project' || m.type === 'feedback'
    );
  }
  
  /**
   * Detect contradictory memories in project memory
   */
  private async detectContradictions(projectId: string): Promise<Array<{
    memory1: MemoryEntry;
    memory2: MemoryEntry;
    conflict: string;
  }>> {
    const projectMemories = await this.storage.loadProjectMemory(projectId);
    const contradictions: Array<{ memory1: MemoryEntry; memory2: MemoryEntry; conflict: string }> = [];

    // Keyword-based contradiction detection
    const prefKeywords = ['prefers', 'uses', 'likes', 'wants', 'use'];
    const negKeywords = ["don't use", "doesn't use", "avoid", "not use", "never use"];

    type PrefStatement = { keyword: string; subject: string; memIdx: number };
    const positiveStatements: PrefStatement[] = [];
    const negativeStatements: PrefStatement[] = [];

    projectMemories.forEach((mem, idx) => {
      const lower = mem.content.toLowerCase();

      for (const neg of negKeywords) {
        const negIdx = lower.indexOf(neg);
        if (negIdx !== -1) {
          const subject = lower.slice(negIdx + neg.length).trim().split(/[\s,;.]/)[0];
          if (subject) negativeStatements.push({ keyword: neg, subject, memIdx: idx });
        }
      }

      for (const kw of prefKeywords) {
        const kwIdx = lower.indexOf(kw + ' ');
        if (kwIdx !== -1) {
          const subject = lower.slice(kwIdx + kw.length + 1).trim().split(/[\s,;.]/)[0];
          if (subject) positiveStatements.push({ keyword: kw, subject, memIdx: idx });
        }
      }
    });

    for (const pos of positiveStatements) {
      for (const neg of negativeStatements) {
        if (pos.subject === neg.subject && pos.memIdx !== neg.memIdx) {
          const mem1 = projectMemories[pos.memIdx];
          const mem2 = projectMemories[neg.memIdx];
          const alreadyAdded = contradictions.some(
            c => (c.memory1.id === mem1.id && c.memory2.id === mem2.id) ||
                 (c.memory1.id === mem2.id && c.memory2.id === mem1.id)
          );
          if (!alreadyAdded) {
            contradictions.push({
              memory1: mem1,
              memory2: mem2,
              conflict: `Conflicting statements about "${pos.subject}": "${pos.keyword}" vs "${neg.keyword}"`
            });
          }
        }
      }
    }

    for (let i = 0; i < positiveStatements.length; i++) {
      for (let j = i + 1; j < positiveStatements.length; j++) {
        const a = positiveStatements[i];
        const b = positiveStatements[j];
        if (a.keyword === b.keyword && a.subject !== b.subject && a.memIdx !== b.memIdx) {
          const mem1 = projectMemories[a.memIdx];
          const mem2 = projectMemories[b.memIdx];
          const alreadyAdded = contradictions.some(
            c => (c.memory1.id === mem1.id && c.memory2.id === mem2.id) ||
                 (c.memory1.id === mem2.id && c.memory2.id === mem1.id)
          );
          if (!alreadyAdded) {
            contradictions.push({
              memory1: mem1,
              memory2: mem2,
              conflict: `Conflicting "${a.keyword}" preferences: "${a.subject}" vs "${b.subject}"`
            });
          }
        }
      }
    }

    return contradictions;
  }
  
  /**
   * Generate human-readable dream summary
   */
  private generateDreamSummary(report: DreamReport): string {
    return `
Dream Mode Summary
==================
Timestamp: ${report.timestamp}
Phases Completed: ${report.phase}

Actions Taken:
${report.actions.map(a => `- ${a}`).join('\n')}

${report.summary || 'No significant changes.'}
    `.trim();
  }
  
  /**
   * Get timestamp of last dream cycle
   */
  private async getLastDreamTime(projectId: string): Promise<number | null> {
    let result: number | null = null;
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const projectMemPath = await this.platform.memory.getProjectMemoryPath(homeDir, projectId);
      const logPath = projectMemPath.replace('project.md', 'dream_log.md');
      const content = await this.platform.file.read(logPath);

      // Find all **Timestamp:** lines and pick the last one
      const matches = [...content.matchAll(/\*\*Timestamp:\*\*\s*([^\n]+)/g)];
      if (matches.length > 0) {
        const lastTimestamp = matches[matches.length - 1][1].trim();
        const parsed = Date.parse(lastTimestamp);
        if (!isNaN(parsed)) {
          result = parsed;
        }
      }
    } catch {
      // log file not found or unreadable
    }
    return result;
  }
  
  /**
   * Count number of sessions for a project
   */
  private async getSessionCount(projectId: string): Promise<number> {
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const baseDir = await this.platform.memory.getBaseDir(homeDir);
      const sessionDir = `${baseDir}/sessions`;
      const entries = await this.platform.file.readDirectory(sessionDir);
      const count = entries.filter((e: any) => !e.is_dir && e.name.endsWith('.md')).length;
      return count;
    } catch {
      return -1;
    }
  }
  
  /**
   * Save dream log to file
   */
  private async saveDreamLog(projectId: string, report: DreamReport): Promise<void> {
    try {
      const homeDir = await this.platform.file.getHomeDir();
      const path = await this.platform.memory.getProjectMemoryPath(homeDir, projectId);
      const logPath = path.replace('project.md', 'dream_log.md');
      
      const logEntry = `\n\n---\n\n# Dream Log Entry\n\n**Timestamp:** ${report.timestamp}\n**Phase:** ${report.phase}\n\n${report.actions.map(a => `- ${a}`).join('\n')}\n\n${report.summary || ''}`;

      // Read existing content (if any) and append new entry
      let existingContent = '';
      try {
        existingContent = await this.platform.file.read(logPath);
      } catch {
        // File doesn't exist yet; start fresh
      }
      const fullContent = existingContent + logEntry;
      await this.platform.file.write(logPath, fullContent);
      console.log('[Dream Mode] Dream log saved');
    } catch (error) {
      console.error('[Dream Mode] Failed to save dream log:', error);
    }
  }
}
