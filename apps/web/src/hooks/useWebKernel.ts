/**
 * useWebKernel
 *
 * Web-specific kernel hook. Combines WebKernelClient (WebSocket) with
 * kernelApi (REST lifecycle calls).
 *
 * Lifecycle:
 *  1. On mount (when token is available): call startKernel REST API.
 *  2. Connect the WebSocket using the returned kernel_id and ws_url.
 *  3. Expose executeCode / interrupt / restart / stop.
 *  4. Auto-reconnect is handled by WebKernelClient itself.
 *  5. On unmount: disconnect WS and stop the kernel via REST.
 *
 * State is stored in the shared kernelStore (same store the desktop app uses)
 * so all shared desktop components (editor output panels, etc.) work as-is.
 *
 * Exposed interface matches useLocalKernel / useRemoteKernel so it can be
 * dropped into KernelContext without changing shared components.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useKernelStore } from '@desktop/stores/kernelStore';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import { routeStreamMessage } from '@desktop/utils/outputRouter';
import { WebKernelClient } from '../services/WebKernelClient';
import {
  startKernel as apiStartKernel,
  stopKernel as apiStopKernel,
  restartKernel as apiRestartKernel,
  getWsToken,
} from '../services/kernelApi';
import type { VariableInfo } from '@pyide/protocol/kernel';
import type { ConnectionStatus } from '../services/WebKernelClient';

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useWebKernel
 *
 * Call this hook inside the authenticated section of the app.
 * It requires `token` (JWT) to be non-null — do not call when unauthenticated.
 */
