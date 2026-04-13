import { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useKernelStore } from '../../stores/kernelStore';
import { useUiStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { ToolConfirmDialog } from './ToolConfirmDialog';
import type { ToolCall } from '../../utils/toolCallParser';
import type { ChatMode } from '../../stores/chatStore';
import styles from './AIChatPanel.module.css';

const MODES: { key: ChatMode; label: string; title: string }[] = [
  { key: 'chat', label: 'Chat', title: 'AI suggests only — no tool execution' },
  { key: 'assist', label: 'Assist', title: 'Read-only tools auto; write tools ask for confirmation' },
  { key: 'agent', label: 'Agent', title: 'Full auto-execution of all tools' },
];

export function AIChatPanel() {
  // ── Confirmation dialog state ───────────────────────────────────────────────
  const [pendingCall, setPendingCall] = useState<ToolCall | null>(null);
  const resolveRef = useRef<((allowed: boolean) => void) | null>(null);

  /**
   * Called by useChat when a tool needs user approval (Assist mode).
   * Returns a promise that resolves when the user clicks Allow/Deny.
   */
  const onConfirm = useCallback((call: ToolCall): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setPendingCall(call);
    });
  }, []);

  const handleAllow = useCallback(() => {
    setPendingCall(null);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleDeny = useCallback(() => {
    setPendingCall(null);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  // ── Chat hook ───────────────────────────────────────────────────────────────
  const {
    sendMessage,
    stopStreaming,
    messages,
    isStreaming,
    clearChat,
    chatMode,
    setChatMode,
  } = useChat(onConfirm);

  // Agent & token usage from store (kept in sync by useChat → AgentManager)
  const agents = useChatStore((s) => s.agents);
  const totalTokenUsage = useChatStore((s) => s.totalTokenUsage);
  const runningAgents = agents.filter((a) => a.status === 'running');

  const lastError = useKernelStore((s) => s.lastError);
  const setLastError = useKernelStore((s) => s.setLastError);
  const activeRightTab = useUiStore((s) => s.activeRightTab);
  const aiConfig = useSettingsStore((s) => s.aiConfig);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const errorHandledRef = useRef<string | null>(null);

  const hasConfig = !!(aiConfig.baseUrl && aiConfig.apiKey && aiConfig.modelId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle lastError auto-fix when chat tab is active
  useEffect(() => {
    if (!lastError || activeRightTab !== 'chat') return;

    const errorKey = `${lastError.traceback}::${lastError.cellCode}`;
    if (errorHandledRef.current === errorKey) return;
    errorHandledRef.current = errorKey;

    const message = lastError.cellCode
      ? `I got this error while running the following code:\n\`\`\`python\n${lastError.cellCode}\n\`\`\`\n\nError:\n\`\`\`\n${lastError.traceback}\n\`\`\`\n\nPlease help me fix it.`
      : `I got this error, please help fix it:\n\`\`\`\n${lastError.traceback}\n\`\`\``;

    setLastError(null);
    sendMessage(message).catch(console.error);
  }, [lastError, activeRightTab, sendMessage, setLastError]);

  // Expose focus method via custom event (for Ctrl+L)
  const focusInput = useCallback(() => {
    chatInputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.addEventListener('pyide:focus-chat-input', focusInput);
    return () => window.removeEventListener('pyide:focus-chat-input', focusInput);
  }, [focusInput]);

  const modelBadge = aiConfig.modelId || 'No model';

  if (!hasConfig) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>AI CHAT</span>
        </div>
        <div className={styles.unconfigured}>
          <span className={styles.unconfiguredIcon}>🤖</span>
          <p>AI provider not configured.</p>
          <p className={styles.hint}>Set Base URL, API key, and Model ID in Settings to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>AI CHAT</span>
        <span className={styles.modelBadge} title={aiConfig.baseUrl}>{modelBadge}</span>

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

      {/* Footer: token usage + agent status */}
      <div className={styles.footer}>
        <span className={styles.tokenUsage}>
          {totalTokenUsage.input > 0 || totalTokenUsage.output > 0 ? (
            <>
              {totalTokenUsage.input.toLocaleString()} in
              {' / '}
              {totalTokenUsage.output.toLocaleString()} out
              {totalTokenUsage.cost > 0 && (
                <span className={styles.costBadge}>
                  {' ~$'}{totalTokenUsage.cost.toFixed(4)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.tokenPlaceholder}>Tokens: —</span>
          )}
        </span>
        {runningAgents.length > 0 && (
          <span className={styles.agentBadge}>
            <span className={styles.agentDot} />
            {runningAgents.length} agent{runningAgents.length > 1 ? 's' : ''} running
          </span>
        )}
        {agents.some((a) => a.role === 'background') && (
          <span className={styles.bgAgentLabel} title="Background agents active">
            ⚡
          </span>
        )}
      </div>

      {/* Tool confirmation dialog (Assist mode) */}
      <ToolConfirmDialog
        call={pendingCall}
        onAllow={handleAllow}
        onDeny={handleDeny}
      />
    </div>
  );
}
