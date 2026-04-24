/**
 * Skill Service - Central skill management using Zustand
 *
 * Load priority: bundled > project > disk (user) > plugin > managed > clawhub > mcp
 * Display order: sorted by usage score (7-day half-life decay)
 */

import { create } from 'zustand';
import type { LoadedSkill, SkillArg } from '../../types/skill';
import { getBundledSkills } from './bundledSkills';
import type { PlatformService } from '@pyide/platform';
import { parseSkillFrontmatter } from '../../utils/skillParser';
import {
  parseArgumentNames,
  substituteArguments,
  buildArgumentHint,
} from '../../utils/argumentSubstitution';
import { downloadSkill, getSkillDetails } from './clawhub';
import { addToLockFile, removeFromLockFile, setLockFilePlatform } from './lockfile';
import { getSkillUsageScore } from './usageTracking';
import { getMCPSkills } from './mcpSkillDiscovery';
import { loadPluginSkills, loadManagedSkills } from './pluginSkillLoader';
import { promptSurvey } from './skillImprovementSurvey';

// Platform instance injected at app startup via initSkillPlatform()
let _platform: PlatformService | null = null;

/** Call once at app startup to inject the platform into the skill store. */
export function initSkillPlatform(platform: PlatformService) {
  _platform = platform;
  setLockFilePlatform(platform);
}

// ── Helper: build LoadedSkill from raw skill data ──────────────────

function buildLoadedSkill(
  raw: { name: string; path: string; content: string },
  source: LoadedSkill['source'],
  id: string,
): LoadedSkill {
  const parsed = parseSkillFrontmatter(raw.content);

  // Normalize arguments: frontmatter → SkillArg[]
  let args: SkillArg[] | undefined;
  if (parsed.frontmatter.arguments) {
    if (Array.isArray(parsed.frontmatter.arguments)) {
      args = parsed.frontmatter.arguments;
    } else if (typeof parsed.frontmatter.arguments === 'string') {
      // "foo bar" → [{ name: "foo", type: "string" }, ...]
      args = parsed.frontmatter.arguments
        .split(/\s+/)
        .filter(Boolean)
        .map(name => ({ name, type: 'string' as const }));
    }
  }

  return {
    name: parsed.frontmatter.name || raw.name,
    description: parsed.frontmatter.description || 'Custom skill',
    content: raw.content,
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
    directory: raw.path,
    id,
    isActive: false,
  };
}

// ── Store interface ────────────────────────────────────────────────

interface SkillStore {
  skills: LoadedSkill[];
  activeSkills: string[];  // Skill IDs currently active
  loadSkills: () => Promise<void>;
  activateSkill: (skillId: string) => void;
  deactivateSkill: (skillId: string) => void;
  toggleSkill: (skillId: string) => void;
  getActiveSkillContent: () => string;
  resolveSkillContent: (skillId: string, args?: string) => string;
  getActiveAllowedTools: () => string[];
  getActiveModelOverride: () => string | undefined;
  isSkillActive: (skillId: string) => boolean;
  getSkillById: (skillId: string) => LoadedSkill | undefined;
  installFromClawHub: (skillName: string) => Promise<boolean>;
  uninstallClawHubSkill: (skillName: string) => Promise<boolean>;
  installFromZip: (file: File) => Promise<{ success: boolean; error?: string; skillName?: string }>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  activeSkills: [],

