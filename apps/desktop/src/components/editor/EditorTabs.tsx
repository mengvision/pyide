import { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import styles from './EditorTabs.module.css';

let untitledCounter = 1;

export function EditorTabs() {
  const { files, activeFileId, setActiveFile, closeFile, openFile } = useEditorStore();

  const handleTabClick = useCallback(
    (id: string) => {
      setActiveFile(id);
    },
    [setActiveFile],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      closeFile(id);
    },
    [closeFile],
  );

  const handleNewFile = useCallback(() => {
    const id = `untitled-${Date.now()}`;
    const name = `untitled-${untitledCounter++}.py`;
    openFile({ id, name, path: '', content: '' });
  }, [openFile]);

  return (
    <div className={styles.tabBar} role="tablist">
      {files.map((file) => (
        <div
          key={file.id}
          role="tab"
          aria-selected={file.id === activeFileId}
          className={`${styles.tab}${file.id === activeFileId ? ` ${styles.active}` : ''}`}
          onClick={() => handleTabClick(file.id)}
          title={file.path || file.name}
        >
          {file.isDirty && <span className={styles.dirtyDot} title="Unsaved changes" />}
          <span className={styles.tabName}>{file.name}</span>
          <button
            className={styles.closeBtn}
            onClick={(e) => handleClose(e, file.id)}
            aria-label={`Close ${file.name}`}
            tabIndex={-1}
          >
            ×
          </button>
        </div>
      ))}
      <button className={styles.addBtn} onClick={handleNewFile} aria-label="New file" title="New untitled file">
        +
      </button>
    </div>
  );
}
