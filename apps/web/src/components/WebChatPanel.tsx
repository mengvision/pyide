/**
 * WebChatPanel
 *
 * Web-specific AI chat panel. Mirrors the desktop AIChatPanel layout but
 * uses the useWebChat hook (server-routed completions) instead of the
 * desktop useChat hook (direct LLM calls).
 *
 * Shared sub-components (ChatMessage, ChatInput, ToolConfirmDialog) are
 * imported from the desktop source via the @desktop alias.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@desktop/stores/chatStore';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import { ChatMessage } from '@desktop/components/chat/ChatMessage';
import { ChatInput } from '@desktop/components/chat/ChatInput';
import type { ChatInputHandle } from '@desktop/components/chat/ChatInput';
import type { ChatMode } from '@desktop/stores/chatStore';
import { useWebChat } from '../hooks/useWebChat';
import styles from '@desktop/components/chat/AIChatPanel.module.css';

const MODES: { key: ChatMode; label: string; title: string }[] = [
  { key: 'chat', label: 'Chat', title: 'AI suggests only — no tool execution' },
  { key: 'assist', label: 'Assist', title: 'Read-only tools auto; write tools ask for confirmation' },
  { key: 'agent', label: 'Agent', title: 'Full auto-execution of all tools' },
];

interface WebChatPanelProps {
  /** JWT from useWebAuth */
  token: string | null;
  /** Concatenated active skill instructions for system prompt */
  activeSkillsContent?: string;
  /** Memory context for system prompt */
  memoriesContext?: string;
  /** MCP tools description for system prompt */
  mcpToolsContext?: string;
}

export function WebChatPanel({
  token,
  activeSkillsContent,
  memoriesContext,
  mcpToolsContext,
}: WebChatPanelProps) {
  const {
    sendMessage,
    stopStreaming,
    messages,
    isStreaming,
    clearChat,
    chatMode,
    setChatMode,
    hasEngine,
  } = useWebChat({ token, activeSkillsContent, memoriesContext, mcpToolsContext });

  const totalTokenUsage = useChatStore((s) => s.totalTokenUsage);
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Auto-scroll to the bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ctrl+L → focus chat input
  const focusInput = useCallback(() => {
    chatInputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.addEventListener('pyide:focus-chat-input', focusInput);
    return () => window.removeEventListener('pyide:focus-chat-input', focusInput);
  }, [focusInput]);

  if (!hasEngine) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>AI CHAT</span>
        </div>
        <div className={styles.unconfigured}>
          <span className={styles.unconfiguredIcon}>🤖</span>
          <p>Not connected to server.</p>
          <p className={styles.hint}>
            {serverUrl
              ? `Connecting to ${serverUrl}…`
              : 'Set the server URL in Settings to get started.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>AI CHAT</span>
        <span className={styles.modelBadge} title={serverUrl}>
          server
        </span>

        {/* Mode selector */}
        <div className={styles.modeSelector} role="group" aria-label="Chat mode">
          {MODES.map(({ key, label, title }) => (
            <button
              key={key}
              className={`${styles.modeBtn} ${chatMode === key ? styles.modeBtnActive : ''}`}
              onClick={() => setChatMode(key)}
              title={title}
              disabled={isStreaming}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className={styles.clearBtn}
          onClick={clearChat}
          title="New chat"
          disabled={isStreaming}
        >
          🗑️
        </button>
      </div>

      {/* Message list */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p>Ask anything about your code, data, or errors.</p>
          </div>
        )}
        {messages
          .filter((m) => m.role !== 'system')
          .map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        {isStreaming && (
          <div className={styles.streamingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        ref={chatInputRef}
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />

      {/* Footer: token usage */}
      <div className={styles.footer}>
        <span className={styles.tokenUsage}>
          {totalTokenUsage.input > 0 || totalTokenUsage.output > 0 ? (
            <>
              {totalTokenUsage.input.toLocaleString()} in
              {' / '}
              {totalTokenUsage.output.toLocaleString()} out
              {totalTokenUsage.cost > 0 && (
                <span className={styles.costBadge}>
                  {' ~$'}
                  {totalTokenUsage.cost.toFixed(4)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.tokenPlaceholder}>Tokens: —</span>
          )}
        </span>
      </div>
    </div>
  );
}
