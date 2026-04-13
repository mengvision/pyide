/**
 * ToolConfirmDialog
 * Modal confirmation dialog shown in Assist mode before executing an MCP tool.
 */

import { useEffect, useRef } from 'react';
import type { ToolCall } from '../../utils/toolCallParser';
import styles from './ToolConfirmDialog.module.css';

interface Props {
  call: ToolCall | null;
  onAllow: () => void;
  onDeny: () => void;
}

export function ToolConfirmDialog({ call, onAllow, onDeny }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (call) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [call]);

  if (!call) return null;

  const argsStr = Object.keys(call.arguments).length
    ? JSON.stringify(call.arguments, null, 2)
    : '(no arguments)';

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onDeny}>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.icon}>🔧</span>
          <h3 className={styles.title}>Allow Tool Execution?</h3>
        </div>

        <p className={styles.description}>
          The AI wants to run a tool. Allow it?
        </p>

        <div className={styles.callDetails}>
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
          <button className={styles.allowBtn} onClick={onAllow} autoFocus>
            Allow
          </button>
        </div>
      </div>
    </dialog>
  );
}
