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

import { useEffect, useRef, useCallback, useState } from 'react';
import { useChatStore } from '@desktop/stores/chatStore';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import { ChatMessage } from '@desktop/components/chat/ChatMessage';
import { ChatInput } from '@desktop/components/chat/ChatInput';
import type { ChatInputHandle } from '@desktop/components/chat/ChatInput';
import type { ChatMode } from '@desktop/stores/chatStore';
import { useSkillStore } from '@desktop/services/SkillService';
import { useSkillAutocomplete } from '@desktop/hooks/useSkillAutocomplete';
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
  // ── Drag-and-drop state for skill zip installation ──────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // ── Install feedback state (visible inline, not filtered like system messages) ─
  const [installFeedback, setInstallFeedback] = useState<{
    type: 'installing' | 'success' | 'error';
    message: string;
  } | null>(null);
  const installTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showInstallFeedback = useCallback(
    (feedback: typeof installFeedback) => {
      setInstallFeedback(feedback);
      if (installTimerRef.current) clearTimeout(installTimerRef.current);
      if (feedback && feedback.type !== 'installing') {
        installTimerRef.current = setTimeout(() => setInstallFeedback(null), 5000);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (installTimerRef.current) clearTimeout(installTimerRef.current);
    };
  }, []);
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

  // ── Slash autocomplete / skill activation ───────────────────────────────────
  const skillAutocomplete = useSkillAutocomplete();
  const deactivateSkill = useSkillStore((s) => s.deactivateSkill);

  const handleSend = useCallback(
    async (rawText: string) => {
      const slashMatch = rawText.match(/^\/([\w-]+)(?:\s+([\s\S]*))?$/);
      if (slashMatch) {
        const cmdName = slashMatch[1].toLowerCase();
        const rest = (slashMatch[2] ?? '').trim();

        if (cmdName === 'clear') {
          const { activeSkills } = useSkillStore.getState();
          [...activeSkills].forEach((id) => deactivateSkill(id));
          skillAutocomplete.reset();
          return;
        }

        const { skills, activateSkill } = useSkillStore.getState();
        const matched = skills.find((s) => s.name.toLowerCase() === cmdName);
        if (matched) {
          activateSkill(matched.id);
          skillAutocomplete.reset();
          if (rest) {
            await sendMessage(rest);
          }
          return;
        }
      }

      skillAutocomplete.reset();
      await sendMessage(rawText);
    },
    [sendMessage, skillAutocomplete, deactivateSkill],
  );

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

  // ── Drag-and-drop handlers ───────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer.files);
      const zipFile = files.find(
        (f) => f.name.endsWith('.zip') || f.type === 'application/zip',
      );

      if (!zipFile) {
        showInstallFeedback({
          type: 'error',
          message: 'No .zip file found. Drop a .zip file to install a skill.',
        });
        return;
      }

      showInstallFeedback({
        type: 'installing',
        message: `Installing skill from ${zipFile.name}…`,
      });

      try {
        const result = await useSkillStore.getState().installFromZip(zipFile);
        if (result.success) {
          showInstallFeedback({
            type: 'success',
            message: `✅ Skill "${result.skillName}" installed! Use /${result.skillName} in chat to activate.`,
          });
        } else {
          showInstallFeedback({
            type: 'error',
            message: `❌ Failed: ${result.error || 'Unknown error'}`,
          });
        }
      } catch (err) {
        showInstallFeedback({
          type: 'error',
          message: `❌ Installation failed: ${(err as Error).message}.`,
        });
      }
    },
    [showInstallFeedback],
  );

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
    <div
      className={styles.panel}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        {/* Install feedback banner (visible inline, not affected by system-message filter) */}
        {installFeedback && (
          <div className={`${styles.installBanner} ${styles[`installBanner_${installFeedback.type}`]}`}>
            <span className={styles.installBannerIcon}>
              {installFeedback.type === 'installing' ? '⏳' : installFeedback.type === 'success' ? '✅' : '❌'}
            </span>
            <span className={styles.installBannerMessage}>{installFeedback.message}</span>
            {installFeedback.type !== 'installing' && (
              <button
                className={styles.installBannerClose}
                onClick={() => setInstallFeedback(null)}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Drag-and-drop overlay */}
        {isDragging && (
          <div className={styles.dragOverlay}>
            <div className={styles.dragOverlayContent}>
              <span className={styles.dragOverlayIcon}>📦</span>
              <span className={styles.dragOverlayText}>
                Drop .zip file to install skill
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active skill badges (from slash-command activation) */}
      {skillAutocomplete.activatedSkillName && (
        <div className={styles.activatedSkillBadgeRow}>
          <span className={styles.activatedSkillBadge}>
            <span className={styles.activatedSkillIcon}>🔧</span>
            <span className={styles.activatedSkillLabel}>{skillAutocomplete.activatedSkillName} active</span>
            <button
              className={styles.activatedSkillClose}
              title={`Deactivate ${skillAutocomplete.activatedSkillName}`}
              onClick={() => {
                const skill = useSkillStore.getState().skills.find(
                  (s) => s.name === skillAutocomplete.activatedSkillName,
                );
                if (skill) useSkillStore.getState().deactivateSkill(skill.id);
                skillAutocomplete.reset();
              }}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        ref={chatInputRef}
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        onInputChange={skillAutocomplete.handleInputChange}
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
