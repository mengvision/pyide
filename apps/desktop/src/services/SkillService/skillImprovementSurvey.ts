/**
 * Skill Improvement Survey
 *
 * Collects user feedback after skill usage to improve skill quality.
 * Following Claude Code's SkillImprovementSurvey pattern, this module
 * tracks skill usage sessions and prompts for feedback when appropriate.
 *
 * Survey triggers:
 *   - After a skill has been used N times (configurable, default: 3)
 *   - After a skill session ends (deactivation)
 *   - Random sampling to avoid survey fatigue
 *
 * Survey data is stored locally and can be optionally shared with
 * ClawHub for community skill improvement.
 */

import type { LoadedSkill } from '../../types/skill';
import { recordSkillUsage } from './usageTracking';

// ── Survey Configuration ──────────────────────────────────────────────────

/** Minimum uses before showing a survey */
const MIN_USES_BEFORE_SURVEY = 3;

/** Probability of showing a survey (0.0–1.0) to avoid fatigue */
const SURVEY_PROBABILITY = 0.2;

/** localStorage key for survey data */
const SURVEY_STORAGE_KEY = 'pyide_skill_surveys';

/** Maximum days to keep survey records */
const SURVEY_RETENTION_DAYS = 90;

// ── Survey Types ──────────────────────────────────────────────────────────

export type SurveyRating = 1 | 2 | 3 | 4 | 5;

export interface SkillSurvey {
  /** Skill name */
  skillName: string;
  /** When the survey was submitted */
  timestamp: number;
  /** Overall rating (1-5) */
  rating: SurveyRating;
  /** Was the skill helpful? */
  helpful: boolean;
  /** What could be improved? (free text) */
  improvement?: string;
  /** Did the skill produce correct results? */
  accurate: boolean;
  /** Was the skill easy to use? */
  easyToUse: boolean;
  /** Would the user recommend this skill? */
  wouldRecommend: boolean;
}

export interface SurveyPrompt {
  /** The skill to survey about */
  skillName: string;
  /** How many times the user has used this skill */
  useCount: number;
  /** Whether this is a good time to show the survey */
  shouldShow: boolean;
  /** Reason if shouldShow is false */
  reason?: string;
}

// ── Survey State ──────────────────────────────────────────────────────────

/** Pending survey prompt (shown in UI) */
let pendingSurvey: SurveyPrompt | null = null;

/** Listeners for survey state changes */
const surveyListeners: Array<(prompt: SurveyPrompt | null) => void> = [];

// ── Core Functions ────────────────────────────────────────────────────────

/**
 * Check if a survey should be shown for a skill after it's been deactivated.
 *
 * @param skill - The skill that was just deactivated
 * @returns SurveyPrompt if survey should be shown, null otherwise
 */
