import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AppSettings } from '@hermes-hub/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  launchOnStartup: false,
  minimizeToTray: false,
  closeToTray: true,
  notificationsEnabled: true,
  autoBackupEnabled: true,
  autoBackupFrequency: 'daily',
  maxBackupsToRetain: 10,
};

export class SettingsManager {
  private filePath: string;
  private settings: AppSettings;

  constructor() {
    const userData = app.getPath('userData');
    this.filePath = path.join(userData, 'hermes-hub-settings.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.warn('Failed to parse settings file, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updates };

    // Apply startup setting to OS login items
    if (updates.launchOnStartup !== undefined) {
      try {
        app.setLoginItemSettings({
          openAtLogin: updates.launchOnStartup,
          openAsHidden: true,
          name: 'Hermes Hub',
        });
      } catch (err) {
        console.warn('Could not set login item settings:', err);
      }
    }

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to write settings file:', err);
    }

    return { ...this.settings };
  }
}
