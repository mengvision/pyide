import type { PlatformService } from '@pyide/platform';

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  vimMode: boolean;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  aiConfig: {
    baseUrl: string;
    apiKey: string;
    modelId: string;
  };
  serverUrl: string;
  customShortcuts: Record<string, string>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
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
  customShortcuts: {},
};

export class SettingsService {
  static async getSettingsPath(platform: PlatformService): Promise<string> {
    try {
      const homeDir = await platform.file.getHomeDir();
      // Normalize separators: on Windows homeDir uses backslashes
      const normalized = homeDir.replace(/\\/g, '/');
      return `${normalized}/.pyide/settings.json`;
    } catch {
      return './.pyide/settings.json';
    }
  }

  static async load(platform: PlatformService): Promise<AppSettings> {
    try {
      const path = await this.getSettingsPath(platform);
      const content = await platform.file.read(path);
      const loaded = JSON.parse(content) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...loaded,
        aiConfig: { ...DEFAULT_SETTINGS.aiConfig, ...(loaded.aiConfig ?? {}) },
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static async save(platform: PlatformService, settings: AppSettings): Promise<void> {
    const path = await this.getSettingsPath(platform);
    await platform.file.write(path, JSON.stringify(settings, null, 2));
  }
}
