/**
 * WebFileTree
 *
 * A web-specific file explorer that:
 *  1. Uses the server-provided workspace root (not a local OS path).
 *  2. Adds a drag-and-drop upload zone in the sidebar.
 *  3. Extends the context menu with a Download option.
 *  4. Reuses the shared desktop FileTree/FileTreeItem rendering logic via
 *     the PlatformService abstraction — only the workspace root source and the
 *     extra upload/download actions are web-specific.
 *
 * Usage:
 *   <WebFileTree fs={webFileSystem} token={token} />
 */

import { useState, useCallback, useEffect } from 'react';
import type { FileEntry } from '@pyide/platform';
import { useEditorStore } from '@desktop/stores/editorStore';
import { FileUpload } from './FileUpload';
import type { UseWebFileSystemReturn } from '../hooks/useWebFileSystem';
import './WebFileTree.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebFileTreeProps {
  fs: UseWebFileSystemReturn;
  token: string;
}

interface ContextMenuState {
  entry: FileEntry;
  x: number;
  y: number;
}

// ── Icon helper ───────────────────────────────────────────────────────────────

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'py': return '🐍';
    case 'csv': return '📊';
    case 'json': return '📋';
    case 'md': return '📝';
    case 'ts': case 'tsx': case 'js': case 'jsx': return '⚡';
    case 'html': return '🌐';
    case 'css': return '🎨';
    case 'rs': return '🦀';
    case 'toml': case 'yaml': case 'yml': return '⚙️';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return '🖼️';
    default: return '📄';
  }
}

// ── WebFileTreeItem (recursive) ───────────────────────────────────────────────

interface WebFileTreeItemProps {
  entry: FileEntry;
  depth: number;
  expandedDirs: Set<string>;
  childrenMap: Map<string, FileEntry[]>;
  activeFileId: string | null;
  onToggleDir: (path: string) => void;
  onOpenFile: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  onRefresh: () => void;
}

