/**
 * browserUtils — browser-environment utility functions for PyIDE Web.
 *
 * All functions are safe to import in a browser context.  None of them use
 * Node.js APIs or Tauri-specific APIs.
 */

// ── Network ───────────────────────────────────────────────────────────────────

/**
 * Returns whether the browser currently has an active network connection.
 * Relies on `navigator.onLine`; subscribe to `online`/`offline` events for
 * live updates.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ── Visibility / tab focus ────────────────────────────────────────────────────

type VisibilityCallback = (isVisible: boolean) => void;

/**
 * Registers a callback invoked whenever the page's visibility changes
 * (tab switches, window minimise, etc.).
 *
 * @returns cleanup function — call it to remove the event listener.
 *
 * @example
 *   const cleanup = onVisibilityChange((visible) => {
 *     if (!visible) pausePolling();
 *     else           resumePolling();
 *   });
 *   // in a useEffect cleanup:
 *   return cleanup;
 */
export function onVisibilityChange(callback: VisibilityCallback): () => void {
  const handler = () => callback(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * Requests browser notification permission if it hasn't been granted/denied yet.
 * Resolves with the resulting `NotificationPermission` string.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Shows a browser notification if permission is granted and the tab is not
 * currently visible.  Silently does nothing if notifications are unavailable
 * or the tab is focused.
 *
 * @param title  Notification title
 * @param body   Notification body text
 * @param icon   Optional icon URL (defaults to the PyIDE favicon)
 */
export function showNotification(
  title: string,
  body: string,
  icon?: string,
): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  try {
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: icon ?? '/favicon.ico',
      tag: 'pyide-kernel',  // collapse duplicate notifications
    });
  } catch {
    // Notifications can fail in some sandboxed contexts — ignore silently
  }
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

/**
 * Copies `text` to the system clipboard via the Clipboard API.
 * Falls back to `document.execCommand('copy')` for environments that don't
 * support `navigator.clipboard` (some older browsers, non-https).
 *
 * @returns Promise that resolves to `true` on success, `false` on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  // Legacy execCommand fallback
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    return success;
  } catch {
    return false;
  }
}

// ── File download ─────────────────────────────────────────────────────────────

/**
 * Triggers a browser file-download for the given `Blob`.
 *
 * @param blob      Data to download
 * @param filename  Suggested save-as filename
 *
 * @example
 *   const blob = new Blob([sourceCode], { type: 'text/plain' });
 *   downloadBlob(blob, 'script.py');
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Clean up after a short delay to allow the download to start
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Convenience wrapper around `downloadBlob` for plain-text content.
 *
 * @param text      Text content
 * @param filename  Suggested save-as filename
 */
export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}
