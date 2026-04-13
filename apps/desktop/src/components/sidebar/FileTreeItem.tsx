import { useState } from 'react';
import type { FileEntry } from '../../hooks/useFileSystem';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useEditorStore } from '../../stores/editorStore';
import { FileContextMenu } from './FileContextMenu';
import styles from './FileTreeItem.module.css';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onRefresh: () => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string, children: FileEntry[]) => void;
  childrenMap: Map<string, FileEntry[]>;
}

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'py':
      return '🐍';
    case 'csv':
      return '📊';
    case 'json':
      return '📋';
    case 'md':
      return '📝';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return '⚡';
    case 'html':
      return '🌐';
    case 'css':
      return '🎨';
    case 'rs':
      return '🦀';
    case 'toml':
    case 'yaml':
    case 'yml':
      return '⚙️';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return '🖼️';
    default:
      return '📄';
  }
}

export function FileTreeItem({
  entry,
  depth,
  onRefresh,
  expandedDirs,
  onToggleDir,
  childrenMap,
}: FileTreeItemProps) {
  const { readDirectory } = useFileSystem();
  const { openFile, activeFileId } = useEditorStore();
  const { readTextFile } = useFileSystem();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const [loading, setLoading] = useState(false);
  const { renameItem } = useFileSystem();

  const isExpanded = expandedDirs.has(entry.path);
  const isActive = activeFileId === entry.path;
  const children = childrenMap.get(entry.path);

  const handleClick = async () => {
    if (entry.is_dir) {
      if (!isExpanded) {
        // Load children if not loaded yet
        if (!children) {
          setLoading(true);
          try {
            const loaded = await readDirectory(entry.path);
            onToggleDir(entry.path, loaded);
          } catch {
            onToggleDir(entry.path, []);
          } finally {
            setLoading(false);
          }
        } else {
          onToggleDir(entry.path, children);
        }
      } else {
        onToggleDir(entry.path, children ?? []);
      }
    } else {
      // Open file in editor
      try {
        const content = await readTextFile(entry.path);
        openFile({
          id: entry.path,
          name: entry.name,
          path: entry.path,
          content,
        });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!entry.is_dir) {
      e.preventDefault();
      setIsRenaming(true);
      setRenameValue(entry.name);
    }
  };

  const commitRename = async () => {
    const newName = renameValue.trim();
    setIsRenaming(false);
    if (!newName || newName === entry.name) return;
    const lastSep = Math.max(entry.path.lastIndexOf('\\'), entry.path.lastIndexOf('/'));
    const sep = entry.path.includes('\\') ? '\\' : '/';
    const dir = entry.path.substring(0, lastSep);
    const newPath = dir + sep + newName;
    try {
      await renameItem(entry.path, newPath);
      onRefresh();
    } catch (err) {
      window.alert(`Rename failed: ${err}`);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const icon = getFileIcon(entry.name, entry.is_dir);
  const indentPx = depth * 16;

  return (
    <>
      <div
        className={`${styles.item} ${isActive ? styles.active : ''}`}
        style={{ paddingLeft: `${8 + indentPx}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        title={entry.path}
      >
        {entry.is_dir ? (
          <span className={styles.arrow}>{loading ? '⟳' : isExpanded ? '▼' : '▶'}</span>
        ) : (
          <span className={styles.arrowSpacer} />
        )}
        <span className={styles.icon}>{icon}</span>
        {isRenaming ? (
          <input
            className={styles.renameInput}
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name}>{entry.name}</span>
        )}
      </div>

      {entry.is_dir && isExpanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onRefresh={onRefresh}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              childrenMap={childrenMap}
            />
          ))}
          {children.length === 0 && (
            <div
              className={styles.empty}
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
            >
              (empty)
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <FileContextMenu
          entry={entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRefresh={() => {
            setContextMenu(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
