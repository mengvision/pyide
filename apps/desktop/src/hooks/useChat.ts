import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useKernelStore } from '../stores/kernelStore';
import { useKernelContext } from '../contexts/KernelContext';
import { ChatEngine } from '../services/ChatEngine';
import { buildSystemPrompt } from '../services/chatContext';
import { mcpChatIntegration } from '../services/MCPService/chatIntegration';
import { agentManager } from '../services/AgentManager';
import type { ToolCall } from '../utils/toolCallParser';

/** Callback used by the ToolConfirmDialog to ask the user before running a tool */
export type ToolConfirmCallback = (call: ToolCall) => Promise<boolean>;

/**
 * Maximum number of tool-calling rounds to prevent infinite loops.
 * Each round = AI responds → tools parsed & executed → results injected → AI re-invoked.
 */
const MAX_TOOL_ROUNDS = 5;

export function useChat(onConfirm?: ToolConfirmCallback) {
  const chatStore = useChatStore();
  const chatMode = useChatStore((s) => s.chatMode);
  const setChatMode = useChatStore((s) => s.setChatMode);
  const aiConfig = useSettingsStore((s) => s.aiConfig);
  const variables = useKernelStore((s) => s.variables);
  const connectionStatus = useKernelStore((s) => s.connectionStatus);

  // Try to get ChatEngine from context (preferred), otherwise create local instance
  let contextChatEngine: ChatEngine | null = null;
  try {
    const kernelContext = useKernelContext();
    contextChatEngine = kernelContext.chatEngine;
  } catch {
    // Not within KernelProvider - will create local instance
  }

  const engineRef = useRef<ChatEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Sync AgentManager → store ──────────────────────────────────────────
  useEffect(() => {
    // Register Memory Extractor as a background agent
    agentManager.registerBackground('memory-extractor', 'Memory Extractor');

    // Initial sync
    chatStore.updateAgents(agentManager.getAllAgents());
    chatStore.updateTokenUsage(agentManager.getTotalUsage());

    // Subscribe to future changes
    const unsub = agentManager.subscribe(() => {
      chatStore.updateAgents(agentManager.getAllAgents());
      chatStore.updateTokenUsage(agentManager.getTotalUsage());
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initialize / update ChatEngine when config changes ────────────────
  // Prefer context engine; fall back to local instance
  useEffect(() => {
    const { baseUrl, apiKey, modelId } = aiConfig;
    if (baseUrl && apiKey && modelId) {
      // If we have a context engine, use it
      if (contextChatEngine) {
        engineRef.current = contextChatEngine;
        return;
      }
      
      // Otherwise create/update local instance
      if (engineRef.current) {
        engineRef.current.updateConfig({ baseUrl, apiKey, modelId });
      } else {
        engineRef.current = new ChatEngine({ baseUrl, apiKey, modelId });
      }
    }
  }, [aiConfig, contextChatEngine]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!engineRef.current) return;

      // Add user message to store
      chatStore.addMessage({ role: 'user', content });

      // Snapshot messages before adding the assistant placeholder
      const history = useChatStore.getState().messages;

      // Build messages array: system prompt + history + current user message
      const systemPrompt = buildSystemPrompt({ variables, connectionStatus });

      // Append MCP tools description if in Assist or Agent mode
      let mcpToolsContext = '';
      if (chatMode === 'assist' || chatMode === 'agent') {
        mcpToolsContext = await mcpChatIntegration.getAvailableToolsForAI();
      }

      const baseMessages = [
        {
          role: 'system' as const,
          content: systemPrompt + mcpToolsContext,
        },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ];

      // Add empty assistant message for streaming
      chatStore.addMessage({ role: 'assistant', content: '' });
      chatStore.setStreaming(true);

      abortRef.current = new AbortController();

      const engine = engineRef.current;
      const signal = abortRef.current.signal;

      // ── Tool-calling loop ──────────────────────────────────────────────────
      // conversationMessages grows with each tool round.
      let conversationMessages = [...baseMessages];
      let round = 0;

      const runRound = async (): Promise<void> => {
        round++;

        let fullContent = '';

        await engine.sendMessage(
          // Strip the leading system message — sendMessage builds its own
          // system prompt via buildSystemPrompt. We pass the whole messages
          // array here (the engine prepends a fresh system msg internally),
          // so we pass WITHOUT the system msg at index 0 to avoid duplication.
          conversationMessages.slice(1),
          (token) => {
            fullContent += token;
            chatStore.updateLastAssistantMessage(fullContent);
          },
          async (complete) => {
            // Cost accounting — also update AgentManager
            const inputText = conversationMessages.map((m) => m.content).join('');
            const inputTokens = engine.estimateTokens(inputText);
            const outputTokens = engine.estimateTokens(complete);
            chatStore.addCost(engine.estimateCost(inputTokens, outputTokens));
            agentManager.trackUsage('main', inputTokens, outputTokens);
          },
          (error) => {
            chatStore.updateLastAssistantMessage(`⚠️ Error: ${error.message}`);
            chatStore.setStreaming(false);
          },
          signal,
          // Pass the system content as baseSystemPrompt so the engine injects it
          conversationMessages[0].content,
        );

        if (signal.aborted) return;

        // Parse tool calls from AI response (only in Assist/Agent modes)
        if ((chatMode === 'assist' || chatMode === 'agent') && round < MAX_TOOL_ROUNDS) {
          const { hasToolCalls, toolResults, cleanResponse } =
            await mcpChatIntegration.processToolCycle(fullContent, chatMode, onConfirm);

          if (hasToolCalls && toolResults) {
            // Update the displayed AI message with the clean version (no raw [TOOL_CALL:...])
            if (cleanResponse !== undefined) {
              chatStore.updateLastAssistantMessage(
                cleanResponse || '*(executing tools…)*',
              );
            }

            // Append assistant turn and tool results to conversation
            conversationMessages = [
              ...conversationMessages,
              { role: 'assistant' as const, content: fullContent },
              { role: 'user' as const, content: toolResults },
            ];

            // Add a new streaming placeholder for the next AI turn
            chatStore.addMessage({ role: 'assistant', content: '' });

            // Recurse for the next round
            await runRound();
            return;
          }
        }

        // No more tool calls — we're done
        chatStore.setStreaming(false);
      };

      try {
        await runRound();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          chatStore.updateLastAssistantMessage(
            `⚠️ Error: ${(err as Error).message}`,
          );
        }
        chatStore.setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatStore, variables, connectionStatus, chatMode, onConfirm],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    chatStore.setStreaming(false);
  }, [chatStore]);

  return {
    sendMessage,
    stopStreaming,
    messages: chatStore.messages,
    isStreaming: chatStore.isStreaming,
    sessionCost: chatStore.sessionCost,
    clearChat: chatStore.clearChat,
    chatMode,
    setChatMode,
    hasEngine: !!engineRef.current || !!(aiConfig.baseUrl && aiConfig.apiKey && aiConfig.modelId),
  };
}
