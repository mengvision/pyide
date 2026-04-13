/**
 * Idle Dream Mode
 * Monitors session activity and triggers silent REM-C contradiction checks
 * Based on neuroscience research on sleep and memory consolidation
 */

import { DreamMode } from './dreamMode';
import { MemoryStorage } from './storage';
import type { PlatformService } from '@pyide/platform';

export interface IdleDreamConfig {
  checkInterval?: number;  // Sessions between checks (default: 20)
  projectId: string;
  platform: PlatformService;
}

export interface IdleDreamStatus {
  isMonitoring: boolean;
  sessionsSinceLastCheck: number;
  lastCheckTimestamp?: string;
  totalChecksPerformed: number;
}

export class IdleDreamMode {
  private config: IdleDreamConfig;
  private storage: MemoryStorage;
  private dreamMode: DreamMode;
  private status: IdleDreamStatus = {
    isMonitoring: false,
    sessionsSinceLastCheck: 0,
    lastCheckTimestamp: undefined,
    totalChecksPerformed: 0
  };
  private sessionCounter: number = 0;

  constructor(config: IdleDreamConfig) {
    this.config = config;
    this.storage = new MemoryStorage(config.platform);
    this.dreamMode = new DreamMode(this.storage, config.platform);
  }

  /**
   * Start monitoring for idle dream triggers
   */
  startMonitoring(): void {
    if (this.status.isMonitoring) {
      console.warn('Idle Dream Mode already monitoring');
      return;
    }

    this.status.isMonitoring = true;
    this.loadSessionCount();
    
    console.log(`Idle Dream Mode started (check every ${this.config.checkInterval || 20} sessions)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.status.isMonitoring = false;
    this.saveSessionCount();
    console.log('Idle Dream Mode stopped');
  }

  /**
   * Record a session completion
   * Call this when a user session ends
   */
  async recordSessionEnd(): Promise<void> {
    if (!this.status.isMonitoring) {
      return;
    }

    this.sessionCounter++;
    this.status.sessionsSinceLastCheck++;
    
    // Check if we should trigger idle dream
    const interval = this.config.checkInterval || 20;
    if (this.status.sessionsSinceLastCheck >= interval) {
      await this.triggerIdleDream();
    }
    
    // Save progress
    this.saveSessionCount();
  }

  /**
   * Trigger silent REM-C contradiction check
   * This runs without user interaction
   */
  private async triggerIdleDream(): Promise<void> {
    console.log('Triggering Idle Dream Mode (silent REM-C check)...');
    
    try {
      // Run full dream cycle but only care about contradictions
      const report = await this.dreamMode.executeDreamCycle(this.config.projectId);
      
      this.status.lastCheckTimestamp = new Date().toISOString();
      this.status.totalChecksPerformed++;
      this.status.sessionsSinceLastCheck = 0;
      
      console.log(`Idle Dream completed: ${report.phase}`);
      console.log(`Actions: ${report.actions.length}`);
      
      if (report.summary) {
        console.log('Summary:', report.summary);
      }
      
      if (report.error) {
        console.error('Dream error:', report.error);
      }
      
    } catch (error) {
      console.error('Idle Dream Mode error:', error);
      // Don't crash - just log and continue monitoring
    }
  }

  /**
   * Load session counter from localStorage
   */
  private loadSessionCount(): void {
    try {
      const saved = localStorage.getItem(`idle_dream_sessions_${this.config.projectId}`);
      if (saved) {
        const data = JSON.parse(saved);
        this.sessionCounter = data.sessionCounter || 0;
        this.status.sessionsSinceLastCheck = data.sessionsSinceLastCheck || 0;
        this.status.lastCheckTimestamp = data.lastCheckTimestamp;
        this.status.totalChecksPerformed = data.totalChecksPerformed || 0;
      }
    } catch (error) {
      console.error('Failed to load idle dream session count:', error);
    }
  }

  /**
   * Save session counter to localStorage
   */
  private saveSessionCount(): void {
    try {
      const data = {
        sessionCounter: this.sessionCounter,
        sessionsSinceLastCheck: this.status.sessionsSinceLastCheck,
        lastCheckTimestamp: this.status.lastCheckTimestamp,
        totalChecksPerformed: this.status.totalChecksPerformed
      };
      localStorage.setItem(
        `idle_dream_sessions_${this.config.projectId}`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Failed to save idle dream session count:', error);
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): IdleDreamStatus {
    return { ...this.status };
  }

  /**
   * Manually trigger an idle dream check (for testing)
   */
  async manualTrigger(): Promise<void> {
    console.log('Manual Idle Dream trigger');
    await this.triggerIdleDream();
  }

  /**
   * Reset counters (for testing or debugging)
   */
  reset(): void {
    this.sessionCounter = 0;
    this.status.sessionsSinceLastCheck = 0;
    this.status.lastCheckTimestamp = undefined;
    this.status.totalChecksPerformed = 0;
    
    localStorage.removeItem(`idle_dream_sessions_${this.config.projectId}`);
    console.log('Idle Dream counters reset');
  }
}
