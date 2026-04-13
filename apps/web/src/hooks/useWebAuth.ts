import { useState, useEffect, useCallback, useRef } from 'react';
import type { PlatformService } from '@pyide/platform';
import { fetchMe, refreshToken } from '../services/authApi';

interface WebAuthState {
  isAuthenticated: boolean;
  /** True while the initial token check / validation is in progress. */
  isLoading: boolean;
  user: string | null;
  token: string | null;
}

interface UseWebAuthReturn extends WebAuthState {
  login: (token: string, persist?: boolean) => void;
  logout: () => void;
}

/** How many ms before JWT expiry to trigger a silent refresh. */
const REFRESH_BEFORE_EXPIRY_MS = 60_000; // 1 minute

/**
 * Web authentication state management hook.
 *
 * - On mount, reads a persisted token from storage and validates it against
 *   the server (`GET /api/v1/auth/me`).  Sets `isLoading = true` during this
 *   window so the UI can show a spinner instead of the login page.
 * - Provides `login(token, persist?)` to store a new token and mark
 *   authenticated. Pass `persist = false` to use sessionStorage ("remember
 *   me" unchecked).
 * - Provides `logout()` to clear the token and mark unauthenticated.
 * - Schedules a silent token refresh based on the JWT `exp` claim so sessions
 *   stay alive without user interaction.
 * - Exposes `isAuthenticated`, `isLoading`, `user` (decoded username), `token`.
 */
export function useWebAuth(platform: PlatformService): UseWebAuthReturn {
  const [state, setState] = useState<WebAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether the current session should be persisted to storage.
   * Stored in a ref (not state) to avoid triggering re-renders and to be
   * always up-to-date inside the async scheduleRefresh closure.
   */
  const persistRef = useRef<boolean>(true);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /** Schedule a silent refresh `msUntilExpiry - REFRESH_BEFORE_EXPIRY_MS` ms from now. */
  const scheduleRefresh = useCallback(
    (token: string) => {
      clearRefreshTimer();
      const exp = decodeExp(token);
      if (exp === null) return; // no expiry claim — skip scheduling

      const msUntilExpiry = exp * 1000 - Date.now();
      const delay = Math.max(0, msUntilExpiry - REFRESH_BEFORE_EXPIRY_MS);

      refreshTimerRef.current = setTimeout(async () => {
        const newToken = await refreshToken();
        if (newToken) {
          // Only persist to storage if the session was originally set to persist.
          if (persistRef.current) {
            platform.auth.saveToken(newToken).catch(console.error);
          }
          const username = decodeUsername(newToken);
          setState((prev) => ({ ...prev, token: newToken, user: username }));
          scheduleRefresh(newToken);
        } else {
          // Refresh failed → force logout
          platform.auth.clearToken().catch(console.error);
          setState({ isAuthenticated: false, isLoading: false, token: null, user: null });
        }
      }, delay);
    },
    [platform, clearRefreshTimer],
  );

  // ── On mount: restore & validate persisted token ───────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const savedToken = await platform.auth.loadToken();
        if (cancelled || !savedToken) {
          if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
          return;
        }

        // Validate the token against the server
        const me = await fetchMe(savedToken);
        if (cancelled) return;

        if (me) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            token: savedToken,
            user: me.username,
          });
          scheduleRefresh(savedToken);
        } else {
          // Token rejected by server — clear it
          await platform.auth.clearToken();
          setState({ isAuthenticated: false, isLoading: false, token: null, user: null });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  // Cleanup refresh timer on unmount
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Call after a successful login/register API response.
   * @param persist - if false, token is kept only for the session (not saved
   *                  to persistent storage).  Defaults to true.
   */
  const login = useCallback(
    (token: string, persist = true) => {
      persistRef.current = persist;
      if (persist) {
        platform.auth.saveToken(token).catch(console.error);
      }
      const username = decodeUsername(token);
      setState({ isAuthenticated: true, isLoading: false, token, user: username });
      scheduleRefresh(token);
    },
    [platform, scheduleRefresh],
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    platform.auth.clearToken().catch(console.error);
    setState({ isAuthenticated: false, isLoading: false, token: null, user: null });
  }, [platform, clearRefreshTimer]);

  return { ...state, login, logout };
}

// ── JWT decode helpers ────────────────────────────────────────────────────────

/**
 * Safely decode the `sub` (subject / username) claim from a JWT payload.
 * Returns null if the token is malformed or the claim is absent.
 */
function decodeUsername(token: string): string | null {
  try {
    const payload = decodePayload(token);
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Decode the `exp` claim (seconds since epoch) from a JWT.
 * Returns null if the token is malformed or the claim is absent.
 */
function decodeExp(token: string): number | null {
  try {
    const payload = decodePayload(token);
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
}
