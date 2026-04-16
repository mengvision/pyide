import { create } from 'zustand';
import type { VariableInfo, OutputData, ReplEntry } from '@pyide/protocol/kernel';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface LastError {
  traceback: string;
  cellCode: string;
}

interface KernelState {
  connectionStatus: ConnectionStatus;
  isExecuting: boolean;
  kernelPort: number | null;
  variables: VariableInfo[];
  outputs: Record<string, OutputData[]>;
  executionCount: number;
  currentExecutingCellId: string | null;
  lastExecutedCellId: string | null;
  lastError: LastError | null;
  replHistory: ReplEntry[];
  inputHistory: string[];

  setConnectionStatus: (status: ConnectionStatus) => void;
  setExecuting: (executing: boolean) => void;
  setPort: (port: number | null) => void;
  setVariables: (variables: VariableInfo[]) => void;
  addOutput: (cellId: string, output: OutputData) => void;
  clearOutputs: (cellId?: string) => void;
  incrementExecutionCount: () => void;
  setCurrentExecutingCellId: (cellId: string | null) => void;
  setLastExecutedCellId: (cellId: string | null) => void;
  setLastError: (error: LastError | null) => void;
  addReplEntry: (entry: ReplEntry) => void;
  appendReplOutput: (entryId: string, output: OutputData) => void;
  clearReplHistory: () => void;
  addInputHistory: (code: string) => void;
  setReplHistory: (history: ReplEntry[]) => void;
}

export const useKernelStore = create<KernelState>((set) => ({
  connectionStatus: 'disconnected',
  isExecuting: false,
  kernelPort: null,
  variables: [],
  outputs: {},
  executionCount: 0,
  currentExecutingCellId: null,
  lastExecutedCellId: null,
  lastError: null,
  replHistory: [],
  inputHistory: [],

  setConnectionStatus: (status: ConnectionStatus) =>
    set(() => ({ connectionStatus: status })),

  setExecuting: (executing) =>
    set(() => ({ isExecuting: executing })),

  setPort: (port) =>
    set(() => ({ kernelPort: port })),

  setVariables: (variables) =>
    set(() => ({ variables })),

  addOutput: (cellId, output) =>
    set((state) => ({
      outputs: {
        ...state.outputs,
        [cellId]: [...(state.outputs[cellId] ?? []), output],
      },
    })),

  clearOutputs: (cellId?: string) =>
    set((state) => {
      if (cellId === undefined) {
        return { outputs: {} };
      }
      const { [cellId]: _removed, ...rest } = state.outputs;
      return { outputs: rest };
    }),

  incrementExecutionCount: () =>
    set((state) => ({ executionCount: state.executionCount + 1 })),

  setCurrentExecutingCellId: (cellId) =>
    set(() => ({ currentExecutingCellId: cellId })),

  setLastExecutedCellId: (cellId) =>
    set(() => ({ lastExecutedCellId: cellId })),

  setLastError: (error) =>
    set(() => ({ lastError: error })),

  addReplEntry: (entry) =>
    set((state) => ({ replHistory: [...state.replHistory, entry] })),

  appendReplOutput: (entryId, output) =>
    set((state) => ({
      replHistory: state.replHistory.map((entry) =>
        entry.id === entryId
          ? { ...entry, outputs: [...entry.outputs, output] }
          : entry
      ),
    })),

  clearReplHistory: () =>
    set(() => ({ replHistory: [] })),

  addInputHistory: (code) =>
    set((state) => ({
      inputHistory: [...state.inputHistory, code].slice(-500),
    })),

  setReplHistory: (history) =>
    set(() => ({ replHistory: history })),
}));
