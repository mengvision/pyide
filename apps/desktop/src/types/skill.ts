/**
 * Skill System Type Definitions
 */

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;  // Markdown content
  allowedTools: string[];
  argumentHint?: string;
  whenToUse?: string;
  paths?: string[];  // Conditional activation patterns
  source: 'bundled' | 'disk' | 'clawhub';
  directory: string;
}

export interface LoadedSkill extends SkillDefinition {
  id: string;
  isActive: boolean;
  lastUsed?: Date;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  allowed_tools?: string[];
  argument_hint?: string;
  when_to_use?: string;
  paths?: string[];
}
