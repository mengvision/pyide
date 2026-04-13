/**
 * useWebChat Hook
 *
 * Web-specific chat hook that routes all AI completions through the Phase 3
 * server REST API instead of calling LLM providers directly from the browser.
 *
 * The hook reuses the desktop chatStore for message state management so that
 * shared UI components (AIChatPanel, ChatMessage, etc.) continue to work
 * without modification.
 */

import { useCallback, useRef } from 'react';
import { useChatStore } from '@desktop/stores/chatStore';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import * as chatApi from '../services/chatApi';
import type { ChatCompletionMessage } from '../services/chatApi';

/** Maximum tool-calling rounds to prevent infinite loops. */
const MAX_TOOL_ROUNDS = 5;

interface UseWebChatOptions {
  /** Auth token obtained from useWebAuth */
  token: string | null;
  /** Active skills content to inject into system prompt */
  activeSkillsContent?: string;
  /** Relevant memories to inject into system prompt */
  memoriesContext?: string;
  /** Available MCP tools description to inject into system prompt */
  mcpToolsContext?: string;
}

export function useWebChat({
  token,
  activeSkillsContent,
  memoriesContext,
  mcpToolsContext,
}: UseWebChatOptions) {
  const chatStore = useChatStore();
  const chatMode = useChatStore((s) => s.chatMode);
  const setChatMode = useChatStore((s) => s.setChatMode);
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const abortRef = useRef<AbortController | null>(null);

  // ── System prompt builder ─────────────────────────────────────────────────

  function buildSystemPrompt(): string {
    const parts: string[] = [
      'You are a helpful Python programming assistant integrated with a live Jupyter kernel.',
      'Help users write, debug, and understand Python code.',
      'When showing code, use Python syntax highlighting.',
    ];

    if (activeSkillsContent) {
      parts.push('\n\n=== ACTIVE SKILLS ===');
      parts.push(activeSkillsContent);
      parts.push('\nFollow the instructions from active skills when applicable.');
    }

    if (memoriesContext) {
      parts.push('\n\n=== RELEVANT MEMORIES ===');
      parts.push(memoriesContext);
      parts.push('\nUse these memories to inform your responses.');
    }

    if (mcpToolsContext) {
      parts.push(mcpToolsContext);
    }

    return parts.join('\n');
  }

  // ── sendMessage ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!token) {
        console.warn('useWebChat: no auth token — cannot send message');
        return;
      }

      // Add user message
      chatStore.addMessage({ role: 'user', content });

      // Snapshot conversation history
      const history = useChatStore.getState().messages;

      const systemPrompt = buildSystemPrompt();

      const baseMessages: ChatCompletionMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ];

      // Add placeholder for streaming assistant response
      chatStore.addMessage({ role: 'assistant', content: '' });
      chatStore.setStreaming(true);

      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      let conversationMessages = [...baseMessages];
      let round = 0;

      const runRound = async (): Promise<void> => {
        round++;
        let fullContent = '';

        await chatApi.sendMessage(
          serverUrl,
          token,
          // Strip leading system message — it will be reconstructed server-side
          // or we pass it as the first element for the server to forward.
          conversationMessages.slice(1),
          (delta) => {
            fullContent += delta;
            chatStore.updateLastAssistantMessage(fullContent);
          },
          (_complete) => {
            // Cost tracking skipped for web (server manages keys/billing)
          },
          (error) => {
            chatStore.updateLastAssistantMessage(`⚠️ Error: ${error.message}`);
            chatStore.setStreaming(false);
          },
          signal,
          // Pass model from settings if configured
          undefined,
        );

        if (signal.aborted) return;

        // Simple tool-call detection for Assist/Agent modes
        // (The server-side MCP proxy handles actual tool execution)
        if ((chatMode === 'assist' || chatMode === 'agent') && round < MAX_TOOL_ROUNDS) {
          const toolCallPattern = /\[TOOL_CALL:\s*\S+\s*\(/;
          if (toolCallPattern.test(fullContent)) {
            // Append current turn and a placeholder tool-result message so the
            // next round gets context. In practice the server resolves these.
            conversationMessages = [
              ...conversationMessages,
              { role: 'assistant', content: fullContent },
              {
                role: 'user',
                content: '(Tool results will be provided by the server)',
              },
            ];
            chatStore.addMessage({ role: 'assistant', content: '' });
            await runRound();
            return;
          }
        }

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
    [token, serverUrl, chatMode, activeSkillsContent, memoriesContext, mcpToolsContext],
  );

  // ── stopStreaming ─────────────────────────────────────────────────────────

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    chatStore.setStreaming(false);
  }, [chatStore]);

  return {
    /** Send a user message through the server AI API */
    sendMessage,
    /** Abort an in-progress streaming response */
    stopStreaming,
    /** Current message list (shared with desktop store) */
    messages: chatStore.messages,
    /** Whether the assistant is currently streaming */
    isStreaming: chatStore.isStreaming,
    /** Clear all chat messages */
    clearChat: chatStore.clearChat,
    /** Current chat mode */
    chatMode,
    /** Change chat mode */
    setChatMode,
    /** True when there is a valid auth token and server URL */
    hasEngine: !!(token && serverUrl),
  };
}
