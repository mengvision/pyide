/**
 * Web App entry component.
 *
 * The web version always targets the remote server — there is no local kernel
 * option. Authentication is required before the main IDE layout is shown.
 *
 * Component reuse strategy:
 *  - All shared components are imported via the "@desktop/*" path alias which
 *    resolves to apps/desktop/src/. This avoids duplicating UI code.
 *  - The only web-specific components live in apps/web/src/components/.
 */

import { useEffect, useState } from 'react';

// ── Web-specific styles ───────────────────────────────────────────────────────
// (global.css + theme.css are imported in main.tsx; web.css overrides follow)
import './styles/web.css';

// ── Shared desktop components ─────────────────────────────────────────────────
import { AppLayout }      from '@desktop/components/layout/AppLayout';
import { SettingsDialog } from '@desktop/components/settings/SettingsDialog';

// ── Shared stores / hooks ─────────────────────────────────────────────────────
import { useSettingsStore, initSettingsPlatform } from '@desktop/stores/settingsStore';
import { useUiStore }                             from '@desktop/stores/uiStore';

// ── Kernel context ────────────────────────────────────────────────────────────
import { KernelProvider } from '@desktop/contexts/KernelContext';

// ── Platform ──────────────────────────────────────────────────────────────────
import { usePlatform }         from '@pyide/platform';
import { initSkillPlatform }   from '@desktop/services/SkillService';
import { mcpClient }           from '@desktop/services/MCPService/client';

// ── Web-specific components & hooks ───────────────────────────────────────────
import { useWebAuth }            from './hooks/useWebAuth';
import { useWebKeyboard }        from './hooks/useWebKeyboard';
import { useDocumentTitle }      from './hooks/useDocumentTitle';
import { useStatePreservation }  from './hooks/useStatePreservation';
import { LoginPage }             from './components/LoginPage';
import { LoadingScreen }         from './components/LoadingScreen';
import { ResponsiveLayout }      from './components/ResponsiveLayout';
import type { LoadingStatus }    from './components/LoadingScreen';

// ── Inner IDE (rendered only when authenticated) ──────────────────────────────

function IdeApp({ onLogout }: { onLogout: () => void }) {
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);

  // Web-specific hooks wired inside the authenticated tree
  useWebKeyboard();
  useDocumentTitle(/* isKernelBusy */ false);
  useStatePreservation();

  return (
    <KernelProvider>
      <ResponsiveLayout>
        <AppLayout onLogout={onLogout} />
      </ResponsiveLayout>
      {isSettingsOpen && <SettingsDialog />}
    </KernelProvider>
  );
}

// ── Root App component ────────────────────────────────────────────────────────

function App() {
  const platform = usePlatform();

  // ── Settings ──────────────────────────────────────────────────────────────
  const theme        = useSettingsStore((s) => s.theme);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // ── Web auth state ────────────────────────────────────────────────────────
  // Token refresh is managed exclusively by useWebAuth (JWT-exp-based).
  // Do NOT add a secondary refresh timer here — it would conflict.
  const { isAuthenticated, isLoading: isAuthLoading, login, logout } = useWebAuth(platform);

  // ── Loading screen state ──────────────────────────────────────────────────
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('connecting');
  const [loadingError, setLoadingError]   = useState<string | undefined>();
  const [appReady, setAppReady]           = useState(false);

  // Inject platform into module-level singletons on mount
  useEffect(() => {
    initSettingsPlatform(platform);
    initSkillPlatform(platform);
    mcpClient.setPlatform(platform);
  }, [platform]);

  // Load persisted settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Force kernelMode to 'remote' for the web app
  const setKernelMode = useUiStore((s) => s.setKernelMode);
  useEffect(() => {
    setKernelMode('remote');
  }, [setKernelMode]);

  // Apply theme to document root whenever it changes
  useEffect(() => {
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [theme]);

  // ── Loading screen lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    if (isAuthLoading) {
      setLoadingStatus('authenticating');
      setLoadingError(undefined);
      return;
    }
    if (isAuthenticated) {
      // Briefly show "loading workspace" before revealing the IDE
      setLoadingStatus('loading-workspace');
      const t = setTimeout(() => {
        setAppReady(true);
      }, 600);
      return () => clearTimeout(t);
    }
    // Not authenticated — show login page (loading screen not needed)
    setAppReady(false);
  }, [isAuthLoading, isAuthenticated]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Auth check in progress → spinner
  if (isAuthLoading) {
    return (
      <LoadingScreen
        status={loadingStatus}
        errorMessage={loadingError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Not authenticated → login page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={login} />;
  }

  // Authenticated but workspace not yet ready
  if (!appReady) {
    return (
      <LoadingScreen
        status={loadingStatus}
        errorMessage={loadingError}
        onRetry={() => window.location.reload()}
        ready={false}
      />
    );
  }

  return (
    <>
      {/* Fade-out loading screen while IDE mounts */}
      <LoadingScreen status="loading-workspace" ready={true} />
      <IdeApp onLogout={logout} />
    </>
  );
}

export default App;
