import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { useKernelContext } from '../../contexts/KernelContext';
import { useKernelStore } from '../../stores/kernelStore';
import styles from './ReplInput.module.css';

export function ReplInput() {
  const [code, setCode] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { executeCode, connectionStatus } = useKernelContext();
  const inputHistory = useKernelStore((s) => s.inputHistory);
  const isExecuting = useKernelStore((s) => s.isExecuting);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
    }
  }, [code]);

  const handleExecute = useCallback(() => {
    const trimmed = code.trim();
    if (!trimmed) return;
    executeCode(trimmed).catch((err: Error) => {
      console.error('[ReplInput] Execution error:', err);
    });
    setCode('');
    setHistoryIndex(-1);
  }, [code, executeCode]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleExecute();
        return;
      }

      // Up arrow - navigate history (only when cursor is at start)
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        const el = textareaRef.current;
        if (el && el.selectionStart === 0) {
          e.preventDefault();
          const newIndex = historyIndex + 1;
          if (newIndex < inputHistory.length) {
            setHistoryIndex(newIndex);
            setCode(inputHistory[inputHistory.length - 1 - newIndex]);
          }
        }
      }

      // Down arrow - navigate history forward
      if (e.key === 'ArrowDown' && !e.shiftKey) {
        const el = textareaRef.current;
        if (el && el.selectionEnd === el.value.length) {
          e.preventDefault();
          const newIndex = historyIndex - 1;
          if (newIndex >= 0) {
            setHistoryIndex(newIndex);
            setCode(inputHistory[inputHistory.length - 1 - newIndex]);
          } else {
            setHistoryIndex(-1);
            setCode('');
          }
        }
      }
    },
    [handleExecute, historyIndex, inputHistory],
  );

  const isDisabled = connectionStatus === 'disconnected';

  return (
    <div className={styles.replInputArea}>
      <span className={styles.prompt}>&gt;&gt;&gt;</span>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setHistoryIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={isDisabled ? 'Kernel not connected' : 'Enter Python code...'}
        disabled={isDisabled}
        rows={1}
        spellCheck={false}
        autoComplete="off"
      />
      {isExecuting && <span className={styles.spinner}>⏳</span>}
    </div>
  );
}
