import { create } from 'zustand';

export interface VenvInfo {
  name: string;
  path: string;
  pythonVersion: string;
}

export interface PackageInfo {
  name: string;
  version: string;
}

interface EnvState {
  venvs: VenvInfo[];
  activeVenv: VenvInfo | null;
  packages: PackageInfo[];
  uvInstalled: boolean;
  uvWarningDismissed: boolean;
  isLoading: boolean;

  setVenvs: (venvs: VenvInfo[]) => void;
  setActiveVenv: (venv: VenvInfo | null) => void;
  setPackages: (packages: PackageInfo[]) => void;
  setUvInstalled: (installed: boolean) => void;
  setUvWarningDismissed: (dismissed: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useEnvStore = create<EnvState>((set) => ({
  venvs: [],
  activeVenv: null,
  packages: [],
  uvInstalled: false,
  uvWarningDismissed: false,
  isLoading: false,

  setVenvs: (venvs) => set({ venvs }),
  setActiveVenv: (activeVenv) => set({ activeVenv }),
  setPackages: (packages) => set({ packages }),
  setUvInstalled: (uvInstalled) => set({ uvInstalled }),
  setUvWarningDismissed: (uvWarningDismissed) => set({ uvWarningDismissed }),
  setLoading: (isLoading) => set({ isLoading }),
}));
