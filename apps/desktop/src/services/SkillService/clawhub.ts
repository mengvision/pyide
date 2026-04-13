/**
 * ClawHub API Client
 * Fetches and downloads skills from the ClawHub external skill registry.
 * NOTE: The ClawHub API doesn't exist yet — all calls degrade gracefully.
 */

const CLAWHUB_API = 'https://clawhub.io/api/v1';

export interface ClawHubSkill {
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  tags: string[];
  url: string;
}

/**
 * Search for skills on ClawHub by query string.
 * Returns an empty array when the API is unavailable.
 */
export async function searchSkills(query: string): Promise<ClawHubSkill[]> {
  try {
    const response = await fetch(
      `${CLAWHUB_API}/skills?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) throw new Error(`ClawHub responded with ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('ClawHub search failed (API may not be live yet):', error);
    return [];
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
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
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
      { signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
