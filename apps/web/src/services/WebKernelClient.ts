/**
 * WebKernelClient
 *
 * Browser-native WebSocket client for the remote kernel server.
 * Uses the same JSON-RPC-ish message protocol as the desktop KernelClient so
 * shared utilities (outputRouter, etc.) work without modification.
 *
 * Protocol summary:
 *   Outbound:  { id, method, params }
 *   Inbound:
 *     Stream:   { stream: 'stdout'|'stderr'|..., data: {...} }
 *     Response: { id, result? | error?: { code, message } }
 *
 * Auth: A short-lived, opaque WebSocket session token (`wsToken`) is passed
 * as `?session=<wsToken>` in the URL.  The caller must obtain this token via
 * POST /api/kernel/:id/ws-token before connecting (and again before every
 * reconnect, because the token is single-use / short-lived).
 */

import type { KernelStream } from '@pyide/protocol/kernel';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type StreamCallback = (stream: KernelStream) => void;
type StatusCallback = (status: ConnectionStatus) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** Exponential backoff delays: 1s, 2s, 4s, 8s, 16s, then capped at 30s. */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

// ── WebKernelClient ───────────────────────────────────────────────────────────

export class WebKernelClient {
  private ws: WebSocket | null = null;
  private serverUrl: string = '';
  private kernelId: string = '';
  /** Short-lived opaque session token used in the WebSocket URL (?session=). */
  private wsToken: string = '';
  /** Callback that the caller provides to fetch a fresh ws_token before each reconnect. */
  private fetchWsToken: (() => Promise<string>) | null = null;

  private pendingRequests = new Map<string, PendingRequest>();
  private streamCallback: StreamCallback | null = null;
  private statusCallback: StatusCallback | null = null;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private _status: ConnectionStatus = 'disconnected';
  private destroyed = false;

  /** Bound reference so we can remove it on destroy. */
  private readonly _onBeforeUnload = () => {
    this._silentDisconnect();
  };

  // ── Public API ────────────────────────────────────────────────────────────

  get status(): ConnectionStatus {
    return this._status;
  }

  onMessage(callback: StreamCallback): void {
    this.streamCallback = callback;
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Establish a WebSocket connection to the kernel.
   *
   * @param serverUrl    HTTP(S) base URL of the server, e.g. 'http://localhost:8000'
   * @param kernelId     Kernel identifier returned by /api/kernel/start
   * @param wsToken      Short-lived opaque session token (from POST /api/kernel/:id/ws-token)
   * @param fetchWsToken Callback to obtain a fresh ws_token for each reconnect attempt
   */
  connect(
    serverUrl: string,
    kernelId: string,
    wsToken: string,
    fetchWsToken: () => Promise<string>,
  ): Promise<void> {
    this.serverUrl = serverUrl;
    this.kernelId = kernelId;
    this.wsToken = wsToken;
    this.fetchWsToken = fetchWsToken;
    this.destroyed = false;

    window.addEventListener('beforeunload', this._onBeforeUnload);

    return this._openSocket();
  }

  /** Send a method call and wait for the response. */
  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebKernelClient: not connected');
    }

    const id = crypto.randomUUID();

    return new Promise<any>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout (method: ${method})`));
        }
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: (v: any) => { clearTimeout(timeoutId); resolve(v); },
        reject: (e: Error) => { clearTimeout(timeoutId); reject(e); },
      });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  // ── Convenience methods (same interface as desktop KernelClient) ───────────

  execute(code: string, cellId?: string): Promise<any> {
    return this.send('execute', { code, cell_id: cellId ?? null });
  }

  interrupt(): Promise<any> {
    return this.send('interrupt', {});
  }

  inspectAll(): Promise<any> {
    return this.send('inspect_all', {});
  }

  inspect(name: string): Promise<any> {
    return this.send('inspect', { variable_name: name });
  }

  complete(code: string, cursorPos: number): Promise<any> {
    return this.send('complete', { code, cursor_pos: cursorPos });
  }

  /** Permanently close the connection and prevent auto-reconnect. */
  disconnect(): void {
    this.destroyed = true;
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    this._stopHeartbeat();
    this._clearReconnectTimer();
    this._rejectAllPending('Client disconnected');
    this._closeSocket();
    this._setStatus('disconnected');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _buildWsUrl(): string {
    // Convert http → ws, https → wss
    const wsBase = this.serverUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    const url = `${wsBase}/ws/kernel/${encodeURIComponent(this.kernelId)}`;
    return this.wsToken ? `${url}?session=${encodeURIComponent(this.wsToken)}` : url;
  }

  private _openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._setStatus('connecting');

      let wsUrl: string;
      try {
        wsUrl = this._buildWsUrl();
      } catch (err) {
        this._setStatus('error');
        reject(new Error(`Failed to build WebSocket URL: ${String(err)}`));
        return;
      }

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        this._setStatus('error');
        reject(new Error(`Failed to create WebSocket: ${String(err)}`));
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempt = 0;
        this._setStatus('connected');
        this._startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this._handleMessage(event.data as string);
      };

      this.ws.onclose = () => {
        this._setStatus('disconnected');
        this._stopHeartbeat();
        this._rejectAllPending('Connection closed');
        if (!this.destroyed) {
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onerror is always followed by onclose — only reject the connect promise here.
        reject(new Error(
          'WebKernelClient: WebSocket connection failed. ' +
          'Ensure the server is running and the token is valid.',
        ));
      };
    });
  }

  private _handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.warn('[WebKernelClient] Failed to parse message:', err);
      return;
    }

    // Stream message — no id field
    if (msg.stream !== undefined) {
      this.streamCallback?.(msg as KernelStream);
      return;
    }

    // RPC response — has id field
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message ?? 'Kernel error'));
      } else {
        pending.resolve(msg.result);
      }
    }
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

  private _closeSocket(): void {
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect trigger
      this.ws.close();
      this.ws = null;
    }
  }

  /** Close without changing status (used on page unload). */
  private _silentDisconnect(): void {
    this._stopHeartbeat();
    this._clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.destroyed) return;

    const delayMs = RECONNECT_DELAYS_MS[
      Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
    ];
    this.reconnectAttempt += 1;

    console.info(`[WebKernelClient] Reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.destroyed) return;

      // Fetch a fresh short-lived ws_token before each reconnect attempt
      // because the previous one may have already expired.
      if (this.fetchWsToken) {
        try {
          this.wsToken = await this.fetchWsToken();
        } catch (err) {
          console.warn('[WebKernelClient] Could not refresh ws_token, retrying with empty token:', err);
          this.wsToken = '';
        }
      }

      if (!this.destroyed) {
        this._openSocket().catch(() => { /* silently retry */ });
      }
    }, delayMs);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a lightweight ping message; the server may respond with pong or ignore.
        this.ws.send(JSON.stringify({ id: crypto.randomUUID(), method: 'ping', params: {} }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
