import { useCallback } from 'react';
import styles from './LogOutput.module.css';

interface LogOutputProps {
  data: { text: string };
  level: 'info' | 'warning';
}

export function LogOutput({ data, level }: LogOutputProps) {
  const text = data.text ?? '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, [text]);

  return (
    <div className={`${styles.container} ${styles[level]}`}>
      <div className={styles.badge}>
        <span className={styles.icon}>{level === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span className={styles.levelText}>{level.toUpperCase()}</span>
      </div>
      <pre className={styles.text}>{text}</pre>
      <button className={styles.copyBtn} onClick={handleCopy} title="Copy">📋</button>
    </div>
  );
}
