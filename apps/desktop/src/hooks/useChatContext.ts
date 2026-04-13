/**
 * useChatContext Hook
 * Manages ChatEngine context (skills, memories, kernel state)
 */

import { useEffect } from 'react';
import { useSkillStore } from '../services/SkillService';
import { MemoryStorage } from '../services/MemoryService/storage';
import { mcpChatIntegration } from '../services/MCPService/chatIntegration';
import { useKernelStore } from '../stores/kernelStore';
import { usePlatform } from '@pyide/platform';

interface UseChatContextProps {
  chatEngine?: any;  // ChatEngine instance
  projectId?: string;
}

export function useChatContext({ chatEngine, projectId }: UseChatContextProps) {
  const { getActiveSkillContent } = useSkillStore();
  const { variables } = useKernelStore();
  const platform = usePlatform();
  
  useEffect(() => {
    if (!chatEngine) return;
    
    updateContext();
  }, [chatEngine, projectId]);
  
  async function updateContext() {
    if (!chatEngine) return;
    
    try {
      // Get active skills content
      const activeSkills = getActiveSkillContent();
      
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
      
      // Get MCP tools
      const mcpTools = await mcpChatIntegration.getAvailableToolsForAI();
      
      // Get kernel state summary
      const kernelState = variables.length > 0
        ? `Active variables: ${variables.map(v => `${v.name} (${v.type})`).join(', ')}`
        : '';
      
      // Update ChatEngine context
      chatEngine.setContext({
        activeSkills: activeSkills || undefined,
        memories: memories || undefined,
        mcpTools: mcpTools || undefined,
        kernelState: kernelState || undefined
      });
      
    } catch (error) {
      console.error('Failed to update chat context:', error);
    }
  }
  
  return { updateContext };
}
