import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, KeyboardEvent, ChangeEvent } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSend, onStop, isStreaming, disabled = false }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    // Auto-resize textarea on content change
    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [resize]);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      // value is uncontrolled; the resize fires on change
      void e;
    };

    const submit = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      const value = el.value.trim();
      if (!value || isStreaming) return;
      el.value = '';
      el.style.height = 'auto';
      onSend(value);
    }, [isStreaming, onSend]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      },
      [submit],
    );

    return (
      <div className={styles.inputArea}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Ask anything..."
          rows={1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled && !isStreaming}
        />
        <div className={styles.actions}>
          {isStreaming ? (
            <button className={`${styles.btn} ${styles.stopBtn}`} onClick={onStop} title="Stop">
              ■ Stop
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.sendBtn}`}
              onClick={submit}
              disabled={disabled}
              title="Send (Enter)"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    );
  },
);

ChatInput.displayName = 'ChatInput';
