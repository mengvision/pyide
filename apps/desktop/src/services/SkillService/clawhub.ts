/**
 * ClawHub API Client
 * Fetches and downloads skills from the ClawHub external skill registry.
 *
 * API Endpoints:
 *   GET /skills?q=...       — Search skills by query
 *   GET /skills             — List all skills (paginated)
 *   GET /skills/popular     — Popular skills by download count
 *   GET /skills/trending    — Trending skills (recent download growth)
 *   GET /skills/:name       — Get skill metadata
 *   GET /skills/:name/download — Download skill content
 *
 * Fallback: When the API is unavailable, a local built-in index provides
 * a curated set of starter skills that can be installed manually.
 */

const CLAWHUB_API = 'https://clawhub.io/api/v1';

/** Request timeout for ClawHub API calls */
const API_TIMEOUT = 8000;
const DOWNLOAD_TIMEOUT = 15000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClawHubSkill {
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  tags: string[];
  url: string;
}

export interface ClawHubListResult {
  skills: ClawHubSkill[];
  total: number;
  page: number;
  pageSize: number;
}

export type SkillCategory = 'popular' | 'trending' | 'recent' | 'recommended';

// ── Local Built-in Index ───────────────────────────────────────────────────
// Fallback skill catalog used when the ClawHub API is not reachable.
// These represent community-contributed skills that users can install manually.

const LOCAL_INDEX: ClawHubSkill[] = [
  {
    name: 'pandas-expert',
    description: 'Expert pandas data manipulation — DataFrames, Series, groupby, merge, pivot, and time series.',
    version: '1.2.0',
    author: 'clawhub',
    downloads: 4280,
    tags: ['pandas', 'data', 'analysis'],
    url: 'https://clawhub.io/skills/pandas-expert',
  },
  {
    name: 'git-workflow',
    description: 'Git branching strategies, conflict resolution, rebase, and commit conventions.',
    version: '1.1.0',
    author: 'clawhub',
    downloads: 3150,
    tags: ['git', 'version-control', 'workflow'],
    url: 'https://clawhub.io/skills/git-workflow',
  },
  {
    name: 'pytest-pro',
    description: 'Advanced pytest patterns — fixtures, parametrize, markers, plugins, and coverage.',
    version: '1.0.0',
    author: 'clawhub',
    downloads: 2870,
    tags: ['testing', 'pytest', 'quality'],
    url: 'https://clawhub.io/skills/pytest-pro',
  },
  {
    name: 'fastapi-builder',
    description: 'Build FastAPI applications — routes, dependencies, middleware, and OpenAPI docs.',
    version: '1.3.0',
    author: 'clawhub',
    downloads: 2540,
    tags: ['fastapi', 'web', 'api'],
    url: 'https://clawhub.io/skills/fastapi-builder',
  },
  {
    name: 'sql-wizard',
    description: 'SQL query optimization, window functions, CTEs, and database design patterns.',
    version: '1.1.0',
    author: 'clawhub',
    downloads: 2100,
    tags: ['sql', 'database', 'query'],
    url: 'https://clawhub.io/skills/sql-wizard',
  },
  {
    name: 'react-components',
    description: 'React component patterns — hooks, context, HOCs, and performance optimization.',
    version: '1.0.0',
    author: 'clawhub',
    downloads: 1920,
    tags: ['react', 'frontend', 'components'],
    url: 'https://clawhub.io/skills/react-components',
  },
  {
    name: 'docker-compose',
    description: 'Docker Compose orchestration — multi-service setups, networking, volumes, and health checks.',
    version: '1.0.0',
    author: 'clawhub',
    downloads: 1650,
    tags: ['docker', 'devops', 'containers'],
    url: 'https://clawhub.io/skills/docker-compose',
  },
  {
    name: 'data-quality',
    description: 'Data quality checks — validation, profiling, anomaly detection, and schema enforcement.',
    version: '1.2.0',
    author: 'clawhub',
    downloads: 1480,
    tags: ['data', 'quality', 'validation'],
    url: 'https://clawhub.io/skills/data-quality',
  },
];

// ── API Availability Tracking ──────────────────────────────────────────────

let apiAvailable: boolean | null = null;
let lastApiCheck = 0;
const API_CHECK_INTERVAL = 5 * 60 * 1000; // Re-check every 5 minutes

