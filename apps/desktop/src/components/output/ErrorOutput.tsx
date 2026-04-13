import { useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useKernelStore } from '../../stores/kernelStore';
import styles from './ErrorOutput.module.css';

interface ErrorData {
  text: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface ErrorOutputProps {
  data: ErrorData;
  cellCode?: string;
}

export function ErrorOutput({ data, cellCode = '' }: ErrorOutputProps) {
  const setActiveRightTab = useUiStore((s) => s.setActiveRightTab);
  const setLastError = useKernelStore((s) => s.setLastError);

  // Parse error name from the traceback or data
  const errorName = data.ename ?? extractErrorName(data.text);
  const traceback = data.traceback ? data.traceback.join('\n') : data.text ?? '';

  const handleAiFix = useCallback(() => {
    setLastError({ traceback, cellCode });
    setActiveRightTab('chat');
  }, [setLastError, setActiveRightTab, traceback, cellCode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(traceback).catch(() => {});
  }, [traceback]);

  const lines = traceback.split('\n');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>❌</span>
        <span className={styles.errorName}>{errorName || 'Error'}</span>
        {data.evalue && <span className={styles.errorValue}>{data.evalue}</span>}
      </div>
      <pre className={styles.traceback}>
        {lines.map((line, i) => {
          const isErrorLine = isHighlightLine(line);
          return (
            <div key={i} className={isErrorLine ? styles.highlightLine : undefined}>
              {line}
            </div>
          );
        })}
      </pre>
      <div className={styles.actions}>
        <button className={styles.aiBtnPrimary} onClick={handleAiFix}>
          🤖 AI Fix
        </button>
        <button className={styles.btn} onClick={handleCopy}>
          📋 Copy
        </button>
      </div>
    </div>
  );
}

function extractErrorName(text: string): string {
  if (!text) return '';
  // Try to extract NameError, TypeError, etc. from first matching line
  const match = text.match(/^(\w+Error|\w+Exception):/m);
  return match ? match[1] : '';
}

function isHighlightLine(line: string): boolean {
  // Lines that start the actual error message (error name:) or have "--->" pointer
  return /^(\w+Error|\w+Exception):/.test(line) || line.trim().startsWith('--->');
}
