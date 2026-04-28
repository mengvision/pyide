import { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useKernelStore } from '../../stores/kernelStore';
import { useUiStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';
import { useMCPStore } from '../../stores/mcpStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { ToolConfirmCard } from './ToolConfirmDialog';
import { setMCPPermission } from '../../services/MCPService/permissions';
import { useSkillStore } from '../../services/SkillService';
import { useSkillAutocomplete } from '../../hooks/useSkillAutocomplete';
import type { ToolCall } from '../../utils/toolCallParser';
import type { ChatMode } from '../../stores/chatStore';
import styles from './AIChatPanel.module.css';

const MODES: { key: ChatMode; label: string; title: string }[] = [
  { key: 'chat', label: 'Chat', title: 'AI suggests only — no tool execution' },
  { key: 'agent', label: 'Agent', title: 'Tools execute with user confirmation' },
];

export function AIChatPanel() {
  // ── Confirmation dialog state ───────────────────────────────────────────────
  const [pendingCall, setPendingCall] = useState<ToolCall | null>(null);
  const resolveRef = useRef<((allowed: boolean) => void) | null>(null);

  // ── Drag-and-drop state for skill zip installation ──────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Pending overwrite: file to retry + skill name for display
  const [overwritePending, setOverwritePending] = useState<{ file: File; skillName: string } | null>(null);

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

  /**
   * Called by useChat when a tool needs user approval (Agent mode).
   * Returns a promise that resolves when the user clicks Allow/Deny.
   */
  const onConfirm = useCallback((call: ToolCall): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setPendingCall(call);
    });
  }, []);

  const handleAllowOnce = useCallback(() => {
    setPendingCall(null);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleAlwaysAllow = useCallback(() => {
    if (pendingCall) {
      setMCPPermission(pendingCall.server, pendingCall.tool, 'always_allow');
    }
    setPendingCall(null);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, [pendingCall]);

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

  // ── Slash autocomplete / skill activation ───────────────────────────────────
  const skillAutocomplete = useSkillAutocomplete();
  const deactivateSkill = useSkillStore((s) => s.deactivateSkill);

  /**
   * Parses the raw message for a `/skillname` prefix, activates the skill,
   * strips the prefix, then forwards the cleaned text to the AI.
   */
  const handleSend = useCallback(
    async (rawText: string) => {
      // Detect /command at start of message
      const slashMatch = rawText.match(/^\/([\w-]+)(?:\s+([\s\S]*))?$/);
      if (slashMatch) {
        const cmdName = slashMatch[1].toLowerCase();
        const rest = (slashMatch[2] ?? '').trim();

        if (cmdName === 'clear') {
          // Deactivate all active skills
          const { activeSkills } = useSkillStore.getState();
          [...activeSkills].forEach((id) => deactivateSkill(id));
          skillAutocomplete.reset();
          // Don't send the message — it was a command only
          return;
        }

        // Find matching skill
        const { skills, activateSkill } = useSkillStore.getState();
        const matched = skills.find(
          (s) => s.name.toLowerCase() === cmdName,
        );
        if (matched) {
          activateSkill(matched.id);
          skillAutocomplete.reset();
          // Send the remaining text (or nothing if it was just the command)
          if (rest) {
            await sendMessage(rest);
          }
          return;
        }
      }

      // Reset autocomplete on send
      skillAutocomplete.reset();
      await sendMessage(rawText);
    },
    [sendMessage, skillAutocomplete, deactivateSkill],
  );

  // Agent & token usage from store (kept in sync by useChat → AgentManager)
  const agents = useChatStore((s) => s.agents);
  const totalTokenUsage = useChatStore((s) => s.totalTokenUsage);
  const runningAgents = agents.filter((a) => a.status === 'running');
  const toolExecutions = useMCPStore((s) => s.toolExecutions);

  const lastError = useKernelStore((s) => s.lastError);
  const setLastError = useKernelStore((s) => s.setLastError);
  const activeRightTab = useUiStore((s) => s.activeRightTab);
  const aiConfig = useSettingsStore((s) => s.aiConfig);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const errorHandledRef = useRef<string | null>(null);

  const hasConfig = !!(aiConfig.baseUrl && aiConfig.apiKey && aiConfig.modelId);

  // Auto-scroll to bottom when new messages arrive or a confirmation card appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingCall]);

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

      const result = await useSkillStore.getState().installFromZip(zipFile);

      if (result.success) {
        showInstallFeedback({
          type: 'success',
          message: `\u2705 Skill "${result.skillName}" installed! Use /${result.skillName} in chat to activate.`,
        });
      } else if (result.errorType === 'already_exists') {
        // Show inline overwrite confirmation instead of an error
        const skillName = zipFile.name.replace(/\.zip$/i, '');
        showInstallFeedback(null);
        setOverwritePending({ file: zipFile, skillName });
      } else {
        showInstallFeedback({
          type: 'error',
          message: `\u274c Failed: ${result.error || 'Unknown error'}`,
        });
      }
    },
    [showInstallFeedback],
  );

  // ── Overwrite confirm handlers ──────────────────────────────────
  const handleOverwriteConfirm = useCallback(async () => {
    if (!overwritePending) return;
    const { file, skillName } = overwritePending;
    setOverwritePending(null);
    showInstallFeedback({ type: 'installing', message: `Overwriting "${skillName}"\u2026` });
    const result = await useSkillStore.getState().installFromZip(file, { overwrite: true });
    if (result.success) {
      showInstallFeedback({
        type: 'success',
        message: `\u2705 Skill "${result.skillName}" overwritten successfully!`,
      });
    } else {
      showInstallFeedback({
        type: 'error',
        message: `\u274c Failed to overwrite: ${result.error || 'Unknown error'}`,
      });
    }
  }, [overwritePending, showInstallFeedback]);

  const handleOverwriteCancel = useCallback(() => {
    setOverwritePending(null);
  }, []);

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

        {/* Tool execution status indicator */}
        {toolExecutions.length > 0 && toolExecutions.some((t) => t.status === 'running') && (
          <div className={styles.toolStatusCard}>
            <div className={styles.toolStatusSpinner}>
              <span className={styles.spinnerDot} />
            </div>
            <div className={styles.toolStatusText}>
              {toolExecutions
                .filter((t) => t.status === 'running')
                .map((t) => (
                  <span key={`${t.server}.${t.tool}`} className={styles.toolStatusItem}>
                    🔧 {t.server}.{t.tool}
                  </span>
                ))}
              <span className={styles.toolStatusLabel}>executing...</span>
            </div>
          </div>
        )}
        {toolExecutions.length > 0 && toolExecutions.every((t) => t.status === 'done') && (
          <div className={styles.toolStatusCardDone}>
            ✅ Tools completed: {toolExecutions.map((t) => `${t.server}.${t.tool}`).join(', ')}
          </div>
        )}
        {/* Inline tool confirmation card (Agent mode) */}
        <ToolConfirmCard
          call={pendingCall}
          onAllowOnce={handleAllowOnce}
          onAlwaysAllow={handleAlwaysAllow}
          onDeny={handleDeny}
        />
        {/* Install feedback banner (visible inline, not affected by system-message filter) */}
        {installFeedback && (
          <div className={`${styles.installBanner} ${styles[`installBanner_${installFeedback.type}`]}`}>
            <span className={styles.installBannerIcon}>
              {installFeedback.type === 'installing' ? '\u23f3' : installFeedback.type === 'success' ? '\u2705' : '\u274c'}
            </span>
            <span className={styles.installBannerMessage}>{installFeedback.message}</span>
            {installFeedback.type !== 'installing' && (
              <button
                className={styles.installBannerClose}
                onClick={() => setInstallFeedback(null)}
              >
                \u2715
              </button>
            )}
          </div>
        )}

        {/* Overwrite confirm card — shown when skill already exists */}
        {overwritePending && (
          <div className={styles.overwriteCard}>
            <div className={styles.overwriteCardTitle}>
              \u26a0\ufe0f Skill Already Installed
            </div>
            <div className={styles.overwriteCardBody}>
              A skill named <strong>{overwritePending.skillName}</strong> is already installed.
              Do you want to overwrite it with the new version?
            </div>
            <div className={styles.overwriteCardActions}>
              <button className={styles.overwriteCancelBtn} onClick={handleOverwriteCancel}>
                Cancel
              </button>
              <button className={styles.overwriteConfirmBtn} onClick={handleOverwriteConfirm}>
                Overwrite
              </button>
            </div>
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

    </div>
  );
}
