import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useKernel } from '../hooks/useKernel';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ChatEngine } from '../services/ChatEngine';
import { useChatContext } from '../hooks/useChatContext';

type KernelContextValue = ReturnType<typeof useKernel> & {
  chatEngine: ChatEngine;
};

const KernelContext = createContext<KernelContextValue | null>(null);

interface KernelProviderProps {
  children: ReactNode;
}

export function KernelProvider({ children }: KernelProviderProps) {
  const kernel = useKernel();
  const kernelMode = useUiStore((s) => s.kernelMode);
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const aiConfig = useSettingsStore((s) => s.aiConfig);
  
  // Create ChatEngine instance (memoized)
  const chatEngineRef = useRef<ChatEngine | null>(null);
  if (!chatEngineRef.current) {
    chatEngineRef.current = new ChatEngine({
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey,
      modelId: aiConfig.modelId,
    });
  }
  
  // Update ChatEngine config when settings change
  useEffect(() => {
    chatEngineRef.current?.updateConfig({
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey,
      modelId: aiConfig.modelId,
    });
  }, [aiConfig.baseUrl, aiConfig.apiKey, aiConfig.modelId]);
  
  // Wire up ChatContext (skills, memory, MCP tools)
  // Use workspace path as project ID for memory loading
  const workspacePath = useUiStore((s) => s.workspacePath);
  const projectId = workspacePath || undefined;
  useChatContext({ chatEngine: chatEngineRef.current, projectId });
  
  // Auto-start kernel on mount
  useEffect(() => {
    // For local mode: start immediately
    // For remote mode: only start if authenticated (handled by App.tsx)
    if (kernelMode === 'local') {
      kernel.startKernel().catch((err) => {
        console.error('[KernelProvider] Failed to auto-start kernel:', err);
      });
    }
    
    return () => {
      kernel.stopKernel();
    };
  }, [kernelMode]); // Re-start if mode changes
  
  const contextValue: KernelContextValue = {
    ...kernel,
    chatEngine: chatEngineRef.current,
  };
  
  return <KernelContext.Provider value={contextValue}>{children}</KernelContext.Provider>;
}

export function useKernelContext(): KernelContextValue {
  const ctx = useContext(KernelContext);
  if (!ctx) {
    throw new Error('useKernelContext must be used within a <KernelProvider>');
  }
  return ctx;
}
