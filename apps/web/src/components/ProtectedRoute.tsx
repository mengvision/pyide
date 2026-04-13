import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /**
   * True while the auth state is being restored from storage (initial mount).
   * The route renders a loading spinner during this window to avoid a flash of
   * the login page for users who already have a valid token.
   */
  isLoading: boolean;
  /** Content to display when authenticated. */
  children: ReactNode;
  /** Optional element to show while loading. Defaults to a centered spinner. */
  loadingFallback?: ReactNode;
  /** Optional element to show when not authenticated. Defaults to null. */
  unauthFallback?: ReactNode;
}

/**
 * ProtectedRoute
 *
 * Wraps content that should only be visible to authenticated users.
 *
 * - Shows `loadingFallback` (default: spinner) while auth state is resolving.
 * - Shows `unauthFallback` (default: null) when not authenticated.
 *   Typically the parent (App.tsx) renders <LoginPage> instead, so the default
 *   null is fine.
 * - Renders `children` when authenticated.
 */
export function ProtectedRoute({
  isAuthenticated,
  isLoading,
  children,
  loadingFallback,
  unauthFallback = null,
}: ProtectedRouteProps) {
  if (isLoading) {
    return <>{loadingFallback ?? <DefaultSpinner />}</>;
  }

  if (!isAuthenticated) {
    return <>{unauthFallback}</>;
  }

  return <>{children}</>;
}

// ── Default loading spinner ───────────────────────────────────────────────────

function DefaultSpinner() {
  return (
    <div style={spinnerStyles.overlay} aria-label="Loading" role="status">
      <div style={spinnerStyles.ring} />
    </div>
  );
}

const spinnerStyles = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: 'var(--bg-primary)',
  } as React.CSSProperties,

  ring: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  } as React.CSSProperties,
} as const;
