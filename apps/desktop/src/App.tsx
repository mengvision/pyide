import { useEffect, useState, useCallback, useRef } from 'react';
import './styles/theme.css';
import './styles/global.css';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './components/layout/Login';
import { UvWarningBanner } from './components/ui/UvWarningBanner';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { useSettingsStore, initSettingsPlatform } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { useGlobalKeyboard } from './hooks/useGlobalKeyboard';
import { useSaveFile } from './hooks/useSaveFile';
import { useEnv } from './hooks/useEnv';
import { KernelProvider } from './contexts/KernelContext';
import { refreshToken } from './utils/authApi';
import { usePlatform } from '@pyide/platform';
import { initSkillPlatform } from './services/SkillService';
import { mcpClient } from './services/MCPService/client';

function App() {
  const platform = usePlatform();
  const theme = useSettingsStore((s) => s.theme);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const workspacePath = useUiStore((s) => s.workspacePath);
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen);
  const kernelMode = useUiStore((s) => s.kernelMode);
  const { checkUv, refreshVenvs } = useEnv();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [, setToken] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject platform into all module-level singletons once on mount
  useEffect(() => {
    initSettingsPlatform(platform);
    initSkillPlatform(platform);
    mcpClient.setPlatform(platform);
  }, [platform]);

  // Schedule token refresh ~1 min before 15-min expiry (i.e., every 14 min)
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await refreshToken(platform, serverUrl);
      if (newToken) {
        setToken(newToken);
        scheduleTokenRefresh();
      } else {
        // Refresh failed – require re-login
        handleLogout();
      }
    }, 14 * 60 * 1000);
  }, [serverUrl, platform]);

  const handleLogout = useCallback(async () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    try {
      await platform.auth.clearToken();
    } catch {
      // Ignore errors during logout
    }
    setToken(null);
    setIsAuthenticated(false);
  }, [platform]);

  // Load persisted settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // On startup, try to restore a persisted token
  useEffect(() => {
    if (kernelMode !== 'remote') return;
    (async () => {
      try {
        const savedToken = await platform.auth.loadToken();
        if (savedToken) {
          setToken(savedToken);
          setIsAuthenticated(true);
          scheduleTokenRefresh();
        }
      } catch {
        // No saved token – stay on login screen
      }
    })();
  }, [kernelMode, scheduleTokenRefresh, platform]);

  // Check uv availability on mount
  useEffect(() => {
    checkUv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Run only once on mount

  // Refresh venvs when workspace changes
  useEffect(() => {
    if (workspacePath) {
      refreshVenvs(workspacePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);  // CRITICAL: Removed refreshVenvs to prevent infinite loop

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

  // Wire up global keyboard shortcuts
  useGlobalKeyboard();
  // Wire up Ctrl+S file saving
  useSaveFile();

  const handleLoginSuccess = (authToken: string) => {
    setToken(authToken);
    setIsAuthenticated(true);
    scheduleTokenRefresh();
  };

  // Only require authentication for remote kernel mode
  // Local mode (Phase 1) works standalone without a server
  if (kernelMode === 'remote' && !isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <KernelProvider>
      <UvWarningBanner />
      <AppLayout onLogout={handleLogout} />
      {isSettingsOpen && <SettingsDialog />}
    </KernelProvider>
  );
}

export default App;
