import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useKernelStore } from '../../stores/kernelStore';
import { useUiStore } from '../../stores/uiStore';
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
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const kernelMode = useUiStore((s) => s.kernelMode);
  const setKernelMode = useUiStore((s) => s.setKernelMode);
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
  const [editUrl, setEditUrl] = useState(serverUrl);
  const [isEditingUrl, setIsEditingUrl] = useState(false);

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

  // Sync editUrl when serverUrl changes
  useEffect(() => {
    setEditUrl(serverUrl);
  }, [serverUrl]);

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

  async function handleSaveUrl() {
    if (!editUrl || editUrl.trim() === '') {
      setLogoutMessage('Server URL cannot be empty');
      return;
    }
    
    // Normalize URL (remove trailing slash)
    const normalizedUrl = editUrl.replace(/\/$/, '');
    
    setServerUrl(normalizedUrl);
    setIsEditingUrl(false);
    
    try {
      await saveSettings();
      setLogoutMessage('Server URL updated successfully. Restart kernel to apply.');
    } catch (err) {
      setLogoutMessage(
        `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function handleSwitchToRemote() {
    setKernelMode('remote');
    setLogoutMessage('Switched to remote mode. Starting kernel...');
  }

  const statusColor =
    connectionStatus === 'connected'
      ? 'var(--status-success)'
      : connectionStatus === 'connecting'
        ? 'var(--status-warning)'
        : 'var(--text-secondary)';

  return (
    <div className={styles.container}>
      {/* Server URL configuration */}
      <div className={styles.infoRow}>
        <span className={styles.label}>Server URL</span>
        {isEditingUrl ? (
          <div className={styles.urlEditRow}>
            <input
              type="text"
              className={styles.urlInput}
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="http://your-server:8000"
            />
            <button
              className={styles.btnSmall}
              onClick={handleSaveUrl}
            >
              Save
            </button>
            <button
              className={styles.btnSmall}
              onClick={() => {
                setEditUrl(serverUrl);
                setIsEditingUrl(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className={styles.urlDisplayRow}>
            <span className={styles.value} title={serverUrl}>
              {serverUrl || '—'}
            </span>
            <button
              className={styles.btnEdit}
              onClick={() => setIsEditingUrl(true)}
              title="Edit server URL"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {/* Kernel mode */}
      <div className={styles.infoRow}>
        <span className={styles.label}>Kernel Mode</span>
        <div className={styles.modeRow}>
          <span className={styles.value}>
            {kernelMode === 'remote' ? (
              <span className={styles.remoteMode}>Remote</span>
            ) : (
              <span className={styles.localMode}>Local</span>
            )}
          </span>
          {kernelMode === 'local' && (
            <button
              className={styles.btnSwitchMode}
              onClick={handleSwitchToRemote}
            >
              Switch to Remote
            </button>
          )}
        </div>
      </div>

      {/* Connection status row */}
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
        ) : kernelMode === 'remote' ? (
          <div className={styles.loginHint}>
            <p className={styles.hint}>
              🔐 To authenticate, please restart the kernel. You will be prompted to enter your username and password.
            </p>
            <button
              className={styles.btnLogin}
              onClick={async () => {
                // Stop current kernel and restart to trigger login
                try {
                  const { useKernelStore } = await import('../../stores/kernelStore');
                  const { setConnectionStatus } = useKernelStore.getState();
                  setConnectionStatus('disconnected');
                  setLogoutMessage('Please use the main interface to start the kernel and login.');
                } catch (err) {
                  console.error('Failed to reset kernel status:', err);
                }
              }}
            >
              Reset Connection
            </button>
          </div>
        ) : (
          <p className={styles.hint}>
            Switch to remote mode and start the kernel to authenticate.
          </p>
        )}
      </div>

      {logoutMessage && (
        <p
          className={styles.message}
          style={{
            color: logoutMessage.startsWith('Failed') || logoutMessage.startsWith('Logout failed')
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
