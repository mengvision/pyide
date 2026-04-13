import { useEffect, useRef } from 'react';
import type { FileEntry } from '../../hooks/useFileSystem';
import { useFileSystem } from '../../hooks/useFileSystem';
import styles from './FileContextMenu.module.css';

interface FileContextMenuProps {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function FileContextMenu({ entry, x, y, onClose, onRefresh }: FileContextMenuProps) {
  const { createFile, createDirectory, renameItem, deleteItem } = useFileSystem();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleNewFile = async () => {
    const basePath = entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('\\') || entry.path.lastIndexOf('/'));
    const name = window.prompt('New file name:');
    if (!name) return;
    const sep = entry.path.includes('\\') ? '\\' : '/';
    const newPath = basePath + sep + name;
    try {
      await createFile(newPath);
      onRefresh();
    } catch (err) {
      window.alert(`Error creating file: ${err}`);
    }
    onClose();
  };

  const handleNewFolder = async () => {
    const basePath = entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('\\') || entry.path.lastIndexOf('/'));
    const name = window.prompt('New folder name:');
    if (!name) return;
    const sep = entry.path.includes('\\') ? '\\' : '/';
    const newPath = basePath + sep + name;
    try {
      await createDirectory(newPath);
      onRefresh();
    } catch (err) {
      window.alert(`Error creating folder: ${err}`);
    }
    onClose();
  };

  const handleRename = async () => {
    const sep = entry.path.includes('\\') ? '\\' : '/';
    const lastSep = Math.max(entry.path.lastIndexOf('\\'), entry.path.lastIndexOf('/'));
    const dir = entry.path.substring(0, lastSep);
    const newName = window.prompt('Rename to:', entry.name);
    if (!newName || newName === entry.name) return;
    const newPath = dir + sep + newName;
    try {
      await renameItem(entry.path, newPath);
      onRefresh();
    } catch (err) {
      window.alert(`Error renaming: ${err}`);
    }
    onClose();
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete "${entry.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteItem(entry.path);
      onRefresh();
    } catch (err) {
      window.alert(`Error deleting: ${err}`);
    }
    onClose();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(entry.path).catch(() => {});
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
    >
      {entry.is_dir && (
        <>
          <button className={styles.menuItem} onClick={handleNewFile}>
            <span className={styles.menuIcon}>📄</span>
            New File
          </button>
          <button className={styles.menuItem} onClick={handleNewFolder}>
            <span className={styles.menuIcon}>📁</span>
            New Folder
          </button>
          <div className={styles.divider} />
        </>
      )}
      <button className={styles.menuItem} onClick={handleRename}>
        <span className={styles.menuIcon}>✏️</span>
        Rename
      </button>
      <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
        <span className={styles.menuIcon}>🗑️</span>
        Delete
      </button>
      <div className={styles.divider} />
      <button className={styles.menuItem} onClick={handleCopyPath}>
        <span className={styles.menuIcon}>📋</span>
        Copy Path
      </button>
    </div>
  );
}
