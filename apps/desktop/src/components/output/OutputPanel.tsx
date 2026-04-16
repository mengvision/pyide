import { useEffect, useRef, useCallback } from 'react';
import type { OutputData } from '@pyide/protocol/kernel';
import { useKernelStore } from '../../stores/kernelStore';
import { useUiStore } from '../../stores/uiStore';
import { ResizeHandle } from '../layout/ResizeHandle';
import { TextOutput } from './TextOutput';
import { DataFrameOutput } from './DataFrameOutput';
import { ChartOutput } from './ChartOutput';
import { ErrorOutput } from './ErrorOutput';
import { LogOutput } from './LogOutput';
import { ReplInput } from './ReplInput';
import styles from './OutputPanel.module.css';

export function OutputPanel() {
  const { replHistory, executionCount, clearReplHistory } = useKernelStore();
  const { outputPanelHeight, setOutputPanelHeight } = useUiStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries/outputs arrive
  const totalOutputs = replHistory.reduce((sum, e) => sum + e.outputs.length, 0);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replHistory.length, totalOutputs]);

  const handleResize = useCallback(
    (delta: number) => {
      setOutputPanelHeight(Math.max(80, outputPanelHeight - delta));
    },
    [outputPanelHeight, setOutputPanelHeight],
  );

  return (
    <div className={styles.panel} style={{ height: outputPanelHeight }}>
      <ResizeHandle direction="horizontal" onResize={handleResize} />

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Console</span>
        {executionCount > 0 && (
          <span className={styles.execCounter}>[{executionCount}]</span>
        )}
        <div className={styles.headerSpacer} />
        <button
          className={styles.clearBtn}
          onClick={clearReplHistory}
          title="Clear console"
        >
          🗑️
        </button>
      </div>

      {/* REPL history content */}
      <div className={styles.content} ref={scrollRef}>
        {replHistory.length === 0 ? (
          <div className={styles.emptyState}>Type code below or run a cell to get started</div>
        ) : (
          replHistory.map((entry) => (
            <div key={entry.id} className={styles.replEntry}>
              {/* Input block with prompt */}
              <div className={styles.inputBlock}>
                <span className={styles.prompt}>In [{entry.executionCount}]:</span>
                <pre className={styles.code}>{entry.code}</pre>
              </div>
              {/* Output block */}
              {entry.outputs.length > 0 && (
                <div className={styles.outputBlock}>
                  {entry.outputs.map((output, i) => (
                    <div key={i} className={styles.outputItem}>
                      <OutputRenderer output={output} cellCode={entry.code} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom REPL input */}
      <ReplInput />
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
    case 'warning':
      return <LogOutput data={output.data} level="warning" />;
    case 'info':
      return <LogOutput data={output.data} level="info" />;
    default:
      return <TextOutput data={{ text: JSON.stringify(output.data) }} />;
  }
}
