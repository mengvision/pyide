/**
 * ToolConfirmCard
 * Inline confirmation card embedded in the chat flow (Agent mode).
 * Offers "Allow Once" and "Always Allow" options to reduce popup frequency.
 */

import type { ToolCall } from '../../utils/toolCallParser';
import styles from './ToolConfirmDialog.module.css';

interface Props {
  call: ToolCall | null;
  onAllowOnce: () => void;
  onAlwaysAllow: () => void;
  onDeny: () => void;
}

export function ToolConfirmCard({ call, onAllowOnce, onAlwaysAllow, onDeny }: Props) {
  if (!call) return null;

  const argsStr = Object.keys(call.arguments).length
    ? JSON.stringify(call.arguments, null, 2)
    : '(no arguments)';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}>🔧</span>
        <span className={styles.title}>Allow tool execution?</span>
      </div>

      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.label}>Server</span>
          <code className={styles.value}>{call.server}</code>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.label}>Tool</span>
          <code className={styles.value}>{call.tool}</code>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.label}>Arguments</span>
          <pre className={styles.args}>{argsStr}</pre>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.denyBtn} onClick={onDeny}>
          Deny
        </button>
        <button className={styles.allowOnceBtn} onClick={onAllowOnce} autoFocus>
          Allow Once
        </button>
        <button className={styles.alwaysAllowBtn} onClick={onAlwaysAllow}>
          Always Allow
        </button>
      </div>
    </div>
  );
}
