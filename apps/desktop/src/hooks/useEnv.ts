import { useCallback } from 'react';
import { usePlatform } from '@pyide/platform';
import { useEnvStore, type VenvInfo } from '../stores/envStore';

export function useEnv() {
  const store = useEnvStore();
  const platform = usePlatform();

  // ── uv presence check ──────────────────────────────────────────────────────

  const checkUv = useCallback(async (): Promise<boolean> => {
    if (!platform.env) {
      store.setUvInstalled(false);
      return false;
    }
    try {
      const installed = await platform.env.checkUv();
      store.setUvInstalled(installed);
      return installed;
    } catch {
      store.setUvInstalled(false);
      return false;
    }
  }, [store, platform]);

  // ── Venv list ──────────────────────────────────────────────────────────────

  const refreshVenvs = useCallback(
    async (projectPath: string): Promise<void> => {
      if (!platform.env) return;
      store.setLoading(true);
      try {
        const venvs = await platform.env.listVenvs(projectPath);
        store.setVenvs(venvs);
      } catch (err) {
        console.error('[useEnv] Failed to list venvs:', err);
      } finally {
        store.setLoading(false);
      }
    },
    [store, platform],
  );

  // ── Create / delete venv ───────────────────────────────────────────────────

  const createVenv = useCallback(
    async (name: string, projectPath: string, pythonVersion?: string): Promise<VenvInfo> => {
      if (!platform.env) throw new Error('Environment management not available on this platform');
      const venv = await platform.env.createVenv(name, projectPath, pythonVersion);
      await refreshVenvs(projectPath);
      return venv;
    },
    [refreshVenvs, platform],
  );

  const deleteVenv = useCallback(
    async (name: string, projectPath: string): Promise<void> => {
      if (!platform.env) throw new Error('Environment management not available on this platform');
      await platform.env.deleteVenv(name, projectPath);
      // If the deleted venv was active, clear it
      if (store.activeVenv?.name === name) {
        store.setActiveVenv(null);
      }
      await refreshVenvs(projectPath);
    },
    [store, refreshVenvs, platform],
  );

  // ── Package management ─────────────────────────────────────────────────────

  const refreshPackages = useCallback(async (): Promise<void> => {
    const { activeVenv } = store;
    if (!activeVenv || !platform.env) return;
    try {
      const packages = await platform.env.listPackages(activeVenv.path);
      store.setPackages(packages);
    } catch (err) {
      console.error('[useEnv] Failed to list packages:', err);
    }
  }, [store, platform]);

  const installPackage = useCallback(
    async (pkg: string): Promise<string> => {
      if (!store.activeVenv) throw new Error('No active venv selected');
      if (!platform.env) throw new Error('Environment management not available on this platform');
      const result = await platform.env.installPackage(pkg, store.activeVenv.path);
      await refreshPackages();
      return result;
    },
    [store, refreshPackages, platform],
  );

  const uninstallPackage = useCallback(
    async (pkg: string): Promise<void> => {
      if (!store.activeVenv) throw new Error('No active venv selected');
      if (!platform.env) throw new Error('Environment management not available on this platform');
      await platform.env.uninstallPackage(pkg, store.activeVenv.path);
      await refreshPackages();
    },
    [store, refreshPackages, platform],
  );

  // ── Python path helper ─────────────────────────────────────────────────────

  const getPythonPath = useCallback(async (): Promise<string | null> => {
    if (!store.activeVenv || !platform.env) return null;
    try {
      return await platform.env.getPythonPath(store.activeVenv.path);
    } catch {
      return null;
    }
  }, [store, platform]);

  return {
    ...store,
    checkUv,
    refreshVenvs,
    createVenv,
    deleteVenv,
    installPackage,
    uninstallPackage,
    refreshPackages,
    getPythonPath,
  };
}
