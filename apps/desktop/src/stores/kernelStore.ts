import { create } from 'zustand';
import type { VariableInfo, OutputData } from '@pyide/protocol/kernel';

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
  lastError: LastError | null;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setExecuting: (executing: boolean) => void;
  setPort: (port: number | null) => void;
  setVariables: (variables: VariableInfo[]) => void;
  addOutput: (cellId: string, output: OutputData) => void;
  clearOutputs: (cellId?: string) => void;
  incrementExecutionCount: () => void;
  setCurrentExecutingCellId: (cellId: string | null) => void;
  setLastError: (error: LastError | null) => void;
}

export const useKernelStore = create<KernelState>((set) => ({
  connectionStatus: 'disconnected',
  isExecuting: false,
  kernelPort: null,
  variables: [],
  outputs: {},
  executionCount: 0,
  currentExecutingCellId: null,
  lastError: null,

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

  setLastError: (error) =>
    set(() => ({ lastError: error })),
}));