export function useWebKernel(token: string | null) {
  const clientRef = useRef<WebKernelClient | null>(null);
  /** Tracks a client that is mid-connect so cleanup can reach it before clientRef is set. */
  const pendingClientRef = useRef<WebKernelClient | null>(null);
  const kernelIdRef = useRef<string | null>(null);
  /** Whether startKernel has been called (prevents double-start). */
  const startingRef = useRef(false);

  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const {
    setConnectionStatus,
    setExecuting,
    setPort,
    setVariables,
    addOutput,
    incrementExecutionCount,
    connectionStatus,
  } = useKernelStore();

  // Local extended status (includes 'error' state that kernelStore doesn't have)
  const [extStatus, setExtStatus] = useState<ConnectionStatus>('disconnected');

  // ── Internal helpers ───────────────────────────────────────────────────────

  const _syncStatus = useCallback((s: ConnectionStatus) => {
    setExtStatus(s);
    // Map 'error' to 'disconnected' for kernelStore which only knows 3 states
    if (s === 'error') {
      setConnectionStatus('disconnected');
    } else {
      setConnectionStatus(s);
    }
  }, [setConnectionStatus]);

  // ── Start kernel ───────────────────────────────────────────────────────────

  const startKernel = useCallback(async () => {
    if (!token) {
      console.warn('[useWebKernel] startKernel called without a token');
      return;
    }
    if (startingRef.current) return;
    if (clientRef.current && clientRef.current.status !== 'disconnected') return;
  
    startingRef.current = true;
    _syncStatus('connecting');
  
    try {
      // 1. Ask the server to start a kernel
      const { kernel_id } = await apiStartKernel(serverUrl, token);
      kernelIdRef.current = kernel_id;
  
      // 2. Obtain a short-lived ws_token for the WebSocket URL
      const wsToken = await getWsToken(serverUrl, token, kernel_id);
  
      // 3. Create and configure the WebSocket client
      const client = new WebKernelClient();
      // Track the pending client so the cleanup function can reach it
      // even if the component unmounts before connect() resolves.
      pendingClientRef.current = client;
  
      client.onStatusChange((s) => {
        _syncStatus(s);
      });
  
      client.onMessage((stream) => {
        const currentCellId = (window as any).__executingCellId ?? 'stream';
        const routed = routeStreamMessage(stream);
        addOutput(currentCellId, routed);
      });
  
      // 4. Connect WebSocket using the opaque session token
      //    Provide a fetchWsToken callback so reconnects get a fresh token.
      await client.connect(
        serverUrl,
        kernel_id,
        wsToken,
        () => getWsToken(serverUrl, token, kernel_id),
      );
  
      pendingClientRef.current = null;
      clientRef.current = client;
      setPort(null); // Remote kernel — no local port
    } catch (err) {
      pendingClientRef.current = null;
      console.error('[useWebKernel] Failed to start kernel:', err);
      _syncStatus('error');
  
      const message = err instanceof Error ? err.message : 'Unknown error';
      addOutput('stream', {
        type: 'text',
        data: {
          text:
            `[Web Kernel Error] ${message}\n` +
            'Please check:\n' +
            '  \u2022 Server URL in Settings\n' +
            '  \u2022 You are logged in\n',
          mime: 'text/plain',
        },
        timestamp: Date.now(),
      });
    } finally {
      startingRef.current = false;
    }
  }, [token, serverUrl, _syncStatus, addOutput, setPort]);

  // ── Execute code ───────────────────────────────────────────────────────────

  const executeCode = useCallback(
    async (code: string, cellId?: string) => {
      if (!clientRef.current) {
        console.warn('[useWebKernel] executeCode: no kernel client');
        return;
      }

      setExecuting(true);
      if (cellId) (window as any).__executingCellId = cellId;

      try {
        const result = await clientRef.current.execute(code, cellId);
        incrementExecutionCount();

        // Refresh variable panel
        try {
          const vars = await clientRef.current.inspectAll();
          setVariables((vars?.variables ?? []) as VariableInfo[]);
        } catch {
          // Non-fatal
        }

        return result;
      } catch (err) {
        console.error('[useWebKernel] Execution error:', err);
        throw err;
      } finally {
        setExecuting(false);
        if (cellId) (window as any).__executingCellId = undefined;
      }
    },
    [setExecuting, setVariables, incrementExecutionCount],
  );

  // ── Interrupt ──────────────────────────────────────────────────────────────

  const interruptExecution = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.interrupt();
    } catch (err) {
      console.error('[useWebKernel] Interrupt error:', err);
    }
  }, []);

  // ── Inspect all variables ──────────────────────────────────────────────────

  const inspectAll = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const vars = await clientRef.current.inspectAll();
      setVariables((vars?.variables ?? []) as VariableInfo[]);
    } catch {
      // Non-fatal
    }
  }, [setVariables]);

  // ── Stop kernel ────────────────────────────────────────────────────────────

  const stopKernel = useCallback(async () => {
    clientRef.current?.disconnect();
    clientRef.current = null;

    if (token && kernelIdRef.current) {
      try {
        await apiStopKernel(serverUrl, token, kernelIdRef.current);
      } catch (err) {
        console.warn('[useWebKernel] stopKernel API error:', err);
      }
      kernelIdRef.current = null;
    }

    _syncStatus('disconnected');
    setPort(null);
  }, [token, serverUrl, _syncStatus, setPort]);

  // ── Restart kernel ─────────────────────────────────────────────────────────

  const restartKernel = useCallback(async () => {
    if (!token || !kernelIdRef.current) {
      // No running kernel — just start a fresh one
      await startKernel();
      return;
    }

    // Disconnect the current WebSocket without stopping the kernel process;
    // the restart API will handle the stop+start server-side.
    clientRef.current?.disconnect();
    clientRef.current = null;

    _syncStatus('connecting');

    try {
      const { kernel_id } = await apiRestartKernel(serverUrl, token, kernelIdRef.current);
      kernelIdRef.current = kernel_id;

      // Fetch a fresh ws_token for the new kernel
      const wsToken = await getWsToken(serverUrl, token, kernel_id);

      const client = new WebKernelClient();
      pendingClientRef.current = client;

      client.onStatusChange((s) => _syncStatus(s));
      client.onMessage((stream) => {
        const currentCellId = (window as any).__executingCellId ?? 'stream';
        addOutput(currentCellId, routeStreamMessage(stream));
      });

      await client.connect(
        serverUrl,
        kernel_id,
        wsToken,
        () => getWsToken(serverUrl, token, kernel_id),
      );
      pendingClientRef.current = null;
      clientRef.current = client;
      setPort(null);
    } catch (err) {
      pendingClientRef.current = null;
      console.error('[useWebKernel] restartKernel error:', err);
      _syncStatus('error');
    }
  }, [token, serverUrl, _syncStatus, addOutput, setPort, startKernel]);

  // ── Auto-start on mount when authenticated ─────────────────────────────────

  useEffect(() => {
    if (token) {
      startKernel();
    }
    return () => {
      // Disconnect any client that is mid-connect (pendingClientRef) as well as
      // any fully-connected client (clientRef).  This prevents a WebSocket leak
      // if the component unmounts during the async connect phase.
      pendingClientRef.current?.disconnect();
      pendingClientRef.current = null;
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Re-connect if serverUrl changes while authenticated
  useEffect(() => {
    if (!token) return;
    // If there's an active client, disconnect and restart with new URL
    if (clientRef.current) {
      stopKernel().then(() => startKernel());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  return {
    startKernel,
    stopKernel,
    restartKernel,
    executeCode,
    interruptExecution,
    inspectAll,
    connectionStatus,
    extConnectionStatus: extStatus,
    kernelId: kernelIdRef.current,
    client: clientRef,
  };
}