function WebFileTreeItem({
  entry,
  depth,
  expandedDirs,
  childrenMap,
  activeFileId,
  onToggleDir,
  onOpenFile,
  onContextMenu,
  onRefresh,
}: WebFileTreeItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);

  const isExpanded = expandedDirs.has(entry.path);
  const isActive = activeFileId === entry.path;
  const children = childrenMap.get(entry.path);
  const icon = getFileIcon(entry.name, entry.is_dir);
  const indentPx = 8 + depth * 16;

  const handleClick = () => {
    if (entry.is_dir) {
      onToggleDir(entry.path);
    } else {
      onOpenFile(entry);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(entry, e.clientX, e.clientY);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!entry.is_dir) {
      e.preventDefault();
      setIsRenaming(true);
      setRenameValue(entry.name);
    }
  };

  const commitRename = useCallback(async () => {
    // Note: actual rename is handled via context menu in parent; this is just
    // inline visual feedback — real rename happens via context.
    setIsRenaming(false);
    onRefresh();
  }, [onRefresh]);

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename().catch(console.error);
    if (e.key === 'Escape') setIsRenaming(false);
  };

  return (
    <>
      <div
        className={`wft-item ${isActive ? 'wft-item--active' : ''}`}
        style={{ paddingLeft: `${indentPx}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        title={entry.path}
      >
        {entry.is_dir ? (
          <span className="wft-arrow">{isExpanded ? '▼' : '▶'}</span>
        ) : (
          <span className="wft-arrow-spacer" />
        )}
        <span className="wft-icon">{icon}</span>
        {isRenaming ? (
          <input
            className="wft-rename-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => commitRename().catch(console.error)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="wft-name">{entry.name}</span>
        )}
      </div>

      {entry.is_dir && isExpanded && children && (
        <div>
          {children.map((child) => (
            <WebFileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              childrenMap={childrenMap}
              activeFileId={activeFileId}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onRefresh={onRefresh}
            />
          ))}
          {children.length === 0 && (
            <div className="wft-empty" style={{ paddingLeft: `${indentPx + 16}px` }}>
              (empty)
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface WebContextMenuProps {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  fs: UseWebFileSystemReturn;
  token: string;
}

function WebContextMenu({ entry, x, y, onClose, fs, token }: WebContextMenuProps) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const menu = document.getElementById('wft-context-menu');
      if (menu && !menu.contains(target)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const handleNewFile = async () => {
    const basePath = entry.is_dir
      ? entry.path
      : entry.path.substring(0, Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\')));
    const name = window.prompt('New file name:');
    if (!name) return onClose();
    try {
      await fs.createFile(`${basePath}/${name}`);
    } catch (err) {
      window.alert(`Create failed: ${err}`);
    }
    onClose();
  };

  const handleNewFolder = async () => {
    const basePath = entry.is_dir
      ? entry.path
      : entry.path.substring(0, Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\')));
    const name = window.prompt('New folder name:');
    if (!name) return onClose();
    try {
      await fs.createFolder(`${basePath}/${name}`);
    } catch (err) {
      window.alert(`Create failed: ${err}`);
    }
    onClose();
  };

  const handleRename = async () => {
    const lastSep = Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\'));
    const dir = entry.path.substring(0, lastSep);
    const newName = window.prompt('Rename to:', entry.name);
    if (!newName || newName === entry.name) return onClose();
    try {
      await fs.renameItem(entry.path, `${dir}/${newName}`);
    } catch (err) {
      window.alert(`Rename failed: ${err}`);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return onClose();
    try {
      await fs.deleteItem(entry.path);
    } catch (err) {
      window.alert(`Delete failed: ${err}`);
    }
    onClose();
  };

  const handleDownload = async () => {
    try {
      await fs.downloadFile(entry.path);
    } catch (err) {
      window.alert(`Download failed: ${err}`);
    }
    onClose();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(entry.path).catch(() => {});
    onClose();
  };

  // Suppress unused-variable lint if token is not yet used inside
  void token;

  return (
    <div
      id="wft-context-menu"
      className="wft-context-menu"
      style={{ left: x, top: y }}
    >
      {entry.is_dir && (
        <>
          <button className="wft-menu-item" onClick={() => handleNewFile().catch(console.error)}>
            <span className="wft-menu-icon">📄</span> New File
          </button>
          <button className="wft-menu-item" onClick={() => handleNewFolder().catch(console.error)}>
            <span className="wft-menu-icon">📁</span> New Folder
          </button>
          <div className="wft-divider" />
        </>
      )}
      <button className="wft-menu-item" onClick={() => handleRename().catch(console.error)}>
        <span className="wft-menu-icon">✏️</span> Rename
      </button>
      <button
        className="wft-menu-item wft-menu-item--danger"
        onClick={() => handleDelete().catch(console.error)}
      >
        <span className="wft-menu-icon">🗑️</span> Delete
      </button>
      {!entry.is_dir && (
        <>
          <div className="wft-divider" />
          <button className="wft-menu-item" onClick={() => handleDownload().catch(console.error)}>
            <span className="wft-menu-icon">⬇</span> Download
          </button>
        </>
      )}
      <div className="wft-divider" />
      <button className="wft-menu-item" onClick={handleCopyPath}>
        <span className="wft-menu-icon">📋</span> Copy Path
      </button>
    </div>
  );
}

// ── WebFileTree ────────────────────────────────────────────────────────────────

export function WebFileTree({ fs, token }: WebFileTreeProps) {
  const { activeFileId, openFile } = useEditorStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Track expanded state locally (fs provides childrenMap, we own expandedDirs)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const handleToggleDir = useCallback(async (dirPath: string) => {
    const isExpanded = expandedDirs.has(dirPath);
    if (!isExpanded) {
      await fs.refreshDirectory(dirPath);
    }
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  }, [expandedDirs, fs]);

  const handleOpenFile = useCallback(async (entry: FileEntry) => {
    try {
      const content = await fs.openFile(entry.path);
      openFile({ id: entry.path, name: entry.name, path: entry.path, content });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [fs, openFile]);

  const handleRefresh = useCallback(() => {
    fs.loadDirectory(fs.currentPath ?? undefined).catch(console.error);
  }, [fs]);

  const rootName =
    fs.workspaceRoot
      ? fs.workspaceRoot.split('/').pop()?.split('\\').pop() ?? fs.workspaceRoot
      : 'Workspace';

  // ── No workspace yet ─────────────────────────────────────────────────────
  if (!fs.workspaceRoot && !fs.loading) {
    return (
      <div className="wft-empty-state">
        <div className="wft-empty-icon">📂</div>
        <p className="wft-empty-text">Connecting to workspace…</p>
      </div>
    );
  }

  return (
    <div className="wft-root">
      {/* Header */}
      <div className="wft-header">
        <span className="wft-root-name" title={fs.workspaceRoot ?? undefined}>
          {rootName}
        </span>
        <div className="wft-header-actions">
          <button
            className="wft-icon-btn"
            title="Refresh"
            onClick={handleRefresh}
          >
            ↺
          </button>
          <button
            className={`wft-icon-btn ${showUpload ? 'wft-icon-btn--active' : ''}`}
            title="Upload files"
            onClick={() => setShowUpload((v) => !v)}
          >
            ⬆
          </button>
        </div>
      </div>

      {/* Upload zone (collapsible) */}
      {showUpload && fs.workspaceRoot && (
        <div className="wft-upload-zone">
          <FileUpload
            destDir={fs.workspaceRoot}
            token={token}
            onSuccess={handleRefresh}
            onDone={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Tree body */}
      <div className="wft-body">
        {fs.loading && (
          <div className="wft-loading">
            <span className="wft-spinner">⟳</span> Loading…
          </div>
        )}
        {fs.error && (
          <div className="wft-error">
            ⚠ {fs.error}
            <button className="wft-error-dismiss" onClick={fs.clearError}>✕</button>
          </div>
        )}
        {!fs.loading && !fs.error && fs.entries.length === 0 && (
          <div className="wft-empty-dir">(empty workspace)</div>
        )}
        {!fs.loading &&
          fs.entries.map((entry) => (
            <WebFileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              expandedDirs={expandedDirs}
              childrenMap={fs.childrenMap}
              activeFileId={activeFileId}
              onToggleDir={(p) => handleToggleDir(p).catch(console.error)}
              onOpenFile={(e) => handleOpenFile(e).catch(console.error)}
              onContextMenu={(e, x, y) => setContextMenu({ entry: e, x, y })}
              onRefresh={handleRefresh}
            />
          ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <WebContextMenu
          entry={contextMenu.entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          fs={fs}
          token={token}
        />
      )}
    </div>
  );
}
