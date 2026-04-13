import { useCallback, useEffect, useState, useRef } from 'react';
import type { FileEntry } from '../../hooks/useFileSystem';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useUiStore } from '../../stores/uiStore';
import { FileTreeItem } from './FileTreeItem';
import styles from './FileTree.module.css';

interface FileTreeProps {
  rootPath: string | null;
}

export function FileTree({ rootPath }: FileTreeProps) {
  const { readDirectory, pickFolder } = useFileSystem();
  const setWorkspacePath = useUiStore((s) => s.setWorkspacePath);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map from dir path -> loaded children
  const [childrenMap, setChildrenMap] = useState<Map<string, FileEntry[]>>(new Map());
  // Set of expanded dir paths
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // CRITICAL FIX: Use useRef to track if we're currently loading to prevent infinite loops
  const loadingRef = useRef(false);

  const loadRoot = useCallback(async (path: string) => {
    if (loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await readDirectory(path);
      setEntries(result);
      setChildrenMap(new Map());
      setExpandedDirs(new Set());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [readDirectory]);

  useEffect(() => {
    if (rootPath) {
      loadRoot(rootPath);
    }
  }, [rootPath]);

  const handleToggleDir = useCallback((dirPath: string, children: FileEntry[]) => {
    setChildrenMap((prev) => {
      const next = new Map(prev);
      next.set(dirPath, children);
      return next;
    });
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (rootPath) loadRoot(rootPath);
  }, [rootPath, loadRoot]);

  const handleOpenFolder = async () => {
    try {
      const picked = await pickFolder();
      if (picked) {
        setWorkspacePath(picked);
      }
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  if (!rootPath) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📂</div>
        <p className={styles.emptyText}>No folder open</p>
        <button className={styles.openBtn} onClick={handleOpenFolder}>
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      <div className={styles.header}>
        <span className={styles.rootName} title={rootPath}>
          {rootPath.split('\\').pop()?.split('/').pop() ?? rootPath}
        </span>
        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            title="Refresh"
            onClick={handleRefresh}
          >
            ↺
          </button>
          <button
            className={styles.iconBtn}
            title="Open Folder"
            onClick={handleOpenFolder}
          >
            📂
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {loading && (
          <div className={styles.loadingRow}>
            <span className={styles.spinner}>⟳</span> Loading…
          </div>
        )}
        {error && (
          <div className={styles.errorRow}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className={styles.emptyDir}>(empty folder)</div>
        )}
        {!loading &&
          entries.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              onRefresh={handleRefresh}
              expandedDirs={expandedDirs}
              onToggleDir={handleToggleDir}
              childrenMap={childrenMap}
            />
          ))}
      </div>
    </div>
  );
}
