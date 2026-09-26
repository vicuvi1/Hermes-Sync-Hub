import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SettingsManager } from './settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray: Tray | null = null;

// Clean 16x16 PNG icon encoded in base64 as built-in fallback
const FALLBACK_ICON_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGL8//8/AyUYiFn+48ME1bMxMDL8JybeM/z/T0hTz8TAkGDA8J9Y9fxn+H90i4EhmYPhf6IBw3+SZjK+FwYMH8B6+BgYGBgZ/rMwEvM07pCgN5yIBgwDYw0Yhv8kSDEAAK7zL5H1L9xKAAAAAElFTkSuQmCC';

export function setupTray(
  mainWindow: BrowserWindow,
  settingsManager: SettingsManager,
  callbacks?: {
    onSyncNow?: () => Promise<void>;
    onCreateBackup?: () => Promise<void>;
  }
): Tray {
  if (tray) return tray;

  let icon = nativeImage.createFromDataURL(FALLBACK_ICON_BASE64);

  // Check if an assets/icon.png exists on disk
  const possiblePaths = [
    path.join(__dirname, '../assets/icon.png'),
    path.join(__dirname, '../../assets/icon.png'),
    path.join(process.cwd(), 'apps/desktop/assets/icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      icon = nativeImage.createFromPath(p);
      break;
    }
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Hermes Hub - Agent State & Mesh Sync');

  const updateContextMenu = () => {
    const settings = settingsManager.getSettings();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Hermes Hub',
        type: 'normal',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open Dashboard',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Trigger Sync Cycle',
        click: async () => {
          if (callbacks?.onSyncNow) {
            await callbacks.onSyncNow();
          }
        },
      },
      {
        label: 'Create Safe Backup',
        click: async () => {
          if (callbacks?.onCreateBackup) {
            await callbacks.onCreateBackup();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Launch on Startup',
        type: 'checkbox',
        checked: settings.launchOnStartup,
        click: (item) => {
          settingsManager.updateSettings({ launchOnStartup: item.checked });
        },
      },
      {
        label: 'Close to Tray',
        type: 'checkbox',
        checked: settings.closeToTray,
        click: (item) => {
          settingsManager.updateSettings({ closeToTray: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Hermes Hub',
        click: () => {
          // Explicit user quit from tray exits app completely
          (app as any).isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
