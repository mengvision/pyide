import { useEffect, useRef, useCallback } from 'react';
import { usePlatform } from '@pyide/platform';
import { KernelClient } from '../services/KernelClient';
import { useKernelStore } from '../stores/kernelStore';
import { useEditorStore } from '../stores/editorStore';
import { useUiStore } from '../stores/uiStore';
import { useEnvStore } from '../stores/envStore';
import { useSettingsStore } from '../stores/settingsStore';
import { routeStreamMessage } from '../utils/outputRouter';
import { useRemoteKernel } from './useRemoteKernel';
import type { VariableInfo, OutputData } from '@pyide/protocol/kernel';

/**
 * Resolves the absolute path to packages/pykernel relative to the running
 * executable / dev server. In development Tauri serves from the workspace
 * root, so we use a path relative to the app's resource dir.
 * The Tauri command also accepts an absolute path from the frontend.
 */
function resolvePykernelPath(): string {
  // During development the vite dev-server CWD is apps/desktop, so going two
  // levels up lands at the workspace root.
  // In production the app bundle is at a different location but Task 8 will
  // address bundling; for now use the development-time relative path.
  return '../../packages/pykernel';
}

// ── Local kernel hook ─────────────────────────────────────────────────────────

function useLocalKernel() {
  const clientRef = useRef<KernelClient | null>(null);
  const platform = usePlatform();
  const kernelMode = useUiStore((s) => s.kernelMode);
  const {
    setConnectionStatus,
    setExecuting,
    setPort,
    setVariables,
    addOutput,
    incrementExecutionCount,
    setLastExecutedCellId,
    connectionStatus,
    addReplEntry,
    appendReplOutput,
    addInputHistory,
  } = useKernelStore();

  // ── Disconnect local client when switching to remote mode ────────────────

  useEffect(() => {
    if (kernelMode === 'remote' && clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  }, [kernelMode]);

  // ── Start kernel ────────────────────────────────────────────────────────

  const startKernel = useCallback(async () => {
    // Don't start local kernel if not in local mode
    if (useUiStore.getState().kernelMode !== 'local') return;

    // Avoid double-starting
    if (clientRef.current && clientRef.current.status !== 'disconnected') {
      return;
    }

    try {
      if (useUiStore.getState().kernelMode === 'local') {
        setConnectionStatus('connecting');
      }

      const info = await platform.kernel.start(resolvePykernelPath(), null);

      // Check mode again after async kernel start
      if (useUiStore.getState().kernelMode !== 'local') {
        try { await platform.kernel.stop(); } catch { /* ignore */ }
        return;
      }

      setPort(info.port);

      const client = new KernelClient(info.port);

      client.setStatusCallback((status) => {
        // Only update global connection status if local is the active mode
        if (useUiStore.getState().kernelMode === 'local') {
          setConnectionStatus(status);
        }
      });

      client.setStreamCallback((stream) => {
        const cellId =
          stream.cell_id ??
          (window as any).__executingCellId ??
          useKernelStore.getState().lastExecutedCellId ??
          'stream';
        console.log('[StreamCallback]', cellId, stream);
        const routed = routeStreamMessage(stream);
        addOutput(cellId, routed);

        // 同时追加到 REPL 历史
        const replEntryId = (window as any).__currentReplEntryId;
        if (replEntryId) {
          appendReplOutput(replEntryId, routed);
        }
      });

      // Set ref BEFORE connect so cleanup can always find and disconnect it
      clientRef.current = client;

      try {
        await client.connect();
      } catch (connectErr) {
        // Connect failed - disconnect to stop zombie reconnection loop
        client.disconnect();
        clientRef.current = null;
        console.error('[useLocalKernel] WebSocket connect failed:', connectErr);
        if (useUiStore.getState().kernelMode === 'local') {
          setConnectionStatus('disconnected');
        }
        return;
      }

      // Double-check mode hasn't changed during async connect
      if (useUiStore.getState().kernelMode !== 'local') {
        client.disconnect();
        clientRef.current = null;
        return;
      }

      // Fetch kernel info (Python version) after successful connection
      try {
        const kernelInfo = await client.kernelInfo();
        if (kernelInfo?.python_version) {
          useEnvStore.getState().setActiveVenv({
            name: 'System Python',
            path: kernelInfo.python_path || '',
            pythonVersion: kernelInfo.python_version,
          });
        }
      } catch (e) {
        console.warn('[useLocalKernel] Failed to get kernel info:', e);
      }
    } catch (err) {
      console.error('[useLocalKernel] Failed to start kernel:', err);
      if (useUiStore.getState().kernelMode === 'local') {
        setConnectionStatus('disconnected');
      }
    }
  }, [setConnectionStatus, setPort, addOutput]);

  // ── Execute code ─────────────────────────────────────────────────────────

  const executeCode = useCallback(
    async (code: string, cellId?: string) => {
      if (!clientRef.current) {
        console.warn('[useLocalKernel] executeCode called but no kernel client');
        return;
      }

      setExecuting(true);
      const entryId = crypto.randomUUID();
      const currentCount = useKernelStore.getState().executionCount + 1;
      addReplEntry({
        id: entryId,
        code,
        outputs: [],
        executionCount: currentCount,
        timestamp: Date.now(),
      });
      (window as any).__currentReplEntryId = entryId;
      addInputHistory(code);
      const effectiveCellId = cellId ?? (() => {
        const { cells, activeFileId, currentCellIndex } = useEditorStore.getState();
        const cell = cells[currentCellIndex];
        return cell ? `cell-${activeFileId ?? 'file'}-${currentCellIndex}` : 'stream';
      })();
      setLastExecutedCellId(effectiveCellId);
      (window as any).__executingCellId = effectiveCellId;

      try {
        const result = await clientRef.current.execute(code, effectiveCellId);

        // Increment execution counter
        incrementExecutionCount();

        // If execution returned an error (e.g. NameError, TypeError), add it to outputs
        if (result && result.status === 'error' && result.error) {
          const errorOutput: OutputData = {
            type: 'error',
            data: {
              text: result.error.data?.traceback?.join('\n') ?? result.error.message ?? 'Unknown error',
              ename: result.error.data?.ename,
              evalue: result.error.data?.evalue,
              traceback: result.error.data?.traceback,
            },
            timestamp: Date.now(),
          };
          // Add to cell outputs (legacy)
          addOutput(effectiveCellId, errorOutput);
          // Add to REPL history
          const currentEntryId = (window as any).__currentReplEntryId;
          if (currentEntryId) {
            appendReplOutput(currentEntryId, errorOutput);
          }
        }

        // Refresh variable list after each execution
        try {
          const vars = await clientRef.current.inspectAll();
          setVariables((vars?.variables ?? []) as VariableInfo[]);
        } catch {
          // Non-fatal — variable panel will just be stale
        }

        return result;
      } catch (err) {
        console.error('[useLocalKernel] Execution error:', err);
        throw err;
      } finally {
        setExecuting(false);
        (window as any).__executingCellId = undefined;
        (window as any).__currentReplEntryId = undefined;
      }
    },
    [setExecuting, setVariables, incrementExecutionCount, setLastExecutedCellId, addReplEntry, appendReplOutput, addInputHistory],
  );

  // ── Interrupt ─────────────────────────────────────────────────────────────

  const interruptExecution = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      // First attempt a graceful interrupt via the WebSocket protocol
      await clientRef.current.interrupt();
    } catch {
      // If the WebSocket method fails (e.g. kernel hung), fall back to the
      // Rust-level kill via Tauri (kernel.rs interrupt_kernel)
      try {
        await platform.kernel.interrupt();
      } catch (err) {
        console.error('[useLocalKernel] Interrupt error:', err);
      }
    }
  }, []);

  // ── Inspect all variables ────────────────────────────────────────────────

  const inspectAll = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const vars = await clientRef.current.inspectAll();
      setVariables((vars?.variables ?? []) as VariableInfo[]);
    } catch {
      // Non-fatal
    }
  }, [setVariables]);

  // ── Stop kernel ──────────────────────────────────────────────────────────

  const stopKernel = useCallback(async () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    try {
      await platform.kernel.stop();
    } catch (err) {
      console.error('[useLocalKernel] Stop kernel error:', err);
    }
    if (useUiStore.getState().kernelMode === 'local') {
      setConnectionStatus('disconnected');
    }
    setPort(null);
  }, [setConnectionStatus, setPort]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return {
    startKernel,
    stopKernel,
    executeCode,
    interruptExecution,
    inspectAll,
    connectionStatus,
    client: clientRef,
  };
}

// ── Dual-mode dispatcher ──────────────────────────────────────────────────────

/**
 * useKernel — selects between local and remote kernel mode based on the
 * `kernelMode` setting in uiStore.
 *
 * IMPORTANT: Both `useLocalKernel` and `useRemoteKernel` are always called
 * (Rules of Hooks — no conditional hook calls). The returned interface is
 * chosen based on the current mode. Each hook independently manages its own
 * connection lifecycle; only the active mode's hook will actually be connected.
 *
 * Exposed interface (identical for both modes):
 *   - startKernel()
 *   - stopKernel()
 *   - executeCode(code, cellId?)
 *   - interruptExecution()
 *   - inspectAll()
 *   - connectionStatus
 *   - client  (ref to the underlying client, may be null when disconnected)
 */
export function useKernel() {
  const kernelMode = useUiStore((s) => s.kernelMode);
  // Read serverUrl so we can reset the remote client when it changes
  useSettingsStore((s) => s.serverUrl);

  // Always call both hooks unconditionally to satisfy Rules of Hooks
  const local = useLocalKernel();
  const remote = useRemoteKernel();

  if (kernelMode === 'remote') {
    return remote;
  }
  return local;
}
