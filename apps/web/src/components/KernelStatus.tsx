/**
 * KernelStatus
 *
 * Small status badge showing the remote kernel's connection state.
 *
 * Visual indicators:
 *   • connected    — green dot
 *   • connecting   — yellow dot (animated pulse)
 *   • disconnected — grey dot
 *   • error        — red dot
 *
 * Clicking the badge opens a dropdown with:
 *   • Kernel ID (truncated)
 *   • Uptime (if available)
 *   • Actions: Restart Kernel, Stop Kernel, Reconnect
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ConnectionStatus } from '../services/WebKernelClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KernelStatusProps {
  status: ConnectionStatus;
  kernelId: string | null;
  isExecuting?: boolean;
  onRestart: () => void;
  onStop: () => void;
  onReconnect: () => void;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; pulse: boolean }> = {
  connected:    { label: 'Connected',    color: '#3fb950', pulse: false },
  connecting:   { label: 'Connecting…',  color: '#d29922', pulse: true  },
  disconnected: { label: 'Disconnected', color: '#8b949e', pulse: false },
  error:        { label: 'Error',        color: '#f85149', pulse: false },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function KernelStatus({
  status,
  kernelId,
  isExecuting = false,
  onRestart,
  onStop,
  onReconnect,
}: KernelStatusProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cfg = STATUS_CONFIG[status];
  const shortId = kernelId ? kernelId.slice(0, 8) : '—';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <div ref={containerRef} style={styles.wrapper}>
      {/* Badge button */}
      <button
        style={styles.badge}
        onClick={() => setOpen((v) => !v)}
        title={`Kernel: ${cfg.label}${kernelId ? ` (${kernelId})` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Status dot */}
        <span
          style={{
            ...styles.dot,
            background: cfg.color,
            boxShadow: cfg.pulse ? `0 0 0 0 ${cfg.color}` : undefined,
            animation: cfg.pulse ? 'kernelPulse 1.4s ease-in-out infinite' : undefined,
          }}
        />

        {/* Label */}
        <span style={styles.label}>
          {isExecuting ? 'Running…' : cfg.label}
        </span>

        {/* Execution spinner */}
        {isExecuting && <span style={styles.spinner} aria-hidden="true" />}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={styles.dropdown} role="menu">
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Remote Kernel</span>
            <span style={styles.dropdownId} title={kernelId ?? ''}>
              ID: {shortId}
            </span>
          </div>

          <div style={styles.dropdownDivider} />

          <button
            style={styles.dropdownItem}
            onClick={() => handleAction(onReconnect)}
            disabled={status === 'connecting'}
            role="menuitem"
          >
            <ReconnectIcon />
            Reconnect
          </button>

          <button
            style={styles.dropdownItem}
            onClick={() => handleAction(onRestart)}
            role="menuitem"
          >
            <RestartIcon />
            Restart Kernel
          </button>

          <button
            style={{ ...styles.dropdownItem, color: '#f85149' }}
            onClick={() => handleAction(onStop)}
            role="menuitem"
          >
            <StopIcon />
            Stop Kernel
          </button>
        </div>
      )}

      {/* Keyframe for pulse animation — injected once via a style tag */}
      <style>{`
        @keyframes kernelPulse {
          0%   { box-shadow: 0 0 0 0 rgba(210,153,34,.7); }
          70%  { box-shadow: 0 0 0 6px rgba(210,153,34,0); }
          100% { box-shadow: 0 0 0 0 rgba(210,153,34,0); }
        }
      `}</style>
    </div>
  );
}

// ── Icons (inline SVG to avoid asset dependencies) ────────────────────────────

function ReconnectIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.5 1a1 1 0 0 0-1 1v3h-3a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2.5 15a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 0-2h-4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1z" />
      <path d="M8 3.5A4.5 4.5 0 1 0 12.5 8a1 1 0 0 1 2 0A6.5 6.5 0 1 1 8 1.5a1 1 0 0 1 0 2z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
      <path d="M8 1.5a.5.5 0 0 1 .5.5v3.793l1.354-1.353a.5.5 0 0 1 .707.707L8.354 6.854A.5.5 0 0 1 8 7a.5.5 0 0 1-.354-.146L5.939 5.147a.5.5 0 1 1 .707-.707L8 5.793V2a.5.5 0 0 1 .5-.5H8z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    position: 'relative' as const,
    display: 'inline-flex',
    alignItems: 'center',
    userSelect: 'none' as const,
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 8px',
    borderRadius: '12px',
    border: '1px solid var(--border, rgba(255,255,255,.12))',
    background: 'var(--bg-secondary, #1e1e2e)',
    color: 'var(--text-secondary, #8b949e)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono, monospace)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  } as React.CSSProperties,

  label: {
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  spinner: {
    width: '10px',
    height: '10px',
    border: '2px solid var(--accent, #7c6af7)',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute' as const,
    bottom: 'calc(100% + 6px)',
    right: 0,
    minWidth: '180px',
    background: 'var(--bg-secondary, #1e1e2e)',
    border: '1px solid var(--border, rgba(255,255,255,.12))',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
    padding: '6px 0',
    zIndex: 9999,
  } as React.CSSProperties,

  dropdownHeader: {
    padding: '6px 12px 4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,

  dropdownTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-primary, #e6edf3)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  dropdownId: {
    fontSize: '11px',
    color: 'var(--text-secondary, #8b949e)',
    fontFamily: 'var(--font-mono, monospace)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  dropdownDivider: {
    height: '1px',
    background: 'var(--border, rgba(255,255,255,.08))',
    margin: '4px 0',
  } as React.CSSProperties,

  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary, #8b949e)',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.1s, color 0.1s',
  } as React.CSSProperties,
} as const;
