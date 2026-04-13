import { useState, useCallback, useRef } from 'react';
import { useKernelStore } from '../../stores/kernelStore';
import { useKernelContext } from '../../contexts/KernelContext';
import type { VariableInfo } from '@pyide/protocol/kernel';
import { VariableItem } from './VariableItem';
import { VariableDetail } from './VariableDetail';
import styles from './VariablesPanel.module.css';

interface SelectedVar {
  variable: VariableInfo;
  rect: DOMRect;
}

export function VariablesPanel() {
  const variables = useKernelStore((s) => s.variables);
  const isExecuting = useKernelStore((s) => s.isExecuting);
  const { inspectAll } = useKernelContext();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedVar | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter variables by search query (case-insensitive)
  const filtered = search.trim()
    ? variables.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.type.toLowerCase().includes(search.toLowerCase())
      )
    : variables;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await inspectAll();
    } finally {
      setRefreshing(false);
    }
  }, [inspectAll, refreshing]);

  // Handle selecting a variable (open detail popup)
  const handleSelectFromItem = useCallback(
    (variable: VariableInfo) => {
      // Find the row element in the list
      const listEl = listRef.current;
      if (!listEl) {
        setSelected({ variable, rect: new DOMRect(0, 0, 0, 0) });
        return;
      }
      // Walk through the list rows to find the matching one
      const rows = listEl.querySelectorAll('[data-varname]');
      let rect: DOMRect = new DOMRect(200, 200, 0, 0);
      rows.forEach((row) => {
        if ((row as HTMLElement).dataset.varname === variable.name) {
          rect = row.getBoundingClientRect();
        }
      });
      setSelected({ variable, rect });
    },
    []
  );

  const handleCloseDetail = useCallback(() => {
    setSelected(null);
  }, []);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Variables</span>
        <button
          className={`${styles.headerBtn} ${refreshing ? styles.spinning : ''}`}
          onClick={handleRefresh}
          title="Refresh variables"
          aria-label="Refresh variables"
        >
          🔄
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrapper}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search variables"
        />
      </div>

      {/* Loading banner while kernel executes */}
      {isExecuting && (
        <div className={styles.loadingBanner}>
          <div className={styles.dotPulse}>
            <span />
            <span />
            <span />
          </div>
          Executing…
        </div>
      )}

      {/* Variable count */}
      {variables.length > 0 && (
        <div className={styles.countBar}>
          <span className={styles.countBadge}>{filtered.length}</span>
          {search.trim() ? `of ${variables.length} variables` : 'variables'}
        </div>
      )}

      {/* List */}
      <div className={styles.list} ref={listRef}>
        {variables.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔬</div>
            <div className={styles.emptyTitle}>No variables</div>
            <div className={styles.emptySubtext}>
              Run some code to see variables here
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.noMatch}>
            No variables match "<strong>{search}</strong>"
          </div>
        ) : (
          filtered.map((variable) => (
            <div key={variable.name} data-varname={variable.name}>
              <VariableItem
                variable={variable}
                isSelected={selected?.variable.name === variable.name}
                onSelect={handleSelectFromItem}
              />
            </div>
          ))
        )}
      </div>

      {/* Detail popup */}
      {selected && (
        <VariableDetail
          variable={selected.variable}
          anchorRect={selected.rect}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}
