import { useState, useRef, useEffect } from 'react';

interface UserMenuProps {
  /** Decoded username from the JWT (shown in the button label). */
  username: string | null;
  /** Called when the user confirms logout. */
  onLogout: () => void;
}

/**
 * UserMenu
 *
 * A compact dropdown that sits in the status-bar / header area.
 * Shows the current username and provides a Logout action.
 *
 * Closes on outside click and on Escape key.
 */
export function UserMenu({ username, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const displayName = username ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <div ref={menuRef} style={styles.wrapper}>
      {/* Trigger button */}
      <button
        style={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Signed in as ${displayName}`}
      >
        <span style={styles.avatar}>{initial}</span>
        <span style={styles.name}>{displayName}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          aria-hidden="true"
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={styles.dropdown} role="menu">
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownUsername}>{displayName}</span>
          </div>
          <hr style={styles.divider} />
          <button
            style={styles.logoutBtn}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-flex',
  } as React.CSSProperties,

  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    padding: '3px 6px',
    borderRadius: '6px',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  avatar: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  name: {
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '180px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    zIndex: 1000,
    overflow: 'hidden',
  } as React.CSSProperties,

  dropdownHeader: {
    padding: '10px 14px 8px',
  } as React.CSSProperties,

  dropdownUsername: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as React.CSSProperties,

  divider: {
    border: 'none',
    borderTop: '1px solid var(--border)',
    margin: 0,
  } as React.CSSProperties,

  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '9px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'left' as const,
    transition: 'background 0.12s, color 0.12s',
  } as React.CSSProperties,
} as const;
