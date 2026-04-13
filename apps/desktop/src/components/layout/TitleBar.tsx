import { useKernelStore } from '../../stores/kernelStore';
import { useUiStore } from '../../stores/uiStore';
import styles from './TitleBar.module.css';

const MENU_ITEMS = ['File', 'Edit', 'View', 'Run', 'Kernel', 'AI', 'Help'];

interface TitleBarProps {
  onLogout?: () => void;
}

export function TitleBar({ onLogout }: TitleBarProps) {
  const connectionStatus = useKernelStore((s) => s.connectionStatus);
  const openSettings = useUiStore((s) => s.openSettings);
  const kernelMode = useUiStore((s) => s.kernelMode);

  return (
    <div className={styles.titleBar}>
      <nav className={styles.menuList}>
        {MENU_ITEMS.map((item) => (
          <button key={item} className={styles.menuItem}>
            {item}
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.rightSection}>
        <div className={styles.kernelStatus}>
          <div className={`${styles.kernelDot} ${styles[connectionStatus]}`} />
          <span>Kernel: {connectionStatus}</span>
        </div>

        <button
          className={styles.settingsBtn}
          onClick={openSettings}
          title="Settings (Ctrl+,)"
          aria-label="Open Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {kernelMode === 'remote' && onLogout && (
          <button
            className={styles.settingsBtn}
            onClick={onLogout}
            title="Logout"
            aria-label="Logout"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
