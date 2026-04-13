/**
 * Skill Service - Central skill management using Zustand
 */

import { create } from 'zustand';
import type { LoadedSkill } from '../../types/skill';
import { getBundledSkills } from './bundledSkills';
import type { PlatformService } from '@pyide/platform';
import { parseSkillFrontmatter } from '../../utils/skillParser';
import { downloadSkill, getSkillDetails } from './clawhub';
import { addToLockFile, removeFromLockFile, setLockFilePlatform } from './lockfile';

// Platform instance injected at app startup via initSkillPlatform()
let _platform: PlatformService | null = null;

/** Call once at app startup to inject the platform into the skill store. */
export function initSkillPlatform(platform: PlatformService) {
  _platform = platform;
  setLockFilePlatform(platform);
}

interface SkillStore {
  skills: LoadedSkill[];
  activeSkills: string[];  // Skill IDs currently active
  loadSkills: () => Promise<void>;
  activateSkill: (skillId: string) => void;
  deactivateSkill: (skillId: string) => void;
  toggleSkill: (skillId: string) => void;
  getActiveSkillContent: () => string;
  isSkillActive: (skillId: string) => boolean;
  installFromClawHub: (skillName: string) => Promise<boolean>;
  uninstallClawHubSkill: (skillName: string) => Promise<boolean>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  activeSkills: [],
  
  async loadSkills() {
    try {
      // Load bundled skills
      const bundled = getBundledSkills().map((skill, idx) => ({
        ...skill,
        id: `bundled-${skill.name}`,
        isActive: false
      }));
      
      // Load disk-based skills via platform
      let diskSkills: LoadedSkill[] = [];
      let homeDir = '';
      try {
        if (!_platform) throw new Error('Platform not initialized');
        homeDir = await _platform.file.getHomeDir();
        const rawSkills = await _platform.skills.scanUserSkills(homeDir) as any[];
        
        diskSkills = rawSkills.map((skill, idx) => {
          const parsed = parseSkillFrontmatter(skill.content);
          return {
            name: parsed.frontmatter.name || skill.name,
            description: parsed.frontmatter.description || 'User skill',
            content: skill.content,
            allowedTools: parsed.frontmatter.allowed_tools || [],
            argumentHint: parsed.frontmatter.argument_hint,
            whenToUse: parsed.frontmatter.when_to_use,
            paths: parsed.frontmatter.paths,
            source: 'disk' as const,
            directory: skill.path,
            id: `disk-${idx}`,
            isActive: false
          };
        });
      } catch (error) {
        console.warn('Failed to load disk skills:', error);
      }
      
      // Load ClawHub-installed skills from .pyide/skills/ (flat .md files)
      let clawHubSkills: LoadedSkill[] = [];
      try {
        if (!_platform || !homeDir) throw new Error('Platform not initialized');
        const clawHubRaw = await _platform.skills.scanClawHubSkills(homeDir) as any[];
        clawHubSkills = clawHubRaw.map((skill, idx) => {
          const parsed = parseSkillFrontmatter(skill.content);
          return {
            name: parsed.frontmatter.name || skill.name,
            description: parsed.frontmatter.description || 'ClawHub skill',
            content: skill.content,
            allowedTools: parsed.frontmatter.allowed_tools || [],
            argumentHint: parsed.frontmatter.argument_hint,
            whenToUse: parsed.frontmatter.when_to_use,
            paths: parsed.frontmatter.paths,
            source: 'clawhub' as const,
            directory: skill.path,
            id: `clawhub-${skill.name}`,
            isActive: false
          };
        });
      } catch {
        // clawhub dir may not exist yet — that's fine
      }

      set({ skills: [...bundled, ...diskSkills, ...clawHubSkills] });
    } catch (error) {
      console.error('Failed to load skills:', error);
      // Fallback to bundled skills only
      const bundled = getBundledSkills().map((skill, idx) => ({
        ...skill,
        id: `bundled-${skill.name}`,
        isActive: false
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
        )
      };
    });
  },
  
  deactivateSkill(skillId) {
    set(state => ({
      activeSkills: state.activeSkills.filter(id => id !== skillId),
      skills: state.skills.map(s => 
        s.id === skillId ? { ...s, isActive: false } : s
      )
    }));
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
  
  isSkillActive(skillId) {
    return get().activeSkills.includes(skillId);
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
}));
