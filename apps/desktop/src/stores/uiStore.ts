import { create } from 'zustand';
import { useEnvStore } from './envStore';

type LeftPanel = 'files' | 'skills' | 'mcp' | 'memory';
type RightTab = 'variables' | 'plots' | 'chat' | 'environment';

interface UiState {
  leftSidebarVisible: boolean;
  rightPanelVisible: boolean;
  leftSidebarWidth: number;
  rightPanelWidth: number;
  outputPanelHeight: number;
  activeLeftPanel: LeftPanel;
  activeRightTab: RightTab;
  workspacePath: string | null;
  isSettingsOpen: boolean;
  kernelMode: 'local' | 'remote';

  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setOutputPanelHeight: (height: number) => void;
  setActiveLeftPanel: (panel: LeftPanel) => void;
  setActiveRightTab: (tab: RightTab) => void;
  setWorkspacePath: (path: string) => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setKernelMode: (mode: 'local' | 'remote') => void;
}

export const useUiStore = create<UiState>((set) => ({
  leftSidebarVisible: true,
  rightPanelVisible: true,
  leftSidebarWidth: 220,
  rightPanelWidth: 320,
  outputPanelHeight: 250,
  activeLeftPanel: 'files',
  activeRightTab: 'variables',
  workspacePath: null,
  isSettingsOpen: false,
  kernelMode: 'local',

  toggleLeftSidebar: () =>
    set((state) => ({ leftSidebarVisible: !state.leftSidebarVisible })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),

  setLeftSidebarWidth: (width) =>
    set(() => ({ leftSidebarWidth: width })),

  setRightPanelWidth: (width) =>
    set(() => ({ rightPanelWidth: width })),

  setOutputPanelHeight: (height) =>
    set(() => ({ outputPanelHeight: height })),

  setActiveLeftPanel: (panel) =>
    set(() => ({ activeLeftPanel: panel })),

  setActiveRightTab: (tab) =>
    set(() => ({ activeRightTab: tab })),

  setWorkspacePath: (path) =>
    set(() => ({ workspacePath: path })),

  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  openSettings: () => set(() => ({ isSettingsOpen: true })),

  closeSettings: () => set(() => ({ isSettingsOpen: false })),

  setKernelMode: (mode) => {
    set(() => ({ kernelMode: mode }));
    // 切换模式时清空环境信息，避免 remote 模式显示 local 的 Python 版本
    useEnvStore.getState().setActiveVenv(null);
  },
}));
