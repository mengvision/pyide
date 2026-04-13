import { useState, useCallback } from 'react';
import type { VariableInfo } from '@pyide/protocol/kernel';
import { useKernelContext } from '../../contexts/KernelContext';
import styles from './VariableItem.module.css';

// ── Type icon mapping ──────────────────────────────────────────────────────

function getTypeIcon(type: string): string {
  const t = type.toLowerCase();
  if (t === 'dataframe') return '📊';
  if (t === 'series') return '📊';
  if (t === 'int' || t === 'float' || t === 'complex' || t === 'int64' || t === 'float64') return '🔢';
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

// ── CSS class for badge color ──────────────────────────────────────────────

function getBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === 'dataframe' || t === 'series') return styles.typeDataFrame;
  if (t === 'int' || t === 'float' || t === 'complex' || t.startsWith('int') || t.startsWith('float')) return styles.typeInt;
  if (t === 'str') return styles.typeStr;
  if (t === 'dict') return styles.typeDict;
  if (t === 'list' || t === 'tuple') return styles.typeList;
  if (t === 'ndarray' || t.includes('tensor') || t.includes('array')) return styles.typeNdarray;
  if (t === 'bool') return styles.typeBool;
  return '';
}

// ── Child rows rendering ───────────────────────────────────────────────────

interface ChildEntry {
  key: string;
  value: string;
}

function parseChildren(detail: any, type: string): ChildEntry[] {
  const t = type.toLowerCase();
  const entries: ChildEntry[] = [];

  if (t === 'dataframe') {
    if (detail?.shape) entries.push({ key: 'shape', value: String(detail.shape) });
    if (detail?.columns) {
      const cols = Array.isArray(detail.columns) ? detail.columns.join(', ') : String(detail.columns);
      entries.push({ key: 'columns', value: cols });
    }
    if (detail?.dtypes) {
      const dtypes = typeof detail.dtypes === 'object'
        ? Object.entries(detail.dtypes).map(([k, v]) => `${k}: ${v}`).join(', ')
        : String(detail.dtypes);
      entries.push({ key: 'dtypes', value: dtypes });
    }
    return entries;
  }

  if (t === 'dict' && detail?.items) {
    for (const [k, v] of Object.entries(detail.items).slice(0, 20)) {
      entries.push({ key: String(k), value: String(v) });
    }
    if (Object.keys(detail.items).length > 20) {
      entries.push({ key: '...', value: `${Object.keys(detail.items).length - 20} more` });
    }
    return entries;
  }

  if ((t === 'list' || t === 'tuple') && detail?.items) {
    const items: any[] = Array.isArray(detail.items) ? detail.items : [];
    items.slice(0, 20).forEach((v, i) => {
      entries.push({ key: String(i), value: String(v) });
    });
    if (items.length > 20) {
      entries.push({ key: '...', value: `${items.length - 20} more` });
    }
    return entries;
  }

  if (detail?.value_repr) {
    entries.push({ key: 'repr', value: detail.value_repr.slice(0, 200) });
  }

  if (detail?.attributes) {
    for (const [k, v] of Object.entries(detail.attributes).slice(0, 10)) {
      entries.push({ key: String(k), value: String(v) });
    }
  }

  return entries;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface VariableItemProps {
  variable: VariableInfo;
  isSelected: boolean;
  onSelect: (variable: VariableInfo) => void;
  depth?: number;
}

export function VariableItem({ variable, isSelected, onSelect, depth = 0 }: VariableItemProps) {
  const { client } = useKernelContext();
  const [expanded, setExpanded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const canExpand = ['dataframe', 'series', 'dict', 'list', 'tuple', 'ndarray'].includes(
    variable.type.toLowerCase()
  );

  const handleExpand = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!expanded && !detail && client?.current) {
        setLoadingDetail(true);
        try {
          const result = await client.current.inspect(variable.name);
          setDetail(result ?? {});
        } catch {
          setDetail({});
        } finally {
          setLoadingDetail(false);
        }
      }
      setExpanded((prev) => !prev);
    },
    [expanded, detail, client, variable.name]
  );

  const handleNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(variable);
    },
    [onSelect, variable]
  );

  const children: ChildEntry[] = expanded && detail ? parseChildren(detail, variable.type) : [];

  const indentStyle = { paddingLeft: `${8 + depth * 16}px` };

  return (
    <div>
      <div
        className={`${styles.row} ${isSelected ? styles.selected : ''}`}
        style={indentStyle}
        onClick={handleNameClick}
        title={`${variable.name}: ${variable.type} = ${variable.value_preview}`}
      >
        {/* Expand toggle */}
        {canExpand ? (
          <button
            className={`${styles.expandBtn} ${expanded ? styles.expanded : ''}`}
            onClick={handleExpand}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
        ) : (
          <span className={styles.expandPlaceholder} />
        )}

        {/* Type icon */}
        <span className={styles.typeIcon} aria-hidden>
          {getTypeIcon(variable.type)}
        </span>

        {/* Name */}
        <span
          className={styles.name}
          onClick={handleNameClick}
          title={variable.name}
        >
          {variable.name}
        </span>

        {/* Type badge */}
        <span
          className={`${styles.typeBadge} ${getBadgeClass(variable.type)}`}
          title={variable.type}
        >
          {variable.type}
        </span>

        {/* Value preview */}
        <span className={styles.valuePreview} title={variable.value_preview}>
          {variable.value_preview}
        </span>
      </div>

      {/* Expanded children */}
      {expanded && (
        <div className={styles.children}>
          {loadingDetail ? (
            <div className={styles.loadingChild}>
              <span className={styles.spinner} />
              Loading…
            </div>
          ) : children.length > 0 ? (
            children.map((child, i) => (
              <div key={i} className={styles.childRow} style={{ paddingLeft: `${24 + depth * 16}px` }}>
                <span className={styles.childKey}>{child.key}</span>
                <span className={styles.childSep}>:</span>
                <span className={styles.childValue}>{child.value}</span>
              </div>
            ))
          ) : (
            <div className={styles.loadingChild}>No data available</div>
          )}
        </div>
      )}
    </div>
  );
}
