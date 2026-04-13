/**
 * LoadingScreen — shown while the app is initialising.
 *
 * Displays:
 *  - PyIDE logo / branding
 *  - Animated spinner
 *  - Dynamic status text ("Connecting to server…", "Starting kernel…", etc.)
 *  - Error state with a Retry button
 *  - Smooth fade-out when `ready` becomes true
 */

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoadingStatus =
  | 'connecting'
  | 'authenticating'
  | 'starting-kernel'
  | 'loading-workspace'
  | 'ready'
  | 'error';

interface LoadingScreenProps {
  /** Current phase of initialisation. */
  status?: LoadingStatus;
  /** Custom error message shown when status === 'error'. */
  errorMessage?: string;
  /** Called when the user clicks the Retry button on error. */
  onRetry?: () => void;
  /**
   * When true the screen begins its fade-out transition and is eventually
   * removed from the DOM.
   */
  ready?: boolean;
}

// ── Status label mapping ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<Exclude<LoadingStatus, 'error' | 'ready'>, string> = {
  connecting:        'Connecting to server…',
  authenticating:    'Verifying credentials…',
  'starting-kernel': 'Starting kernel…',
  'loading-workspace': 'Loading workspace…',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function LoadingScreen({
  status = 'connecting',
  errorMessage,
  onRetry,
  ready = false,
}: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);

  // Fade-out then unmount when ready
  useEffect(() => {
    if (ready) {
      // Let CSS fade-out run (300 ms) then hide
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
    setVisible(true);
    return undefined;
  }, [ready]);

  if (!visible) return null;

  const isError = status === 'error';
  const label = isError
    ? (errorMessage ?? 'Failed to connect')
    : STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? 'Loading…';

  return (
    <div
      className="web-loading-screen"
      style={overlayStyle(ready)}
      role="status"
      aria-live="polite"
      aria-label={isError ? 'Error' : label}
    >
      {/* Logo */}
      <div style={logoWrapStyle}>
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          aria-hidden="true"
          style={isError ? { filter: 'grayscale(0.6)' } : undefined}
        >
          <rect width="56" height="56" rx="14" fill="var(--accent, #3b82f6)" />
          <text
            x="8"
            y="42"
            fontSize="34"
            fontFamily="'Courier New', Courier, monospace"
            fontWeight="bold"
            fill="white"
          >
            Py
          </text>
        </svg>
        <span style={appNameStyle}>PyIDE Web</span>
      </div>

      {/* Spinner or error icon */}
      {isError ? (
        <div style={errorIconStyle} aria-hidden="true">✕</div>
      ) : (
        <Spinner />
      )}

      {/* Status / error text */}
      <p style={isError ? errorTextStyle : statusTextStyle}>{label}</p>

      {/* Retry button */}
      {isError && onRetry && (
        <button
          onClick={onRetry}
          style={retryBtnStyle}
          type="button"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ── Spinner sub-component ─────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={spinnerStyle}
    >
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="var(--bg-tertiary, #2d2d30)"
        strokeWidth="3"
      />
      <path
        d="M16 3 A13 13 0 0 1 29 16"
        stroke="var(--accent, #3b82f6)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function overlayStyle(fading: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    background: 'var(--bg-primary, #1e1e1e)',
    zIndex: 9999,
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.3s ease',
    pointerEvents: fading ? 'none' : 'auto',
  };
}

const logoWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
};

const appNameStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'var(--text-primary, #cccccc)',
  letterSpacing: '-0.5px',
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-secondary, #858585)',
  margin: 0,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--status-error, #ef4444)',
  margin: 0,
};

const errorIconStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  background: 'var(--status-error, #ef4444)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 700,
};

const retryBtnStyle: React.CSSProperties = {
  marginTop: '4px',
  padding: '8px 24px',
  borderRadius: '6px',
  background: 'var(--accent, #3b82f6)',
  color: 'var(--text-inverse, #fff)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity 0.15s',
};

const spinnerStyle: React.CSSProperties = {
  animation: 'pyide-spin 0.9s linear infinite',
};

// Inject keyframes once (avoids creating a CSS file dependency)
if (typeof document !== 'undefined') {
  const STYLE_ID = 'pyide-loading-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `@keyframes pyide-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
}