  async loadSkills() {
    try {
      // 1. Bundled skills (highest priority)
      const bundled = getBundledSkills().map(skill => ({
        ...skill,
        id: `bundled-${skill.name}`,
        isActive: false,
      }));

      // 2. Project skills from [workspace]/.pyide/skills/
      let projectSkills: LoadedSkill[] = [];
      try {
        if (_platform) {
          // Use workspace path from uiStore for project-level skills
          const { useUiStore } = await import('../../stores/uiStore');
          const workspacePath = useUiStore.getState().workspacePath;
          if (workspacePath) {
            const rawProject = await _platform.skills.scanProjectSkills(workspacePath);
            if (rawProject && Array.isArray(rawProject)) {
              projectSkills = rawProject.map((skill) =>
                buildLoadedSkill(skill, 'project', `project-${skill.name}`),
              );
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load project skills:', error);
      }

      // 3. User skills from ~/.pyide/skills/user/
      let diskSkills: LoadedSkill[] = [];
      let homeDir = '';
      try {
        if (!_platform) throw new Error('Platform not initialized');
        homeDir = await _platform.file.getHomeDir();
        const rawSkills = await _platform.skills.scanUserSkills(homeDir) as any[];

        diskSkills = rawSkills.map((skill, idx) =>
          buildLoadedSkill(skill, 'disk', `disk-${idx}`),
        );
      } catch (error) {
        console.warn('Failed to load disk skills:', error);
      }

      // 4. ClawHub-installed skills from ~/.pyide/skills/*.md
      let clawHubSkills: LoadedSkill[] = [];
      try {
        if (!_platform || !homeDir) throw new Error('Platform not initialized');
        const clawHubRaw = await _platform.skills.scanClawHubSkills(homeDir) as any[];
        clawHubSkills = clawHubRaw.map((skill, _idx) =>
          buildLoadedSkill(skill, 'clawhub', `clawhub-${skill.name}`),
        );
      } catch {
        // clawhub dir may not exist yet — that's fine
      }

      // 5. MCP-discovered skills from connected MCP servers
      let mcpSkills: LoadedSkill[] = [];
      try {
        mcpSkills = getMCPSkills();
      } catch {
        // MCP may not be initialized yet
      }

      // 6. Plugin skills from registered plugins
      let pluginSkills: LoadedSkill[] = [];
      try {
        if (_platform) {
          pluginSkills = await loadPluginSkills(_platform);
        }
      } catch {
        // Plugin system may not be initialized
      }

      // 7. Managed skills from ~/.pyide/skills/managed/
      let managedSkills: LoadedSkill[] = [];
      try {
        if (_platform) {
          managedSkills = await loadManagedSkills(_platform);
        }
      } catch {
        // Managed directory may not exist
      }

      // Preserve activation state across reloads + add usage scores
      const prevActive = get().activeSkills;
      const allSkills = [...bundled, ...projectSkills, ...diskSkills, ...clawHubSkills, ...mcpSkills, ...pluginSkills, ...managedSkills];
      const skillsWithState = allSkills.map(s => ({
        ...s,
        isActive: prevActive.includes(s.id),
        usageScore: getSkillUsageScore(s.name),
      }));

      // Sort by usage score (descending) — bundled skills always first
      skillsWithState.sort((a, b) => {
        // Bundled skills always come first
        if (a.source === 'bundled' && b.source !== 'bundled') return -1;
        if (a.source !== 'bundled' && b.source === 'bundled') return 1;
        // Within same source, sort by usage score
        return (b.usageScore ?? 0) - (a.usageScore ?? 0);
      });

      set({ skills: skillsWithState });
    } catch (error) {
      console.error('Failed to load skills:', error);
      // Fallback to bundled skills only
      const bundled = getBundledSkills().map(skill => ({
        ...skill,
        id: `bundled-${skill.name}`,
        isActive: false,
      }));
      set({ skills: bundled });
    }
  },

  activateSkill(skillId) {
    set(state => {
      if (state.activeSkills.includes(skillId)) {
        return state; // Already active
      }
      return {
        activeSkills: [...state.activeSkills, skillId],
        skills: state.skills.map(s =>
          s.id === skillId ? { ...s, isActive: true, lastUsed: new Date() } : s
        ),
      };
    });
  },

  deactivateSkill(skillId) {
    const skill = get().skills.find(s => s.id === skillId);
    set(state => ({
      activeSkills: state.activeSkills.filter(id => id !== skillId),
      skills: state.skills.map(s =>
        s.id === skillId ? { ...s, isActive: false } : s
      ),
    }));
    // Prompt for improvement survey after deactivation
    if (skill) {
      try { promptSurvey(skill); } catch { /* non-critical */ }
    }
  },

  toggleSkill(skillId) {
    const { isSkillActive, activateSkill, deactivateSkill } = get();
    if (isSkillActive(skillId)) {
      deactivateSkill(skillId);
    } else {
      activateSkill(skillId);
    }
  },

  getActiveSkillContent() {
    const { skills, activeSkills } = get();
    const activeSkillContents = skills
      .filter(s => activeSkills.includes(s.id))
      .map(s => `## Skill: ${s.name}\n\n${s.content}`);

    if (activeSkillContents.length === 0) {
      return '';
    }

    return '\n\n---\n\n' + activeSkillContents.join('\n\n---\n\n');
  },

  /**
   * Resolve skill content with argument substitution.
   * Replaces $ARGUMENTS, $0, $name etc. with actual values.
   */
  resolveSkillContent(skillId: string, args?: string): string {
    const skill = get().skills.find(s => s.id === skillId);
    if (!skill) return '';

    const argNames = skill.args
      ? skill.args.map(a => a.name)
      : parseArgumentNames(skill.argumentHint);

    const markdownContent = parseSkillFrontmatter(skill.content).markdownContent;
    return substituteArguments(markdownContent, args, true, argNames);
  },

  /**
   * Get the union of allowedTools from all active skills.
   * Returns empty array if no skills restrict tools (i.e., all tools allowed).
   */
  getActiveAllowedTools(): string[] {
    const { skills, activeSkills } = get();
    const active = skills.filter(s => activeSkills.includes(s.id));
    const toolSets = active.filter(s => s.allowedTools && s.allowedTools.length > 0);

    // If no active skill declares allowedTools, don't restrict
    if (toolSets.length === 0) return [];

    // Return union of all declared tool sets
    const union = new Set<string>();
    toolSets.forEach(s => s.allowedTools.forEach(t => union.add(t)));
    return [...union];
  },

  /**
   * Resolve the model to use based on the three-level priority:
   *   skill_override > user_override > default_config
   * Returns undefined if no skill override is active (use default).
   */
  getActiveModelOverride(): string | undefined {
    const { skills, activeSkills } = get();
    const active = skills.filter(s => activeSkills.includes(s.id) && s.model);
    // First active skill with a model override wins (sorted by priority)
    return active.length > 0 ? active[0].model : undefined;
  },

  isSkillActive(skillId) {
    return get().activeSkills.includes(skillId);
  },

  getSkillById(skillId) {
    return get().skills.find(s => s.id === skillId);
  },

  async installFromClawHub(skillName: string): Promise<boolean> {
    try {
      if (!_platform) throw new Error('Platform not initialized');

      // 1. Try to fetch metadata (best-effort)
      const meta = await getSkillDetails(skillName);

      // 2. Download skill content
      const content = await downloadSkill(skillName);
      if (!content) {
        console.error(`ClawHub: failed to download skill "${skillName}". API may not be live.`);
        return false;
      }

      // 3. Save to ~/.pyide/skills/{name}.md
      const homeDir = await _platform.file.getHomeDir();
      const skillPath = `${homeDir}/.pyide/skills/${skillName}.md`;
      await _platform.file.write(skillPath, content);

      // 4. Record in lock file
      await addToLockFile({
        name: skillName,
        version: meta?.version ?? '0.0.0',
        source: 'clawhub',
        url: meta?.url ?? `https://clawhub.io/skills/${skillName}`,
        integrity: '',
        installed_at: new Date().toISOString(),
      });

      // 5. Reload skill list
      await get().loadSkills();
      return true;
    } catch (error) {
      console.error('installFromClawHub error:', error);
      return false;
    }
  },

  async uninstallClawHubSkill(skillName: string): Promise<boolean> {
    try {
      if (!_platform) throw new Error('Platform not initialized');
      const homeDir = await _platform.file.getHomeDir();
      const skillPath = `${homeDir}/.pyide/skills/${skillName}.md`;
      await _platform.file.delete(skillPath);
      await removeFromLockFile(skillName);
      await get().loadSkills();
      return true;
    } catch (error) {
      console.error('uninstallClawHubSkill error:', error);
      return false;
    }
  },

  async installFromZip(file: File): Promise<{ success: boolean; error?: string; skillName?: string }> {
    try {
      if (!_platform) throw new Error('Platform not initialized');

      const buffer = await file.arrayBuffer();
      const zipBytes = Array.from(new Uint8Array(buffer));
      const homeDir = await _platform.file.getHomeDir();

      const result = await _platform.skills.installFromZip(homeDir, zipBytes, file.name);

      // Reload skill list to pick up the new skill
      await get().loadSkills();

      return { success: true, skillName: result.skillName };
    } catch (error) {
      console.error('installFromZip error:', error);
      return { success: false, error: (error as Error).message };
    }
  },
}));
