import { useRef, useCallback, useState, useEffect } from 'react';
import type * as MonacoTypes from 'monaco-editor';
import { useEditorStore } from '../../stores/editorStore';
import { EditorTabs } from './EditorTabs';
import { CellEditor, CellEditorHandle } from './CellEditor';
import { CellToolbar } from './CellToolbar';
import { useKernelContext } from '../../contexts/KernelContext';
import { OutputPanel } from '../output/OutputPanel';
import styles from './EditorPanel.module.css';

interface EditorPanelProps {
  onRunCell?: (code: string, cellIndex: number) => void;
}

export function EditorPanel({ onRunCell }: EditorPanelProps) {
  const { files, activeFileId, cells, setCurrentCellIndex } = useEditorStore();
  const cellEditorRef = useRef<CellEditorHandle>(null);
  const [editorInstance, setEditorInstance] = useState<MonacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const { startKernel, executeCode, interruptExecution } = useKernelContext();

  // Auto-start kernel when the panel mounts
  useEffect(() => {
    startKernel();
  }, [startKernel]);

  const hasFiles = files.length > 0 && activeFileId !== null;

  // Cell start lines (1-based) for CellToolbar
  const cellStartLines = cells.map((c) => c.startLine + 1);

  const handleRunCell = useCallback(
    (code: string, cellIndex: number) => {
      // Use a stable cell id derived from the file + cell index
      const cell = cells[cellIndex];
      const cellId = cell ? `cell-${activeFileId ?? 'file'}-${cellIndex}` : undefined;

      // Execute via kernel; fall back to prop callback if provided
      if (onRunCell) {
        onRunCell(code, cellIndex);
      }
      executeCode(code, cellId).catch((err) => {
        console.error('[EditorPanel] Cell execution error:', err);
      });
    },
    [onRunCell, executeCode, cells, activeFileId],
  );

  const handleRunCellByIndex = useCallback(
    (cellIndex: number) => {
      const cell = cells[cellIndex];
      if (!cell) return;
      handleRunCell(cell.code, cellIndex);
    },
    [cells, handleRunCell],
  );

  const handleRunCellAndAdvance = useCallback(
    (cellIndex: number) => {
      const cell = cells[cellIndex];
      if (!cell) return;
      handleRunCell(cell.code, cellIndex);

      // Advance cursor to next cell
      const nextCell = cells[cellIndex + 1];
      if (nextCell) {
        const editor = cellEditorRef.current?.getEditor();
        if (editor) {
          editor.setPosition({ lineNumber: nextCell.startLine + 1, column: 1 });
          editor.revealLineInCenter(nextCell.startLine + 1);
        }
        setCurrentCellIndex(nextCell.index);
      }
    },
    [cells, handleRunCell, setCurrentCellIndex],
  );

  const handleStopExecution = useCallback(() => {
    interruptExecution();
  }, [interruptExecution]);

  // Get editor instance after CellEditor mounts (called on first position update)
  const handleCellToolbarPositionChange = useCallback(() => {
    if (!editorInstance) {
      const editor = cellEditorRef.current?.getEditor();
      if (editor) setEditorInstance(editor);
    }
  }, [editorInstance]);

  return (
    <div className={styles.panel}>
      <EditorTabs />

      <div className={styles.editorArea}>
        {hasFiles ? (
          <>
            <CellEditor
              ref={cellEditorRef}
              onRunCell={handleRunCell}
              onCellToolbarPositionChange={handleCellToolbarPositionChange}
            />
            <CellToolbar
              editor={editorInstance}
              cellStartLines={cellStartLines}
              onRunCell={handleRunCellByIndex}
              onRunCellAndAdvance={handleRunCellAndAdvance}
              onStopExecution={handleStopExecution}
            />
          </>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>📄</span>
            <span>Open a file to get started</span>
            <span className={styles.emptyStateHint}>Use the file explorer on the left or click + to create a new file</span>
          </div>
        )}
      </div>

      <OutputPanel />
    </div>
  );
}
