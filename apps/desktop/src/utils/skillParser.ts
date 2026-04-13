/**
 * Skill Frontmatter Parser
 * Parses YAML frontmatter from SKILL.md files
 */

import yaml from 'js-yaml';
import type { SkillFrontmatter } from '../types/skill';

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  markdownContent: string;
}

/**
 * Parse YAML frontmatter and markdown content from a SKILL.md file
 */
export function parseSkillFrontmatter(content: string): ParsedSkill {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    // No frontmatter found, treat entire content as markdown
    return {
      frontmatter: {},
      markdownContent: content
    };
  }
  
  try {
    const frontmatter = yaml.load(match[1]) as SkillFrontmatter;
    return {
      frontmatter,
      markdownContent: match[2]
    };
  } catch (error) {
    console.error('Failed to parse skill frontmatter:', error);
    return {
      frontmatter: {},
      markdownContent: content
    };
  }
}

/**
 * Extract description from markdown content (first paragraph)
 */
export function extractDescriptionFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.substring(0, 200); // Limit length
    }
  }
  return 'No description available';
}
