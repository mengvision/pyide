import { useState, useEffect, useRef, useCallback } from 'react';
import type { VariableInfo } from '@pyide/protocol/kernel';
import { formatSize } from '../../utils/formatSize';
import styles from './VariableDetail.module.css';

function getTypeIcon(type: string): string {
  const t = type.toLowerCase();
  if (t === 'dataframe' || t === 'series') return '📊';
  if (t === 'int' || t === 'float' || t === 'complex' || t.startsWith('int') || t.startsWith('float')) return '🔢';
  if (t === 'str') return '📝';
  if (t === 'dict') return '📋';
  if (t === 'list' || t === 'tuple') return '📦';
  if (t === 'ndarray' || t.includes('tensor') || t.includes('array')) return '🧮';
  if (t === 'bool') return '✅';
  if (t === 'function' || t === 'method' || t === 'builtin_function_or_method') return '⚙️';
  if (t === 'module') return '📚';
  if (t === 'nonetype') return '⬜';
  return '📄';
}

interface VariableDetailProps {
  variable: VariableInfo;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function VariableDetail({ variable, anchorRect, onClose }: VariableDetailProps) {
  const [copiedName, setCopiedName] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Position card near the anchor element (the variable row)
  const cardStyle = usePositionCard(anchorRect);

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copyName = useCallback(async () => {
    await navigator.clipboard.writeText(variable.name);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 1500);
  }, [variable.name]);

  const copyValue = useCallback(async () => {
    await navigator.clipboard.writeText(variable.value_preview.slice(0, 1000));
    setCopiedValue(true);
    setTimeout(() => setCopiedValue(false), 1500);
  }, [variable.value_preview]);

  return (
    <div className={styles.overlay} onMouseDown={handleOverlayClick}>
      <div ref={cardRef} className={styles.card} style={cardStyle}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>{getTypeIcon(variable.type)}</span>
            <span className={styles.varName} title={variable.name}>
              {variable.name}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Type */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Type</span>
            <span className={styles.typeBadge}>{variable.type}</span>
          </div>

          {/* Shape */}
          {variable.shape && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Shape</span>
              <span className={styles.metaValue}>{variable.shape}</span>
            </div>
          )}

          {/* Size */}
          {variable.size !== undefined && variable.size !== null && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Size</span>
              <span className={styles.metaValue}>{formatSize(variable.size)}</span>
            </div>
          )}

          <div className={styles.divider} />

          {/* Value */}
          <div>
            <div className={styles.valueLabel}>Value</div>
            <div className={styles.valueBox}>
              {variable.value_preview.slice(0, 1000)}
              {variable.value_preview.length > 1000 && (
                <span style={{ color: 'var(--text-secondary)' }}> …(truncated)</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${copiedName ? styles.copied : ''}`}
            onClick={copyName}
          >
            {copiedName ? '✓ Copied!' : '📋 Copy Name'}
          </button>
          <button
            className={`${styles.actionBtn} ${copiedValue ? styles.copied : ''}`}
            onClick={copyValue}
          >
            {copiedValue ? '✓ Copied!' : '📄 Copy Value'}
          </button>
          <button className={`${styles.actionBtn} ${styles.primary}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Position helper ────────────────────────────────────────────────────────

function usePositionCard(anchorRect: DOMRect): React.CSSProperties {
  const cardWidth = 340;
  const cardMaxHeight = 480;
  const margin = 8;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Try to place card to the left of the anchor
  let left = anchorRect.left - cardWidth - margin;
  if (left < margin) {
    // Fall back to right side
    left = anchorRect.right + margin;
  }
  if (left + cardWidth > viewportW - margin) {
    left = viewportW - cardWidth - margin;
  }

  // Vertically align with anchor row, clamped to viewport
  let top = anchorRect.top;
  if (top + cardMaxHeight > viewportH - margin) {
    top = viewportH - cardMaxHeight - margin;
  }
  if (top < margin) top = margin;

  return { left, top };
}
