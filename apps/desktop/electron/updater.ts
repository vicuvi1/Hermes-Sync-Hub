import { app, BrowserWindow } from 'electron';
import updater from 'electron-updater';
import type { UpdateInfo } from 'electron-updater';
import { AppUpdateInfo, AppUpdateProgress } from '@hermes-hub/types';
import { IPC_CHANNELS } from '@hermes-hub/protocol';

const { autoUpdater } = updater;

function releaseNotes(info?: UpdateInfo): string | undefined {
  if (!info?.releaseNotes) return undefined;
  if (typeof info.releaseNotes === 'string') return info.releaseNotes;
  return info.releaseNotes.map((note) => `${note.version}: ${note.note || ''}`).join('\n');
}

export class UpdateManager {
  private state: AppUpdateProgress;
  private updateAvailable = false;
  private installAfterDownload = false;

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    this.state = {
      state: app.isPackaged ? 'idle' : 'disabled',
      currentVersion: app.getVersion(),
      message: app.isPackaged
        ? 'Ready to check GitHub Releases.'
        : 'Release updates are disabled in development builds.',
      packaged: app.isPackaged,
    };

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => this.publish({ state: 'checking', message: 'Checking GitHub Releases…' }));
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.publish({
        state: 'available',
        latestVersion: info.version,
        releaseName: info.releaseName || undefined,
        releaseNotes: releaseNotes(info),
        message: `Hermes Hub ${info.version} is available.`,
      });
    });
    autoUpdater.on('update-not-available', (info) => {
      this.updateAvailable = false;
      this.publish({ state: 'current', latestVersion: info.version, message: 'Hermes Hub is up to date.' });
    });
    autoUpdater.on('download-progress', (progress) => this.publish({
      state: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
      message: `Downloading update… ${Math.round(progress.percent)}%`,
    }));
    autoUpdater.on('update-downloaded', (info) => {
      this.publish({
        state: 'restart-pending',
        latestVersion: info.version,
        message: 'Update verified. Restarting Hermes Hub…',
      });
      if (this.installAfterDownload) {
        setTimeout(() => {
          this.publish({ state: 'installing', message: 'Installing update and restarting Hermes Hub…' });
          autoUpdater.quitAndInstall(false, true);
        }, 1200);
      }
    });
    autoUpdater.on('error', (error) => {
      const offline = /ENOTFOUND|ETIMEDOUT|network|offline/i.test(error.message);
      this.publish({
        state: offline ? 'offline' : 'failed',
        message: offline ? 'Unable to reach GitHub. Check your connection and try again.' : `Update failed: ${error.message}`,
      });
    });
  }

  getState(): AppUpdateProgress {
    return { ...this.state };
  }

  async check(): Promise<AppUpdateInfo> {
    if (!app.isPackaged) return this.getState();
    this.publish({ state: 'checking', message: 'Checking GitHub Releases…' });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error: any) {
      const offline = /ENOTFOUND|ETIMEDOUT|network|offline/i.test(error?.message || '');
      this.publish({
        state: offline ? 'offline' : 'failed',
        message: offline ? 'Unable to reach GitHub. Check your connection and try again.' : `Update failed: ${error?.message || 'Unknown error'}`,
      });
    }
    return this.getState();
  }

  async downloadAndInstall(): Promise<AppUpdateInfo> {
    if (!app.isPackaged) return this.getState();
    if (!this.updateAvailable) await this.check();
    if (!this.updateAvailable) return this.getState();
    this.installAfterDownload = true;
    this.publish({ state: 'downloading', percent: 0, message: 'Starting update download…' });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error: any) {
      this.publish({ state: 'failed', message: `Update download failed: ${error?.message || 'Unknown error'}` });
    }
    return this.getState();
  }

  private publish(update: Partial<AppUpdateProgress>): void {
    this.state = { ...this.state, ...update, currentVersion: app.getVersion(), packaged: app.isPackaged };
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(IPC_CHANNELS.UPDATE_STATUS, this.getState());
  }
}
