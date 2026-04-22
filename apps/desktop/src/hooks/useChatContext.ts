/**
 * useChatContext Hook
 * Manages ChatEngine context (skills, memories, kernel state)
 *
 * IMPORTANT: Uses stable selectors to prevent infinite re-render loops.
 * - `activeSkills` (string[]) changes only when skill activation changes
 * - `skills` array reference must NOT be used directly in useEffect deps
 */

import { useEffect, useRef } from 'react';
import { useSkillStore } from '../services/SkillService';
import { buildSkillToolPrompt } from '../services/SkillService/skillTool';
import { MemoryStorage } from '../services/MemoryService/storage';
import { mcpChatIntegration } from '../services/MCPService/chatIntegration';
import { useKernelStore } from '../stores/kernelStore';
import { usePlatform } from '@pyide/platform';

interface UseChatContextProps {
  chatEngine?: any;  // ChatEngine instance
  projectId?: string;
}

export function useChatContext({ chatEngine, projectId }: UseChatContextProps) {
  const platform = usePlatform();

  // Use STABLE selectors — only re-render when these specific values change
  const activeSkillIds = useSkillStore(state => state.activeSkills);
  const skillNames = useSkillStore(state => state.skills.map(s => s.name).join(','));
  const variables = useKernelStore(state => state.variables);

  // Ref to throttle context updates (prevent rapid-fire async updates)
  const lastUpdateRef = useRef(0);
  const UPDATE_THROTTLE_MS = 500;

  useEffect(() => {
    if (!chatEngine) return;
    updateContext();
  }, [chatEngine, projectId, activeSkillIds, skillNames, variables, platform]);

  async function updateContext() {
    if (!chatEngine) return;

    // Throttle: skip if last update was < 500ms ago
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) {
      return;
    }
    lastUpdateRef.current = now;

    try {
      // Get store state directly (not via selector) to avoid dependency issues
      const storeState = useSkillStore.getState();
      const activeSkills = storeState.getActiveSkillContent();
      const skills = storeState.skills;

      // Build skill listing for AI discovery (budget-aware)
      const skillListing = buildSkillToolPrompt(skills);

      // Load memories
      let memories = '';
      if (projectId) {
        const storage = new MemoryStorage(platform);
        const projectMemories = await storage.loadProjectMemory(projectId);
        const userMemories = await storage.loadUserMemory();

        const memoryParts: string[] = [];

        if (projectMemories.length > 0) {
          memoryParts.push('Project Memories:');
          projectMemories.forEach(m => {
            memoryParts.push(`- [${m.type}] ${m.content}`);
          });
        }

        const userPrefs = userMemories.filter(m => m.type === 'user');
        if (userPrefs.length > 0) {
          memoryParts.push('\nUser Preferences:');
          userPrefs.forEach(m => {
            memoryParts.push(`- ${m.content}`);
          });
        }

        memories = memoryParts.join('\n');
      }

      // Get MCP tools (with skill-based filtering)
      const allowedTools = storeState.getActiveAllowedTools();
      const mcpTools = await mcpChatIntegration.getAvailableToolsForAI(allowedTools);

      // Get kernel state summary
      const kernelState = variables.length > 0
        ? `Active variables: ${variables.map(v => `${v.name} (${v.type})`).join(', ')}`
        : '';

      // Update ChatEngine context
      chatEngine.setContext({
        skillListing: skillListing || undefined,
        activeSkills: activeSkills || undefined,
        memories: memories || undefined,
        mcpTools: mcpTools || undefined,
        kernelState: kernelState || undefined,
      });

    } catch (error) {
      console.error('Failed to update chat context:', error);
    }
  }

  return { updateContext };
}
