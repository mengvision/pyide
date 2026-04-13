import { useEffect, useRef, useCallback } from 'react';
import type { OutputData } from '@pyide/protocol/kernel';
import { useKernelStore } from '../../stores/kernelStore';
import { useEditorStore } from '../../stores/editorStore';
import { useUiStore } from '../../stores/uiStore';
import { ResizeHandle } from '../layout/ResizeHandle';
import { TextOutput } from './TextOutput';
import { DataFrameOutput } from './DataFrameOutput';
import { ChartOutput } from './ChartOutput';
import { ErrorOutput } from './ErrorOutput';
import styles from './OutputPanel.module.css';

export function OutputPanel() {
  const { outputs, executionCount, clearOutputs } = useKernelStore();
  const { cells, activeFileId, currentCellIndex } = useEditorStore();
  const { outputPanelHeight, setOutputPanelHeight } = useUiStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive the current cell id
  const currentCell = cells[currentCellIndex];
  const cellId = currentCell
    ? `cell-${activeFileId ?? 'file'}-${currentCellIndex}`
    : 'stream';

  const cellOutputs: OutputData[] = outputs[cellId] ?? [];

  // Auto-scroll to bottom when new outputs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cellOutputs.length]);

  const handleResize = useCallback(
    (delta: number) => {
      // Dragging upward (negative delta) increases height
      setOutputPanelHeight(Math.max(80, outputPanelHeight - delta));
    },
    [outputPanelHeight, setOutputPanelHeight],
  );

  const handleClear = useCallback(() => {
    clearOutputs(cellId);
  }, [clearOutputs, cellId]);

  return (
    <div className={styles.panel} style={{ height: outputPanelHeight }}>
      <ResizeHandle direction="horizontal" onResize={handleResize} />

      <div className={styles.header}>
        <span className={styles.title}>Output</span>
        {executionCount > 0 && (
          <span className={styles.execCounter}>Out [{executionCount}]:</span>
        )}
        <div className={styles.headerSpacer} />
        <button
          className={styles.clearBtn}
          onClick={handleClear}
          title="Clear output"
        >
          🗑️
        </button>
      </div>

      <div className={styles.content} ref={scrollRef}>
        {cellOutputs.length === 0 ? (
          <div className={styles.emptyState}>Run a cell to see output</div>
        ) : (
          cellOutputs.map((output, i) => (
            <div key={i} className={styles.outputItem}>
              <OutputRenderer output={output} cellCode={currentCell?.code} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface OutputRendererProps {
  output: OutputData;
  cellCode?: string;
}

function OutputRenderer({ output, cellCode }: OutputRendererProps) {
  switch (output.type) {
    case 'text':
      return <TextOutput data={output.data} />;
    case 'dataframe':
      return <DataFrameOutput data={output.data} />;
    case 'chart':
      return <ChartOutput data={output.data} />;
    case 'error':
      return <ErrorOutput data={output.data} cellCode={cellCode} />;
    default:
      return <TextOutput data={{ text: JSON.stringify(output.data) }} />;
  }
}
