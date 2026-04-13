import { useState } from 'react';
import { useSettingsStore } from '@desktop/stores/settingsStore';
import { login as apiLogin, register as apiRegister } from '../services/authApi';

interface LoginPageProps {
  /** Called with the JWT access token and a `persist` flag on success. */
  onLoginSuccess: (token: string, persist: boolean) => void;
}

/**
 * Web login page — shown when the user is not authenticated.
 *
 * Supports both login and registration flows. On success the JWT access token
 * is passed to the parent via onLoginSuccess().
 */
export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Persist any server URL change before authenticating
    if (localServerUrl !== serverUrl) {
      setServerUrl(localServerUrl);
      await saveSettings();
    }

    try {
      let accessToken: string;

      if (isLogin) {
        const data = await apiLogin(username, password);
        accessToken = data.access_token;
      } else {
        // Register, then automatically log in
        await apiRegister(username, email, password);
        const data = await apiLogin(username, password);
        accessToken = data.access_token;
      }

      onLoginSuccess(accessToken, rememberMe);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Logo / Title */}
        <div style={styles.header}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <rect width="36" height="36" rx="8" fill="var(--accent)" />
            <text x="7" y="26" fontSize="22" fontFamily="monospace" fill="white">Py</text>
          </svg>
          <h1 style={styles.title}>PyIDE Web</h1>
        </div>

        <p style={styles.subtitle}>{isLogin ? 'Sign in to continue' : 'Create a new account'}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Username
            <input
              style={styles.input}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          {!isLogin && (
            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </label>
          )}

          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label style={styles.label}>
            Server URL
            <input
              style={styles.input}
              type="url"
              value={localServerUrl}
              onChange={(e) => setLocalServerUrl(e.target.value)}
              placeholder="http://localhost:8000"
              disabled={loading}
            />
          </label>

          {/* Remember me */}
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            Remember me
          </label>

          {error && (
            <p style={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <p style={styles.toggleText}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            style={styles.toggleBtn}
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
          >
            {isLogin ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Inline styles (avoids adding a new CSS file dependency) ──────────────────
// Uses theme CSS variables from the shared global.css / theme.css.

const styles = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: 'var(--bg-primary)',
  } as React.CSSProperties,

  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '40px 36px',
    width: '360px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,

  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,

  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  } as React.CSSProperties,

  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '14px',
  } as React.CSSProperties,

  error: {
    fontSize: '13px',
    color: 'var(--error, #e06c75)',
    background: 'rgba(224, 108, 117, 0.1)',
    border: '1px solid rgba(224, 108, 117, 0.3)',
    borderRadius: '6px',
    padding: '8px 10px',
    margin: 0,
  } as React.CSSProperties,

  submitBtn: {
    marginTop: '4px',
    padding: '10px',
    borderRadius: '6px',
    background: 'var(--accent)',
    color: 'var(--text-inverse, #fff)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  toggleText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    margin: 0,
  } as React.CSSProperties,

  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    padding: 0,
  } as React.CSSProperties,

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  } as React.CSSProperties,
} as const;
