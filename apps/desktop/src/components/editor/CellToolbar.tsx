import { useEffect, useRef, useState, useCallback } from 'react';
import type * as MonacoTypes from 'monaco-editor';
import styles from './CellToolbar.module.css';

interface CellToolbarProps {
  editor: MonacoTypes.editor.IStandaloneCodeEditor | null;
  cellStartLines: number[]; // 1-based line numbers for each cell separator
  onRunCell: (cellIndex: number) => void;
  onRunCellAndAdvance: (cellIndex: number) => void;
  onStopExecution: () => void;
}

interface ToolbarState {
  visible: boolean;
  top: number;
  cellIndex: number;
}

export function CellToolbar({
  editor,
  cellStartLines,
  onRunCell,
  onRunCellAndAdvance,
  onStopExecution,
}: CellToolbarProps) {
  const [state, setState] = useState<ToolbarState>({ visible: false, top: 0, cellIndex: 0 });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setState((s) => ({ ...s, visible: false }));
    }, 300);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!editor) return;

    const disposable = editor.onMouseMove((e) => {
      if (!e.target.position) return;

      const lineNumber = e.target.position.lineNumber;
      const cellIndex = cellStartLines.indexOf(lineNumber);
      if (cellIndex !== -1) {
        clearHideTimer();
        const top = editor.getTopForLineNumber(lineNumber);
        setState({ visible: true, top, cellIndex });
      } else {
        scheduleHide();
      }
    });

    const leaveDisposable = editor.onMouseLeave(() => {
      scheduleHide();
    });

    return () => {
      disposable.dispose();
      leaveDisposable.dispose();
      clearHideTimer();
    };
  }, [editor, cellStartLines, clearHideTimer, scheduleHide]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  const handleMouseEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handleMouseLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  return (
    <div
      ref={toolbarRef}
      className={`${styles.toolbar}${state.visible ? '' : ` ${styles.hidden}`}`}
      style={{ top: state.top, right: 12 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`${styles.toolbarBtn} ${styles.run}`}
        onClick={() => onRunCell(state.cellIndex)}
        title="Run cell (Ctrl+Shift+Enter)"
      >
        <span className={styles.toolbarIcon}>▶</span>
        Run
      </button>

      <button
        className={`${styles.toolbarBtn} ${styles.run}`}
        onClick={() => onRunCellAndAdvance(state.cellIndex)}
        title="Run cell and advance (Shift+Enter)"
      >
        <span className={styles.toolbarIcon}>⏩</span>
        Run & Advance
      </button>

      <div className={styles.separator} />

      <button
        className={`${styles.toolbarBtn} ${styles.stop}`}
        onClick={onStopExecution}
        title="Stop execution"
      >
        <span className={styles.toolbarIcon}>⏹</span>
        Stop
      </button>
    </div>
  );
}
