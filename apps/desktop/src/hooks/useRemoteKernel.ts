import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlatform } from '@pyide/platform';
import { useKernelStore } from '../stores/kernelStore';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { routeStreamMessage } from '../utils/outputRouter';
import type { VariableInfo } from '@pyide/protocol/kernel';
import { listEnvironmentTemplates } from '../services/environmentService';
import type { EnvironmentTemplate } from '../services/environmentService';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

// ── RemoteKernelClient ────────────────────────────────────────────────────────
// Mirrors KernelClient but connects to a remote server WebSocket endpoint.
// Uses the same JSON-RPC protocol so the server can proxy to the actual kernel.

class RemoteKernelClient {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private streamCallback: ((stream: any) => void) | null = null;
  private statusCallback: ((s: ConnectionStatus) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private destroyed = false;
  private wsUrl: string;
  private wsUrlBuilder: (() => Promise<string>) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(wsUrl: string, wsUrlBuilder?: () => Promise<string>) {
    this.wsUrl = wsUrl;
    this.wsUrlBuilder = wsUrlBuilder ?? null;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  setStreamCallback(cb: (stream: any) => void): void {
    this.streamCallback = cb;
  }

  setStatusCallback(cb: (s: ConnectionStatus) => void): void {
    this.statusCallback = cb;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._setStatus('connecting');

      try {
        this.ws = new WebSocket(this.wsUrl);
      } catch (err) {
        this._setStatus('disconnected');
        reject(new Error(`Failed to create WebSocket: ${String(err)}`));
        return;
      }

      this.ws.onopen = () => {
        this._setStatus('connected');
        this.reconnectAttempts = 0; // Reset on successful connection
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);

          // Stream message — no id field
          if (msg.stream !== undefined) {
            this.streamCallback?.(msg);
            return;
          }

          // RPC response — has id field
          if (msg.id && this.pendingRequests.has(msg.id)) {
            const pending = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message ?? 'Remote kernel error'));
            } else {
              pending.resolve(msg.result);
            }
          }
        } catch (err) {
          console.warn('[RemoteKernelClient] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this._setStatus('disconnected');
        this._rejectAllPending('Remote connection closed');
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        reject(
          new Error(
            'Remote kernel WebSocket connection failed. ' +
            'Check the server URL in Settings and ensure you are logged in.',
          ),
        );
      };
    });
  }

  private _setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusCallback?.(status);
  }

  private _rejectAllPending(reason: string): void {
    const err = new Error(reason);
    this.pendingRequests.forEach(({ reject }) => reject(err));
    this.pendingRequests.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.destroyed) return;
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.warn('[RemoteKernelClient] Max reconnect attempts reached, giving up');
      return;
    }
    // Exponential backoff: 3s, 6s, 12s, ... capped at 30s
    const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[RemoteKernelClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      // Refresh token on reconnect to avoid stale token issues
      if (this.wsUrlBuilder) {
        try {
          this.wsUrl = await this.wsUrlBuilder();
        } catch {
          console.warn('[RemoteKernelClient] Failed to refresh WS URL, using existing');
        }
      }
      this.connect().catch(() => {/* silently retry */});
    }, delay);
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('RemoteKernelClient: not connected to remote kernel');
    }

    const id = crypto.randomUUID();
    return new Promise<any>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Remote request timeout (method: ${method})`));
        }
      }, 30_000);

      this.pendingRequests.set(id, {
        resolve: (v: any) => { clearTimeout(timeoutId); resolve(v); },
        reject: (e: Error) => { clearTimeout(timeoutId); reject(e); },
      });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  // ── Convenience methods (same interface as KernelClient) ──────────────────

  execute(code: string, cellId?: string): Promise<any> {
    return this.send('execute', { code, cell_id: cellId ?? null });
  }

  inspect(name: string): Promise<any> {
    return this.send('inspect', { variable_name: name });
  }

  inspectAll(): Promise<any> {
    return this.send('inspect_all', {});
  }

  interrupt(): Promise<any> {
    return this.send('interrupt', {});
  }

  complete(code: string, cursorPos: number): Promise<any> {
    return this.send('complete', { code, cursor_pos: cursorPos });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._rejectAllPending('Remote client disconnected');
    this.ws?.close();
    this.ws = null;
    this._setStatus('disconnected');
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useRemoteKernel — exposes the same interface as useLocalKernel but routes
 * all kernel operations through a remote server WebSocket endpoint.
 *
 * WebSocket URL format:
 *   wss://<serverHost>/ws/kernel?token=<jwt>
 *
 * The JWT is loaded from Tauri's secure storage (same mechanism used by
 * authFetch). Token is appended as a query param so the server can authenticate
 * the WebSocket upgrade request (headers are not settable for WS in browsers).
 * 
 * Supports environment template selection for uv-managed Python environments.
 */
export function useRemoteKernel() {
  const clientRef = useRef<RemoteKernelClient | null>(null);
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const platform = usePlatform();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<EnvironmentTemplate[]>([]);

  const {
    setConnectionStatus,
    setExecuting,
    setPort,
    setVariables,
    addOutput,
    incrementExecutionCount,
    setLastExecutedCellId,
    connectionStatus,
  } = useKernelStore();

  // ── Load available environment templates ─────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      const token = await platform.auth.loadToken();
      if (!token) return;
      
      const templates = await listEnvironmentTemplates(serverUrl, token, platform);
      setAvailableTemplates(templates);
    } catch (err) {
      console.warn('[useRemoteKernel] Failed to load environment templates:', err);
    }
  }, [serverUrl, platform.auth]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Build the WebSocket URL ───────────────────────────────────────────────

  const buildWsUrl = useCallback(async (): Promise<string> => {
    // Convert http(s) to ws(s)
    const wsBase = serverUrl.replace(/^http/, 'ws');
    const endpoint = `${wsBase}/ws/kernel`;

    let token: string | null = null;
    try {
      token = await platform.auth.loadToken();
    } catch {
      // Proceed without token — server will reject with 401
    }

    return token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint;
  }, [serverUrl]);

  // ── Start (connect to remote kernel) ─────────────────────────────────────

  const startKernel = useCallback(async () => {
    if (clientRef.current && clientRef.current.status !== 'disconnected') {
      return;
    }

    try {
      setConnectionStatus('connecting');

      // Load auth token
      const token = await platform.auth.loadToken();
      if (!token) {
        throw new Error('Not authenticated. Please log in first.');
      }

      // Start kernel with selected environment template
      const { startKernelWithTemplate } = await import('../services/environmentService');
      await startKernelWithTemplate(serverUrl, token, selectedTemplateId, platform);

      // Connect via WebSocket
      const wsUrl = await buildWsUrl();
      const client = new RemoteKernelClient(wsUrl, buildWsUrl);

      client.setStatusCallback((status) => {
        setConnectionStatus(status);
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
      });

      await client.connect();
      clientRef.current = client;

      // Remote kernels don't have a local port — use a sentinel value
      setPort(null);
      
      // Log which environment is being used
      const templateName = selectedTemplateId 
        ? availableTemplates.find(t => t.id === selectedTemplateId)?.display_name
        : 'System Python';
      
      addOutput('stream', {
        type: 'stream',
        name: 'stdout',
        text: `[Remote Kernel] Connected using: ${templateName}\n`,
      } as any);
    } catch (err) {
      console.error('[useRemoteKernel] Failed to connect:', err);
      setConnectionStatus('disconnected');
      // Surface error as kernel output so the user sees it
      const message =
        err instanceof Error
          ? err.message
          : 'Unknown error connecting to remote kernel';
      addOutput('stream', {
        type: 'stream',
        name: 'stderr',
        text:
          `[Remote Kernel Error] ${message}\n` +
          'Please check:\n' +
          '  • Server URL in Settings\n' +
          '  • You are logged in (remote mode requires authentication)\n' +
          '  • Environment template is valid (if selected)\n',
      } as any);
    }
  }, [buildWsUrl, setConnectionStatus, setPort, addOutput, selectedTemplateId, availableTemplates, serverUrl, platform.auth]);

  // ── Execute code ─────────────────────────────────────────────────────────

  const executeCode = useCallback(
    async (code: string, cellId?: string) => {
      if (!clientRef.current) {
        console.warn('[useRemoteKernel] executeCode called but no remote kernel client');
        return;
      }

      setExecuting(true);
      const effectiveCellId = cellId ?? (() => {
        const { cells, activeFileId, currentCellIndex } = useEditorStore.getState();
        const cell = cells[currentCellIndex];
        return cell ? `cell-${activeFileId ?? 'file'}-${currentCellIndex}` : 'stream';
      })();
      setLastExecutedCellId(effectiveCellId);
      (window as any).__executingCellId = effectiveCellId;

      try {
        const result = await clientRef.current.execute(code, effectiveCellId);
        incrementExecutionCount();

        try {
          const vars = await clientRef.current.inspectAll();
          setVariables((vars?.variables ?? []) as VariableInfo[]);
        } catch {
          // Non-fatal
        }

        return result;
      } catch (err) {
        console.error('[useRemoteKernel] Execution error:', err);
        throw err;
      } finally {
        setExecuting(false);
        (window as any).__executingCellId = undefined;
      }
    },
    [setExecuting, setVariables, incrementExecutionCount, setLastExecutedCellId],
  );

  // ── Interrupt ────────────────────────────────────────────────────────────

  const interruptExecution = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.interrupt();
    } catch (err) {
      console.error('[useRemoteKernel] Interrupt error:', err);
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

  // ── Stop (disconnect) ────────────────────────────────────────────────────

  const stopKernel = useCallback(async () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnectionStatus('disconnected');
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
    selectedTemplateId,
    setSelectedTemplateId,
    availableTemplates,
    loadTemplates,
  };
}
