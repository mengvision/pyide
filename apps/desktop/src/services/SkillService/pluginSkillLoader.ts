/**
 * Plugin & Managed Skill Loader
 *
 * Extends PyIDE's skill system with two additional skill sources:
 *
 * 1. Plugin Skills — Loaded from installed plugins (extensions).
 *    Plugins can contribute skills by declaring them in their manifest.
 *    Location: Each plugin's `skills/` directory or declared via API.
 *
 * 2. Managed Skills — Centrally managed by an organization admin.
 *    These are skills that are pushed to all users via a managed config.
 *    Location: ~/.pyide/skills/managed/
 *
 * Both sources follow the same SKILL.md format as other disk-based skills,
 * but have distinct source labels for UI differentiation and access control.
 *
 * Following Claude Code's loadSkillsDir pattern for multi-source loading.
 */

import type { LoadedSkill } from '../../types/skill';
import { parseSkillFrontmatter } from '../../utils/skillParser';
import { buildArgumentHint } from '../../utils/argumentSubstitution';
import type { SkillArg } from '../../types/skill';
import type { PlatformService } from '@pyide/platform';

// ── Plugin Skill Manifest ─────────────────────────────────────────────────

/** Plugin manifest structure for skill declarations */
export interface PluginManifest {
  /** Plugin identifier */
  id: string;
  /** Plugin display name */
  name: string;
  /** Plugin version */
  version: string;
  /** Skills contributed by this plugin */
  skills?: PluginSkillDeclaration[];
}

/** Skill declaration within a plugin manifest */
export interface PluginSkillDeclaration {
  /** Skill name (must be unique across all sources) */
  name: string;
  /** Relative path to the skill's SKILL.md file within the plugin */
  path: string;
  /** Optional: inline skill content (alternative to path) */
  content?: string;
}

// ── Plugin Skill Registry ─────────────────────────────────────────────────

/** In-memory registry of loaded plugins and their skills */
const pluginRegistry: Map<string, PluginManifest> = new Map();

/**
 * Register a plugin and its declared skills.
 * Called when a plugin is loaded/enabled.
 *
 * @param manifest - The plugin manifest
 */
export function registerPlugin(manifest: PluginManifest): void {
  pluginRegistry.set(manifest.id, manifest);
  console.log(`[PluginSkills] Registered plugin "${manifest.name}" (${manifest.id}) with ${manifest.skills?.length ?? 0} skills`);
}

/**
 * Unregister a plugin and its skills.
 * Called when a plugin is disabled/uninstalled.
 *
 * @param pluginId - The plugin identifier to remove
 */
export function unregisterPlugin(pluginId: string): void {
  pluginRegistry.delete(pluginId);
  console.log(`[PluginSkills] Unregistered plugin: ${pluginId}`);
}

/**
 * Load all skills from registered plugins.
 * Skills are loaded from their declared paths or inline content.
 *
 * @param platform - Platform service for file operations
 * @returns Array of LoadedSkill from all registered plugins
 */
export async function loadPluginSkills(platform: PlatformService): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = [];

  for (const [pluginId, manifest] of pluginRegistry) {
    if (!manifest.skills || manifest.skills.length === 0) continue;

    for (const declaration of manifest.skills) {
      try {
        let content: string;

        if (declaration.content) {
          // Inline content from manifest
          content = declaration.content;
        } else if (declaration.path) {
          // Load from file path
          try {
            content = await platform.file.read(declaration.path);
          } catch {
            console.warn(`[PluginSkills] Failed to read skill file: ${declaration.path}`);
            continue;
          }
        } else {
          console.warn(`[PluginSkills] Skill "${declaration.name}" has no content or path`);
          continue;
        }

        const skill = buildSkillFromContent(
          content,
          declaration.name,
          `plugin-${pluginId}-${declaration.name}`,
          'plugin',
          declaration.path || `plugin://${pluginId}/${declaration.name}`,
        );

        skills.push(skill);
      } catch (error) {
        console.warn(`[PluginSkills] Failed to load skill "${declaration.name}" from plugin "${manifest.name}":`, error);
      }
    }
  }

  return skills;
}

// ── Managed Skills ────────────────────────────────────────────────────────

/**
 * Load managed skills from ~/.pyide/skills/managed/.
 * Managed skills are organization-deployed and cannot be edited by users.
 *
 * @param platform - Platform service for file operations
 * @returns Array of LoadedSkill from managed source
 */
export async function loadManagedSkills(platform: PlatformService): Promise<LoadedSkill[]> {
  const homeDir = await platform.file.getHomeDir();
  const managedDir = `${homeDir}/.pyide/skills/managed`;

  try {
    // Scan the managed directory for skill files
    const rawSkills = await (platform.skills as any).scanUserSkills?.(managedDir);
    if (!rawSkills || !Array.isArray(rawSkills)) return [];

    return rawSkills.map((skill: any, idx: number) =>
      buildSkillFromContent(
        skill.content,
        skill.name,
        `managed-${skill.name}`,
        'managed',
        skill.path,
      ),
    );
  } catch {
    // Managed directory may not exist — that's fine
    return [];
  }
}

// ── Shared Helper ─────────────────────────────────────────────────────────

/**
 * Build a LoadedSkill from raw markdown content.
 * Shared between plugin and managed skill loaders.
 */
function buildSkillFromContent(
  content: string,
  name: string,
  id: string,
  source: 'plugin' | 'managed',
  directory: string,
): LoadedSkill {
  const parsed = parseSkillFrontmatter(content);

  // Normalize arguments
  let args: SkillArg[] | undefined;
  if (parsed.frontmatter.arguments) {
    if (Array.isArray(parsed.frontmatter.arguments)) {
      args = parsed.frontmatter.arguments;
    } else if (typeof parsed.frontmatter.arguments === 'string') {
      args = parsed.frontmatter.arguments
        .split(/\s+/)
        .filter(Boolean)
        .map(argName => ({ name: argName, type: 'string' as const }));
    }
  }

  return {
    name: parsed.frontmatter.name || name,
    description: parsed.frontmatter.description || 'Custom skill',
    content,
    allowedTools: parsed.frontmatter.allowed_tools || [],
    argumentHint: parsed.frontmatter.argument_hint ?? (args ? buildArgumentHint(args) : undefined),
    args,
    whenToUse: parsed.frontmatter.when_to_use,
    paths: parsed.frontmatter.paths,
    context: parsed.frontmatter.context,
    hooks: parsed.frontmatter.hooks,
    files: parsed.frontmatter.files,
    model: parsed.frontmatter.model,
    triggers: parsed.frontmatter.triggers,
    source,
    directory,
    id,
    isActive: false,
  };
}

/**
 * Get all registered plugin manifests (for UI display).
 */
export function getRegisteredPlugins(): PluginManifest[] {
  return Array.from(pluginRegistry.values());
}

/**
 * Check if a plugin is registered.
 */
export function isPluginRegistered(pluginId: string): boolean {
  return pluginRegistry.has(pluginId);
}
