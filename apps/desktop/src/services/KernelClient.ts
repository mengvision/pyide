import type { KernelStream } from '@pyide/protocol/kernel';

type StreamCallback = (stream: KernelStream) => void;
type StatusCallback = (status: 'disconnected' | 'connecting' | 'connected') => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

export class KernelClient {
  private ws: WebSocket | null = null;
  private port: number;
  private pendingRequests = new Map<string, PendingRequest>();
  private streamCallback: StreamCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  /** When true, scheduleReconnect() will not fire (e.g. after deliberate disconnect) */
  private destroyed = false;

  constructor(port: number) {
    this.port = port;
  }

  setStreamCallback(cb: StreamCallback): void {
    this.streamCallback = cb;
  }

  setStatusCallback(cb: StatusCallback): void {
    this.statusCallback = cb;
  }

  get status(): 'disconnected' | 'connecting' | 'connected' {
    return this._status;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._setStatus('connecting');

      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);

      this.ws.onopen = () => {
        this._setStatus('connected');
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);

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
        } catch (err) {
          console.warn('[KernelClient] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this._setStatus('disconnected');
        this._rejectAllPending('Connection closed');
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onerror is always followed by onclose, so we only reject the
        // connect() promise here (onclose handles the rest).
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private _setStatus(status: 'disconnected' | 'connecting' | 'connected'): void {
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) {
        this.connect().catch(() => {/* silently retry */});
      }
    }, 2000);
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('KernelClient: not connected');
    }

    const id = crypto.randomUUID();
    return new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout (method: ${method})`));
        }
      }, 30_000);

      // Override resolve/reject to also clear the timeout
      const originalResolve = resolve;
      const originalReject = reject;
      this.pendingRequests.set(id, {
        resolve: (v: any) => { clearTimeout(timeoutId); originalResolve(v); },
        reject: (e: Error) => { clearTimeout(timeoutId); originalReject(e); },
      });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  // ── Convenience methods ──────────────────────────────────────────────────

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
    this._rejectAllPending('Client disconnected');
    this.ws?.close();
    this.ws = null;
    this._setStatus('disconnected');
  }
}
