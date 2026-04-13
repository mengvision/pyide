import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as MonacoTypes from 'monaco-editor';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { parseCells } from '../../utils/cellParser';
import styles from './CellEditor.module.css';

interface CellEditorProps {
  onRunCell?: (code: string, cellIndex: number) => void;
  onCellToolbarPositionChange?: (positions: CellToolbarPosition[]) => void;
}

export interface CellEditorHandle {
  getEditor: () => MonacoTypes.editor.IStandaloneCodeEditor | null;
}

export interface CellToolbarPosition {
  cellIndex: number;
  lineNumber: number;
  top: number;
}

function getLanguageForFile(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    default:
      return 'python';
  }
}

export const CellEditor = forwardRef<CellEditorHandle, CellEditorProps>(function CellEditor(
  { onRunCell, onCellToolbarPositionChange }: CellEditorProps,
  ref,
) {
  const { files, activeFileId, updateFileContent, setCells, setCurrentCellIndex } =
    useEditorStore();
  const { theme, vimMode, fontSize, tabSize } = useSettingsStore();

  const editorRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vimModeInstanceRef = useRef<{ dispose: () => void } | null>(null);
  const vimStatusBarRef = useRef<HTMLDivElement | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  // Apply cell decorations to Monaco
  const applyDecorations = useCallback(
    (editor: MonacoTypes.editor.IStandaloneCodeEditor, parsedCells: ReturnType<typeof parseCells>) => {
      const newDecorations: MonacoTypes.editor.IModelDeltaDecoration[] = [];
      const model = editor.getModel();

      for (const cell of parsedCells) {
        if (cell.startLine > 0 || parsedCells.indexOf(cell) === 0) {
          // Monaco lines are 1-based
          const lineNumber = cell.startLine + 1;
          // Check if line starts with #%% for extra delimiter styling
          const lineContent = model ? model.getLineContent(lineNumber) : '';
          const isDelimiter = lineContent.trimStart().startsWith('#%%');

          newDecorations.push({
            range: {
              startLineNumber: lineNumber,
              startColumn: 1,
              endLineNumber: lineNumber,
              endColumn: Math.max(1, lineContent.length + 1),
            },
            options: {
              isWholeLine: true,
              className: 'cell-separator',
              linesDecorationsClassName: 'cell-indicator',
              ...(isDelimiter && {
                overviewRuler: {
                  color: 'rgba(59, 130, 246, 0.8)',
                  position: 1, // OverviewRulerLane.Left
                },
              }),
            },
          });
        }
      }

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

      // Emit toolbar positions
      if (onCellToolbarPositionChange) {
        const positions: CellToolbarPosition[] = parsedCells.map((cell) => ({
          cellIndex: cell.index,
          lineNumber: cell.startLine + 1,
          top: editor.getTopForLineNumber(cell.startLine + 1),
        }));
        onCellToolbarPositionChange(positions);
      }
    },
    [onCellToolbarPositionChange],
  );

  // Init / dispose vim mode
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (vimMode) {
      import('monaco-vim').then(({ initVimMode }) => {
        if (vimModeInstanceRef.current) {
          vimModeInstanceRef.current.dispose();
        }
        if (vimStatusBarRef.current) {
          vimModeInstanceRef.current = initVimMode(editor, vimStatusBarRef.current);
        }
      });
    } else {
      if (vimModeInstanceRef.current) {
        vimModeInstanceRef.current.dispose();
        vimModeInstanceRef.current = null;
      }
    }

    return () => {
      // No cleanup here — cleanup on vimMode toggle above
    };
  }, [vimMode]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Initialize vim if needed
      if (vimMode) {
        import('monaco-vim').then(({ initVimMode }) => {
          if (vimStatusBarRef.current) {
            vimModeInstanceRef.current = initVimMode(editor, vimStatusBarRef.current);
          }
        });
      }

      // Ctrl+S — save (mark saved)
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const state = useEditorStore.getState();
          if (state.activeFileId) {
            state.markFileSaved(state.activeFileId);
          }
        },
      );

      // Ctrl+Shift+Enter — run current cell
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
        () => {
          const state = useEditorStore.getState();
          const cell = state.cells[state.currentCellIndex];
          if (cell && onRunCell) {
            onRunCell(cell.code, cell.index);
          }
        },
      );

      // Shift+Enter — run current cell and advance to next
      editor.addCommand(
        monaco.KeyMod.Shift | monaco.KeyCode.Enter,
        () => {
          const state = useEditorStore.getState();
          const cell = state.cells[state.currentCellIndex];
          if (cell && onRunCell) {
            onRunCell(cell.code, cell.index);
          }
          // Advance cursor to next cell
          const nextCell = state.cells[state.currentCellIndex + 1];
          if (nextCell) {
            editor.setPosition({ lineNumber: nextCell.startLine + 1, column: 1 });
            editor.revealLineInCenter(nextCell.startLine + 1);
            state.setCurrentCellIndex(nextCell.index);
          }
        },
      );

      // Ctrl+Enter — run current line/selection (per project keyboard decisions)
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => {
          const selection = editor.getSelection();
          const model = editor.getModel();
          if (!model || !selection) return;

          const selectedText = model.getValueInRange(selection);
          if (selectedText.trim()) {
            if (onRunCell) onRunCell(selectedText, -1);
          } else {
            // Run current line
            const lineNumber = selection.startLineNumber;
            const lineContent = model.getLineContent(lineNumber);
            if (onRunCell) onRunCell(lineContent, -1);
          }
        },
      );

      // Track cursor → update current cell index
      editor.onDidChangeCursorPosition((e) => {
        const lineIndex = e.position.lineNumber - 1; // 0-based
        const state = useEditorStore.getState();
        const currentCells = state.cells;

        let foundIndex = 0;
        for (let i = currentCells.length - 1; i >= 0; i--) {
          if (lineIndex >= currentCells[i].startLine) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex !== state.currentCellIndex) {
          state.setCurrentCellIndex(foundIndex);
        }
      });

      // Initial parse on mount
      if (activeFile) {
        const parsed = parseCells(activeFile.content);
        setCells(parsed);
        applyDecorations(editor, parsed);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRunCell, applyDecorations],
  );

  const handleContentChange = useCallback(
    (value: string | undefined) => {
      if (!activeFileId || value === undefined) return;

      updateFileContent(activeFileId, value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const parsed = parseCells(value);
        setCells(parsed);
        if (editorRef.current) {
          applyDecorations(editorRef.current, parsed);
        }
      }, 300);
    },
    [activeFileId, updateFileContent, setCells, applyDecorations],
  );

  // When active file changes, re-parse and re-decorate
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;
    const parsed = parseCells(activeFile.content);
    setCells(parsed);
    applyDecorations(editorRef.current, parsed);
  }, [activeFileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose editor instance via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
  }));

  // Cleanup vim on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (vimModeInstanceRef.current) vimModeInstanceRef.current.dispose();
    };
  }, []);

  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';
  const language = activeFile ? getLanguageForFile(activeFile.name) : 'python';

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorWrapper}>
        <Editor
          height="100%"
          language={language}
          theme={monacoTheme}
          value={activeFile?.content ?? ''}
          onMount={handleEditorMount}
          onChange={handleContentChange}
          options={{
            fontSize,
            tabSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            folding: true,
            glyphMargin: true,
            lineDecorationsWidth: 5,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
      {vimMode && (
        <div className={styles.vimStatusBar} ref={vimStatusBarRef} />
      )}
    </div>
  );
});

export type { CellEditorProps };