export function checkShouldShowSurvey(skill: LoadedSkill): SurveyPrompt {
  // Load usage data
  const usageRecords = loadUsageRecords();
  const usage = usageRecords[skill.name];

  if (!usage || usage.usageCount < MIN_USES_BEFORE_SURVEY) {
    return {
      skillName: skill.name,
      useCount: usage?.usageCount ?? 0,
      shouldShow: false,
      reason: `Need at least ${MIN_USES_BEFORE_SURVEY} uses (current: ${usage?.usageCount ?? 0})`,
    };
  }

  // Check if user already submitted a recent survey for this skill
  const surveys = loadSurveys();
  const recentSurvey = surveys.find(
    s => s.skillName === skill.name &&
    Date.now() - s.timestamp < SURVEY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  if (recentSurvey) {
    return {
      skillName: skill.name,
      useCount: usage.usageCount,
      shouldShow: false,
      reason: 'Already surveyed recently',
    };
  }

  // Random sampling to avoid survey fatigue
  if (Math.random() > SURVEY_PROBABILITY) {
    return {
      skillName: skill.name,
      useCount: usage.usageCount,
      shouldShow: false,
      reason: 'Random sampling skipped',
    };
  }

  return {
    skillName: skill.name,
    useCount: usage.usageCount,
    shouldShow: true,
  };
}

/**
 * Submit a survey response.
 *
 * @param survey - The completed survey
 */
export function submitSurvey(survey: SkillSurvey): void {
  const surveys = loadSurveys();
  surveys.push(survey);
  saveSurveys(surveys);

  // Clear pending survey
  pendingSurvey = null;
  notifyListeners();

  console.log(`[SkillSurvey] Submitted survey for "${survey.skillName}": rating=${survey.rating}, helpful=${survey.helpful}`);
}

/**
 * Dismiss the current survey prompt without submitting.
 */
export function dismissSurvey(): void {
  pendingSurvey = null;
  notifyListeners();
}

/**
 * Show a survey prompt for a skill.
 * Called when a skill is deactivated and survey conditions are met.
 */
export function promptSurvey(skill: LoadedSkill): void {
  const prompt = checkShouldShowSurvey(skill);

  if (prompt.shouldShow) {
    pendingSurvey = prompt;
    notifyListeners();
  }
}

/**
 * Get the current pending survey prompt.
 */
export function getPendingSurvey(): SurveyPrompt | null {
  return pendingSurvey;
}

/**
 * Subscribe to survey state changes.
 * Returns an unsubscribe function.
 */
export function onSurveyChange(listener: (prompt: SurveyPrompt | null) => void): () => void {
  surveyListeners.push(listener);
  return () => {
    const index = surveyListeners.indexOf(listener);
    if (index >= 0) surveyListeners.splice(index, 1);
  };
}

// ── Survey Analytics ──────────────────────────────────────────────────────

/**
 * Get aggregated survey statistics for a skill.
 */
export function getSkillSurveyStats(skillName: string): {
  totalSurveys: number;
  averageRating: number;
  helpfulPercentage: number;
  accuratePercentage: number;
  recommendPercentage: number;
} {
  const surveys = loadSurveys().filter(s => s.skillName === skillName);

  if (surveys.length === 0) {
    return {
      totalSurveys: 0,
      averageRating: 0,
      helpfulPercentage: 0,
      accuratePercentage: 0,
      recommendPercentage: 0,
    };
  }

  const totalRating = surveys.reduce((sum, s) => sum + s.rating, 0);
  const helpfulCount = surveys.filter(s => s.helpful).length;
  const accurateCount = surveys.filter(s => s.accurate).length;
  const recommendCount = surveys.filter(s => s.wouldRecommend).length;

  return {
    totalSurveys: surveys.length,
    averageRating: totalRating / surveys.length,
    helpfulPercentage: (helpfulCount / surveys.length) * 100,
    accuratePercentage: (accurateCount / surveys.length) * 100,
    recommendPercentage: (recommendCount / surveys.length) * 100,
  };
}

/**
 * Get improvement suggestions from surveys for a skill.
 */
export function getSkillImprovements(skillName: string): string[] {
  const surveys = loadSurveys().filter(
    s => s.skillName === skillName && s.improvement && s.improvement.trim()
  );
  return surveys.map(s => s.improvement!).filter(Boolean);
}

// ── Internal Helpers ──────────────────────────────────────────────────────

function notifyListeners(): void {
  for (const listener of surveyListeners) {
    listener(pendingSurvey);
  }
}

function loadSurveys(): SkillSurvey[] {
  try {
    const raw = localStorage.getItem(SURVEY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSurveys(surveys: SkillSurvey[]): void {
  try {
    // Prune old surveys
    const cutoff = Date.now() - SURVEY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const pruned = surveys.filter(s => s.timestamp > cutoff);
    localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(pruned));
  } catch (error) {
    console.error('[SkillSurvey] Failed to save surveys:', error);
  }
}

function loadUsageRecords(): Record<string, { usageCount: number; lastUsedAt: number }> {
  try {
    const raw = localStorage.getItem('pyide_skill_usage');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
