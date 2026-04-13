import { create } from 'zustand';
import { SettingsService } from '../services/SettingsService';
import type { PlatformService } from '@pyide/platform';

// Platform instance injected at app startup via initSettingsPlatform()
let _platform: PlatformService | null = null;

/** Call once at app startup (after PlatformProvider mounts) to inject the platform. */
export function initSettingsPlatform(platform: PlatformService) {
  _platform = platform;
}

type Theme = 'dark' | 'light' | 'system';

interface AiConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

interface SettingsState {
  theme: Theme;
  vimMode: boolean;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  aiConfig: AiConfig;
  serverUrl: string;
  customShortcuts: Record<string, string>;

  setTheme: (theme: Theme) => void;
  toggleVimMode: () => void;
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
  setWordWrap: (wrap: boolean) => void;
  setMinimap: (minimap: boolean) => void;
  setAiConfig: (config: Partial<AiConfig>) => void;
  setServerUrl: (url: string) => void;
  setCustomShortcuts: (shortcuts: Record<string, string>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const defaultSettings = {
  theme: 'dark' as Theme,
  vimMode: false,
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  minimap: false,
  aiConfig: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelId: 'gpt-4o',
  },
  serverUrl: 'http://localhost:8000',
  customShortcuts: {} as Record<string, string>,
};

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,

  setTheme: (theme) => {
    set(() => ({ theme }));
    applyTheme(theme);
  },

  toggleVimMode: () => set((state) => ({ vimMode: !state.vimMode })),

  setFontSize: (fontSize) => set(() => ({ fontSize })),

  setTabSize: (tabSize) => set(() => ({ tabSize })),

  setWordWrap: (wordWrap) => set(() => ({ wordWrap })),

  setMinimap: (minimap) => set(() => ({ minimap })),

  setAiConfig: (config) =>
    set((state) => ({
      aiConfig: { ...state.aiConfig, ...config },
    })),

  setServerUrl: (serverUrl) => set(() => ({ serverUrl })),

  setCustomShortcuts: (customShortcuts) => set(() => ({ customShortcuts })),

  loadSettings: async () => {
    if (!_platform) return;
    try {
      const loaded = await SettingsService.load(_platform);
      set(() => ({
        theme: loaded.theme,
        vimMode: loaded.vimMode,
        fontSize: loaded.fontSize,
        tabSize: loaded.tabSize,
        wordWrap: loaded.wordWrap,
        minimap: loaded.minimap,
        aiConfig: loaded.aiConfig,
        serverUrl: loaded.serverUrl ?? 'http://localhost:8000',
        customShortcuts: loaded.customShortcuts ?? {},
      }));
      applyTheme(loaded.theme);
    } catch {
      // Keep defaults on failure
    }
  },

  saveSettings: async () => {
    if (!_platform) return;
    const { theme, vimMode, fontSize, tabSize, wordWrap, minimap, aiConfig, serverUrl, customShortcuts } = get();
    await SettingsService.save(_platform, { theme, vimMode, fontSize, tabSize, wordWrap, minimap, aiConfig, serverUrl, customShortcuts });
  },
}));
