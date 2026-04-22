/**
 * Skill Usage Tracking
 *
 * Tracks skill usage with a 7-day half-life exponential decay scoring,
 * following Claude Code's implementation. Skills that are used more
 * frequently and more recently get higher scores.
 */

import type { SkillUsageRecord } from '../../types/skill';

const STORAGE_KEY = 'pyide_skill_usage';
const DEBOUNCE_MS = 60_000; // 1 minute process-level debounce

// Process-lifetime debounce cache
const lastWriteBySkill = new Map<string, number>();

/**
 * Load all usage records from localStorage.
 */
function loadUsageRecords(): Record<string, SkillUsageRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save all usage records to localStorage.
 */
function saveUsageRecords(records: Record<string, SkillUsageRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save skill usage records:', error);
  }
}

/**
 * Record a skill usage for ranking purposes.
 * Uses 60-second process-level debounce to avoid excessive writes.
 */
export function recordSkillUsage(skillName: string): void {
  const now = Date.now();
  const lastWrite = lastWriteBySkill.get(skillName);

  // Debounce: sub-minute granularity is irrelevant for 7-day half-life
  if (lastWrite !== undefined && now - lastWrite < DEBOUNCE_MS) {
    return;
  }

  lastWriteBySkill.set(skillName, now);

  const records = loadUsageRecords();
  const existing = records[skillName];

  records[skillName] = {
    usageCount: (existing?.usageCount ?? 0) + 1,
    lastUsedAt: now,
  };

  saveUsageRecords(records);
}

/**
 * Calculate a usage score for a skill based on frequency and recency.
 *
 * Uses exponential decay with a half-life of 7 days:
 *   score = usageCount * max(0.5^(daysSinceUse / 7), 0.1)
 *
 * - Skills used today get full weight
 * - Skills used 7 days ago get half weight
 * - Minimum factor of 0.1 prevents old but heavily-used skills from vanishing
 */
export function getSkillUsageScore(skillName: string): number {
  const records = loadUsageRecords();
  const usage = records[skillName];

  if (!usage) return 0;

  const daysSinceUse = (Date.now() - usage.lastUsedAt) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.pow(0.5, daysSinceUse / 7);

  return usage.usageCount * Math.max(recencyFactor, 0.1);
}

/**
 * Get all usage records (for debugging or UI display).
 */
export function getAllUsageRecords(): Record<string, SkillUsageRecord> {
  return loadUsageRecords();
}

/**
 * Sort skills by usage score (descending).
 * Skills with no usage data get score 0 and appear last.
 */
export function sortByUsageScore<T extends { name: string }>(skills: T[]): T[] {
  return [...skills].sort((a, b) => {
    const scoreA = getSkillUsageScore(a.name);
    const scoreB = getSkillUsageScore(b.name);
    return scoreB - scoreA;
  });
}