async function isApiAvailable(): Promise<boolean> {
  const now = Date.now();
  if (apiAvailable !== null && now - lastApiCheck < API_CHECK_INTERVAL) {
    return apiAvailable;
  }

  try {
    const response = await fetch(`${CLAWHUB_API}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    apiAvailable = response.ok;
    lastApiCheck = now;
    return apiAvailable;
  } catch {
    apiAvailable = false;
    lastApiCheck = now;
    return false;
  }
}

// ── Core API Functions ─────────────────────────────────────────────────────

/**
 * Search for skills on ClawHub by query string.
 * Falls back to local index when the API is unavailable.
 */
export async function searchSkills(query: string): Promise<ClawHubSkill[]> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(API_TIMEOUT) }
    );
    if (!response.ok) throw new Error(`ClawHub responded with ${response.status}`);
    const data = await response.json();
    apiAvailable = true;
    lastApiCheck = Date.now();
    return Array.isArray(data) ? data : data.skills ?? [];
  } catch (error) {
    console.warn('ClawHub search failed, using local index:', error);
    apiAvailable = false;
    lastApiCheck = Date.now();
    return searchLocalIndex(query);
  }
}

/**
 * List all skills (paginated).
 * Falls back to local index when the API is unavailable.
 */
export async function listSkills(
  page = 1,
  pageSize = 20,
): Promise<ClawHubListResult> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills?page=${page}&pageSize=${pageSize}`,
      { signal: AbortSignal.timeout(API_TIMEOUT) }
    );
    if (!response.ok) throw new Error(`ClawHub responded with ${response.status}`);
    const data = await response.json();
    apiAvailable = true;
    lastApiCheck = Date.now();
    return data;
  } catch (error) {
    console.warn('ClawHub list failed, using local index:', error);
    apiAvailable = false;
    lastApiCheck = Date.now();
    return {
      skills: LOCAL_INDEX,
      total: LOCAL_INDEX.length,
      page: 1,
      pageSize: LOCAL_INDEX.length,
    };
  }
}

/**
 * Get popular skills ranked by download count.
 * Falls back to local index sorted by downloads.
 */
export async function getPopularSkills(limit = 10): Promise<ClawHubSkill[]> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills/popular?limit=${limit}`,
      { signal: AbortSignal.timeout(API_TIMEOUT) }
    );
    if (!response.ok) throw new Error(`ClawHub responded with ${response.status}`);
    const data = await response.json();
    apiAvailable = true;
    lastApiCheck = Date.now();
    return Array.isArray(data) ? data : data.skills ?? [];
  } catch (error) {
    console.warn('ClawHub popular failed, using local index:', error);
    apiAvailable = false;
    lastApiCheck = Date.now();
    return LOCAL_INDEX
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }
}

/**
 * Get trending skills (recent download growth).
 * Falls back to local index (most downloaded as proxy).
 */
export async function getTrendingSkills(limit = 10): Promise<ClawHubSkill[]> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills/trending?limit=${limit}`,
      { signal: AbortSignal.timeout(API_TIMEOUT) }
    );
    if (!response.ok) throw new Error(`ClawHub responded with ${response.status}`);
    const data = await response.json();
    apiAvailable = true;
    lastApiCheck = Date.now();
    return Array.isArray(data) ? data : data.skills ?? [];
  } catch (error) {
    console.warn('ClawHub trending failed, using local index:', error);
    apiAvailable = false;
    lastApiCheck = Date.now();
    // Use most downloaded as trending proxy
    return LOCAL_INDEX
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }
}

/**
 * Fetch detailed metadata for a single skill by name.
 * Returns null when the API is unavailable.
 */
export async function getSkillDetails(name: string): Promise<ClawHubSkill | null> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(API_TIMEOUT) }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Check local index as fallback
    return LOCAL_INDEX.find(s => s.name === name) ?? null;
  }
}

/**
 * Download a skill's Markdown content from ClawHub.
 * Returns null when the API is unavailable.
 */
export async function downloadSkill(name: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills/${encodeURIComponent(name)}/download`,
      { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) }
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Check if the ClawHub API is currently reachable.
 */
export function isClawHubAvailable(): boolean | null {
  return apiAvailable;
}

/**
 * Get the local built-in skill index.
 * Useful for showing skills in the UI even when offline.
 */
export function getLocalIndex(): ClawHubSkill[] {
  return [...LOCAL_INDEX];
}

// ── Internal Helpers ───────────────────────────────────────────────────────

/** Search the local index by name, description, and tags. */
function searchLocalIndex(query: string): ClawHubSkill[] {
  const q = query.toLowerCase().trim();
  if (!q) return LOCAL_INDEX;

  return LOCAL_INDEX.filter(skill => {
    const nameMatch = skill.name.toLowerCase().includes(q);
    const descMatch = skill.description.toLowerCase().includes(q);
    const tagMatch = skill.tags.some(t => t.toLowerCase().includes(q));
    return nameMatch || descMatch || tagMatch;
  });
}
