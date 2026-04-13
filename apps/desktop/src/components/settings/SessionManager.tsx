import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useKernelStore } from '../../stores/kernelStore';
import { usePlatform } from '@pyide/platform';
import styles from './SessionManager.module.css';

interface SessionInfo {
  username: string | null;
  serverUrl: string;
  isLoggedIn: boolean;
  connectionStatus: string;
}

interface SessionManagerProps {
  /** Optional callback invoked after logout is performed */
  onLogout?: () => void;
}

export function SessionManager({ onLogout }: SessionManagerProps) {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const connectionStatus = useKernelStore((s) => s.connectionStatus);
  const platform = usePlatform();

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    username: null,
    serverUrl,
    isLoggedIn: false,
    connectionStatus,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  // Check for a stored token to determine login state
  useEffect(() => {
    let cancelled = false;
    async function checkToken() {
      try {
        const token = await platform.auth.loadToken();
        if (!cancelled) {
          setSessionInfo((prev) => ({
            ...prev,
            serverUrl,
            connectionStatus,
            isLoggedIn: !!token,
          }));
        }
      } catch {
        if (!cancelled) {
          setSessionInfo((prev) => ({
            ...prev,
            serverUrl,
            connectionStatus,
            isLoggedIn: false,
          }));
        }
      }
    }
    checkToken();
    return () => { cancelled = true; };
  }, [serverUrl, connectionStatus]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);
    try {
      // Attempt server-side logout
      try {
        await fetch(`${serverUrl}/api/v1/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Ignore network errors — still clear local token
      }

      // Clear the stored token
      await platform.auth.saveToken('');

      setSessionInfo((prev) => ({ ...prev, isLoggedIn: false, username: null }));
      setLogoutMessage('Logged out successfully.');
      onLogout?.();
    } catch (err) {
      setLogoutMessage(
        `Logout failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  const statusColor =
    connectionStatus === 'connected'
      ? 'var(--status-success)'
      : connectionStatus === 'connecting'
        ? 'var(--status-warning)'
        : 'var(--text-secondary)';

  return (
    <div className={styles.container}>
      {/* Connection status row */}
      <div className={styles.infoRow}>
        <span className={styles.label}>Server</span>
        <span className={styles.value} title={serverUrl}>
          {serverUrl || '—'}
        </span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.label}>Status</span>
        <span className={styles.statusBadge} style={{ color: statusColor }}>
          <span
            className={styles.statusDot}
            style={{ background: statusColor }}
          />
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'connecting'
              ? 'Connecting…'
              : 'Disconnected'}
        </span>
      </div>

      <div className={styles.infoRow}>
        <span className={styles.label}>Session</span>
        <span className={styles.value}>
          {sessionInfo.isLoggedIn ? (
            <span className={styles.loggedIn}>● Authenticated</span>
          ) : (
            <span className={styles.loggedOut}>○ Not logged in</span>
          )}
        </span>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {sessionInfo.isLoggedIn ? (
          <button
            className={styles.btnLogout}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out…' : 'Logout'}
          </button>
        ) : (
          <p className={styles.hint}>
            Use remote mode and log in via the kernel connection to start a session.
          </p>
        )}
      </div>

      {logoutMessage && (
        <p
          className={styles.message}
          style={{
            color: logoutMessage.startsWith('Logout failed')
              ? 'var(--status-error)'
              : 'var(--status-success)',
          }}
        >
          {logoutMessage}
        </p>
      )}
    </div>
  );
}
