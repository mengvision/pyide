import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useKernel } from '../hooks/useKernel';
import { useUiStore } from '../stores/uiStore';
import { useKernelStore } from '../stores/kernelStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ChatEngine } from '../services/ChatEngine';
import { useChatContext } from '../hooks/useChatContext';
import { usePlatform } from '@pyide/platform';
import { saveHistory, loadHistory } from '../services/replHistoryService';

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
  const platform = usePlatform();
  
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

  // Load REPL history on mount
  useEffect(() => {
    const wp = useUiStore.getState().workspacePath;
    if (wp) {
      loadHistory(platform, wp)
        .then((history) => {
          if (history.length > 0) {
            useKernelStore.getState().setReplHistory(history);
          }
        })
        .catch((err) => {
          console.warn('[KernelProvider] Failed to load REPL history:', err);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save REPL history with 2-second debounce on changes
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let prevReplHistoryLength = useKernelStore.getState().replHistory.length;
    let prevOutputCount = useKernelStore
      .getState()
      .replHistory.reduce((s, e) => s + e.outputs.length, 0);

    const unsubscribe = useKernelStore.subscribe((state) => {
      const currentLength = state.replHistory.length;
      const currentOutputCount = state.replHistory.reduce((s, e) => s + e.outputs.length, 0);

      // Only react when history actually changed
      if (
        currentLength === prevReplHistoryLength &&
        currentOutputCount === prevOutputCount
      ) {
        return;
      }
      prevReplHistoryLength = currentLength;
      prevOutputCount = currentOutputCount;

      const wp = useUiStore.getState().workspacePath;
      if (!wp || currentLength === 0) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        saveHistory(platform, wp, state.replHistory).catch((err) => {
          console.warn('[KernelProvider] Failed to save REPL history:', err);
        });
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-start kernel on mount
  useEffect(() => {
    // For local mode: start immediately
    // For remote mode: only start if authenticated (handled by App.tsx)
    if (kernelMode === 'local') {
      // Add a small delay to ensure Tauri backend is fully initialized
      // This prevents race conditions where kernel.start() is called before
      // the Rust commands are ready to handle them
      const startupTimer = setTimeout(() => {
        kernel.startKernel().catch((err) => {
          console.error('[KernelProvider] Failed to auto-start kernel:', err);
          // If auto-start fails, clear any stale state so next attempt works
          kernel.stopKernel().catch(() => {
            // Ignore cleanup errors
          });
        });
      }, 500); // 500ms delay
      
      return () => {
        clearTimeout(startupTimer);
        kernel.stopKernel();
      };
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
