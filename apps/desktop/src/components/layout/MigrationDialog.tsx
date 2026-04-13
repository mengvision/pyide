import type { MigrationReport, VariableInfo } from '../../utils/stateMigration';
import styles from './MigrationDialog.module.css';

interface Props {
  fromMode: 'local' | 'remote';
  toMode: 'local' | 'remote';
  report: MigrationReport;
  isMigrating: boolean;
  migrationError: string | null;
  onProceed: () => void;
  onCancel: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function VarRow({ v }: { v: VariableInfo }) {
  return (
    <div className={styles.varRow}>
      <span className={styles.varName}>{v.name}</span>
      <span className={styles.varMeta}>{v.type} · {formatSize(v.size)}</span>
    </div>
  );
}

export function MigrationDialog({
  fromMode,
  toMode,
  report,
  isMigrating,
  migrationError,
  onProceed,
  onCancel,
}: Props) {
  const { transferred, stubbed, dropped } = report;
  const total = transferred.length + stubbed.length + dropped.length;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !isMigrating) onCancel(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="migration-title">
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title} id="migration-title">
            Kernel Mode Switch — Variable Migration
          </h2>
          <p className={styles.subtitle}>
            Switching from <strong>{fromMode}</strong> → <strong>{toMode}</strong> kernel.
            {' '}{total} variable{total !== 1 ? 's' : ''} found in the current namespace.
          </p>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {migrationError && (
            <div className={styles.errorBox}>
              ⚠ Migration error: {migrationError}
              <br />
              You can still proceed — the mode switch will happen but some variables may not carry over.
            </div>
          )}

          {/* Transferred */}
          {transferred.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.sectionBadge} ${styles.badgeGreen}`}>
                  ✓ Transferred
                </span>
                <span className={styles.sectionCount}>{transferred.length} variable{transferred.length !== 1 ? 's' : ''} will be copied</span>
              </div>
              <div className={styles.varList}>
                {transferred.map((v) => <VarRow key={v.name} v={v} />)}
              </div>
            </div>
          )}

          {/* Stubbed */}
          {stubbed.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.sectionBadge} ${styles.badgeYellow}`}>
                  ~ Stubbed
                </span>
                <span className={styles.sectionCount}>{stubbed.length} variable{stubbed.length !== 1 ? 's' : ''} too large — rebuild hints injected</span>
              </div>
              <div className={styles.varList}>
                {stubbed.map((v) => (
                  <div key={v.name}>
                    <VarRow v={v} />
                    {v.rebuildCode && (
                      <pre className={styles.rebuildCode}>{v.rebuildCode}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dropped */}
          {dropped.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.sectionBadge} ${styles.badgeRed}`}>
                  ✗ Dropped
                </span>
                <span className={styles.sectionCount}>{dropped.length} variable{dropped.length !== 1 ? 's' : ''} cannot be migrated (functions, modules, etc.)</span>
              </div>
              <div className={styles.varList}>
                {dropped.map((v) => <VarRow key={v.name} v={v} />)}
              </div>
            </div>
          )}

          {/* Empty namespace shortcut */}
          {total === 0 && (
            <div className={styles.infoBox}>
              The current kernel namespace is empty — the mode switch will happen immediately.
            </div>
          )}

          {/* General note */}
          {total > 0 && (
            <div className={styles.infoBox}>
              Variables are migrated by executing assignment code in the destination kernel.
              Only JSON-serialisable values under 1 MB are copied directly.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={isMigrating}
          >
            Cancel
          </button>
          <button
            className={styles.btnProceed}
            onClick={onProceed}
            disabled={isMigrating}
          >
            {isMigrating && <span className={styles.spinner} />}
            {isMigrating ? 'Migrating…' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
