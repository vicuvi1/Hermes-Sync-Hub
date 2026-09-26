import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { IPC_CHANNELS } from '@hermes-hub/protocol';
import { Device, OverallStats } from '@hermes-hub/types';
import { MOCK_DEVICES, MOCK_OVERALL_STATS, redactSecrets } from '@hermes-hub/shared';
import {
  DeviceIdentityService,
  DeviceRegistryService,
  AgentServer,
  HealthMonitorService,
  HermesService,
  TailscaleAdapter,
  SyncthingAdapter,
  PairingService,
  WorkspaceService,
  SyncEngineService,
  HermesSessionService,
  BackupService,
  RevisionService,
  DiagnosticsService,
} from '@hermes-hub/agent';
import { SettingsManager } from './settings.js';
import { setupTray, destroyTray } from './tray.js';
import { sendDesktopNotification } from './notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;
const settingsManager = new SettingsManager();
const deviceIdentity = new DeviceIdentityService();
const deviceRegistry = new DeviceRegistryService(deviceIdentity);
const healthMonitor = new HealthMonitorService(deviceIdentity);
const hermesService = new HermesService();
const tailscaleAdapter = new TailscaleAdapter();
const syncthingAdapter = new SyncthingAdapter();
const pairingService = new PairingService(
  deviceIdentity,
  deviceRegistry,
  tailscaleAdapter,
  syncthingAdapter,
  hermesService
);
const workspaceService = new WorkspaceService(deviceIdentity, hermesService);
const syncEngine = new SyncEngineService(
  workspaceService,
  hermesService,
  deviceRegistry,
  syncthingAdapter
);
const sessionService = new HermesSessionService(hermesService, workspaceService);
const backupService = new BackupService(workspaceService, hermesService, deviceIdentity);
const revisionService = new RevisionService(workspaceService, deviceIdentity);
const diagnosticsService = new DiagnosticsService(
  deviceIdentity,
  healthMonitor,
  hermesService,
  tailscaleAdapter,
  syncthingAdapter,
  workspaceService,
  backupService
);

const agentServer = new AgentServer(
  deviceIdentity,
  healthMonitor,
  hermesService,
  tailscaleAdapter,
  syncthingAdapter,
  deviceRegistry,
  pairingService,
  workspaceService,
  syncEngine,
  sessionService,
  backupService,
  revisionService,
  diagnosticsService
);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Hermes Hub',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    const settings = settingsManager.getSettings();
    if (!settings.minimizeToTray) {
      mainWindow?.show();
    }
  });

  // Never leave users with an invisible process if the renderer is slow to
  // paint or a background integration is unavailable during startup.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1500);

  // Close to tray behavior
  mainWindow.on('close', (event) => {
    const settings = settingsManager.getSettings();
    if (settings.closeToTray && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const distIndexPath = path.join(__dirname, '../dist/index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      mainWindow?.loadFile(distIndexPath);
    });
  } else if (fs.existsSync(distIndexPath)) {
    mainWindow.loadFile(distIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.warn('Vite dev server not found and dist/index.html missing');
    });
  }

  // Open external links safely in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Milestone 2, 4 & 5 IPC Handlers for Local Device Agent & Network/Sync State
ipcMain.handle(IPC_CHANNELS.GET_LOCAL_DEVICE, async () => {
  const localDev = deviceIdentity.getLocalDevice();
  try {
    const tsState = await tailscaleAdapter.getState();
    if (tsState.installed) {
      localDev.tailscale = {
        installed: tsState.installed,
        connected: tsState.connected,
        ip: tsState.self?.ipv4 || (tsState.self?.tailscaleIps && tsState.self.tailscaleIps[0]),
        connectionType: 'direct',
        peersCount: tsState.peers.length,
      };
    } else {
      localDev.tailscale = {
        installed: false,
        connected: false,
        connectionType: 'unknown',
        peersCount: 0,
      };
    }
  } catch {}

  try {
    const syncState = await syncthingAdapter.getState();
    if (syncState.installed) {
      localDev.syncthing = {
        installed: syncState.installed,
        running: syncState.running,
        deviceId: syncState.myID || localDev.syncthing.deviceId,
        version: syncState.version || localDev.syncthing.version,
        foldersCount: syncState.folders.length,
      };
    }
  } catch {}

  return localDev;
});

ipcMain.handle(IPC_CHANNELS.GET_AGENT_HEALTH, async () => {
  return healthMonitor.getHealthSnapshot();
});

ipcMain.handle(IPC_CHANNELS.PING_AGENT, async () => {
  return { pong: true, time: new Date().toISOString() };
});

ipcMain.handle(IPC_CHANNELS.GET_HERMES_STATUS, async () => {
  return hermesService.getStatus();
});

ipcMain.handle(IPC_CHANNELS.GET_TAILSCALE_STATE, async () => {
  return tailscaleAdapter.getState();
});

ipcMain.handle(IPC_CHANNELS.PING_TAILSCALE_PEER, async (_event, ipOrHost: string) => {
  return tailscaleAdapter.pingPeer(ipOrHost);
});

ipcMain.handle(IPC_CHANNELS.GET_SYNCTHING_STATE, async () => {
  return syncthingAdapter.getState();
});

ipcMain.handle(IPC_CHANNELS.GET_DEVICES, async () => {
  return deviceRegistry.reconcile(tailscaleAdapter, syncthingAdapter);
});

ipcMain.handle(IPC_CHANNELS.GET_DEVICE_DETAIL, async (_event, deviceId: string) => {
  return deviceRegistry.getDeviceById(deviceId);
});

ipcMain.handle(IPC_CHANNELS.ADD_DEVICE, async (_event, deviceData: Partial<Device>) => {
  return deviceRegistry.addDevice(deviceData);
});

ipcMain.handle(IPC_CHANNELS.REMOVE_DEVICE, async (_event, deviceId: string) => {
  return deviceRegistry.removeDevice(deviceId);
});

ipcMain.handle(IPC_CHANNELS.UPDATE_DEVICE, async (_event, deviceId: string, updates: Partial<Device>) => {
  return deviceRegistry.updateDevice(deviceId, updates);
});

ipcMain.handle(IPC_CHANNELS.COMPARE_DEVICES, async (_event, aId: string, bId: string) => {
  return deviceRegistry.compareDevices(aId, bId);
});

ipcMain.handle(IPC_CHANNELS.GENERATE_PAIRING_INVITATION, async () => {
  return pairingService.generateInvitation();
});

ipcMain.handle(IPC_CHANNELS.GET_ACTIVE_PAIRING_INVITATION, async () => {
  return pairingService.getActiveInvitation();
});

ipcMain.handle(IPC_CHANNELS.VALIDATE_PAIRING_CODE, async (_event, codeOrPayload: string) => {
  return pairingService.validateCodeOrPayload(codeOrPayload);
});

ipcMain.handle(IPC_CHANNELS.EXECUTE_PAIRING, async (_event, payload: any) => {
  return pairingService.executePairing(payload);
});

// Milestone 8 Managed Workspace, Manifests & Snapshots
ipcMain.handle(IPC_CHANNELS.GET_WORKSPACE_STATUS, async () => {
  return workspaceService.getWorkspaceStatus();
});

ipcMain.handle(IPC_CHANNELS.INIT_WORKSPACE, async () => {
  return workspaceService.initWorkspace();
});

ipcMain.handle(IPC_CHANNELS.GET_MANIFEST, async () => {
  return workspaceService.getManifest();
});

ipcMain.handle(IPC_CHANNELS.GENERATE_MANIFEST, async () => {
  return workspaceService.generateManifest();
});

ipcMain.handle(IPC_CHANNELS.VERIFY_MANIFEST, async () => {
  return workspaceService.verifyManifest();
});

ipcMain.handle(IPC_CHANNELS.GET_SNAPSHOTS, async () => {
  return workspaceService.getSnapshots();
});

ipcMain.handle(IPC_CHANNELS.CREATE_SAFE_SNAPSHOT, async (_event, options: any) => {
  return workspaceService.createSafeSnapshot(options);
});

ipcMain.handle(IPC_CHANNELS.GET_OVERALL_STATS, async () => {
  const devices = await deviceRegistry.getAllDevices();
  const onlineCount = devices.filter((d) => d.online).length;
  const sessionsCount = devices.reduce((sum, d) => sum + (d.data?.sessions || 0), 0);
  const memoriesCount = devices.reduce((sum, d) => sum + (d.data?.memories || 0), 0);
  const skillsCount = devices.reduce((sum, d) => sum + (d.data?.skills || 0), 0);
  const pendingFilesCount = devices.reduce((sum, d) => sum + (d.sync?.pendingFiles || 0), 0);
  const conflictsCount = devices.reduce((sum, d) => sum + (d.sync?.conflicts || 0), 0);

  let syncHealth: OverallStats['syncHealth'] = 'all_synced';
  if (conflictsCount > 0) syncHealth = 'has_conflicts';
  else if (pendingFilesCount > 0) syncHealth = 'syncing';
  else if (onlineCount < devices.length) syncHealth = 'offline_changes';

  return {
    devicesCount: devices.length,
    onlineCount,
    sessionsCount,
    memoriesCount,
    skillsCount,
    pendingFilesCount,
    conflictsCount,
    syncHealth,
  };
});

ipcMain.handle(IPC_CHANNELS.TRIGGER_SYNC_NOW, async () => {
  try {
    const result = await syncEngine.executeSyncCycle();
    return { success: true, message: 'Sync cycle completed successfully', result };
  } catch (err: any) {
    return { success: false, message: err.message || 'Sync failed' };
  }
});

ipcMain.handle(IPC_CHANNELS.TRIGGER_SYNC_CYCLE, async (_event, options: any) => {
  return syncEngine.executeSyncCycle(options);
});

ipcMain.handle(IPC_CHANNELS.GET_SYNC_SUMMARY, async () => {
  return syncEngine.getSyncSummary();
});

ipcMain.handle(IPC_CHANNELS.GET_SYNC_CONFLICTS, async () => {
  return syncEngine.getConflicts();
});

ipcMain.handle(IPC_CHANNELS.RESOLVE_SYNC_CONFLICT, async (_event, conflictId: string, resolution: any) => {
  return syncEngine.resolveConflict(conflictId, resolution);
});

// Milestone 10 Safe Session Access, Export & Import
ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async (_event, options?: any) => {
  return sessionService.listSessions(options || {});
});

ipcMain.handle(IPC_CHANNELS.GET_SESSION_DETAIL, async (_event, sessionId: string) => {
  return sessionService.getSessionDetail(sessionId);
});

ipcMain.handle(IPC_CHANNELS.EXPORT_SESSION, async (_event, options: any) => {
  return sessionService.exportSession(options);
});

ipcMain.handle(IPC_CHANNELS.IMPORT_SESSION, async (_event, payload: any) => {
  return sessionService.importSession(payload);
});

// Milestone 12 Backups & Revisions
ipcMain.handle(IPC_CHANNELS.GET_BACKUPS, async () => {
  return backupService.getBackups();
});

ipcMain.handle(IPC_CHANNELS.CREATE_BACKUP, async (_event, options?: any) => {
  const b = await backupService.createBackup(options);
  sendDesktopNotification('Backup Created', `Backup ${b.name} captured successfully.`);
  return b;
});

ipcMain.handle(IPC_CHANNELS.VERIFY_BACKUP, async (_event, backupId: string) => {
  return backupService.verifyBackup(backupId);
});

ipcMain.handle(IPC_CHANNELS.RESTORE_BACKUP, async (_event, options: any) => {
  return backupService.restoreBackup(options);
});

ipcMain.handle(IPC_CHANNELS.DELETE_BACKUP, async (_event, backupId: string) => {
  return backupService.deleteBackup(backupId);
});

ipcMain.handle(IPC_CHANNELS.GET_FILE_REVISIONS, async (_event, filePath?: string) => {
  if (filePath) {
    return revisionService.getFileRevisions(filePath);
  }
  return revisionService.getAllRevisions();
});

ipcMain.handle(IPC_CHANNELS.ROLLBACK_REVISION, async (_event, filePath: string, targetRevision: number) => {
  return revisionService.rollbackRevision(filePath, targetRevision);
});

// Milestone 13 Polish & Diagnostics
ipcMain.handle(IPC_CHANNELS.GET_APP_SETTINGS, async () => {
  return settingsManager.getSettings();
});

ipcMain.handle(IPC_CHANNELS.UPDATE_APP_SETTINGS, async (_event, updates: any) => {
  return settingsManager.updateSettings(updates);
});

ipcMain.handle(IPC_CHANNELS.SHOW_NOTIFICATION, async (_event, title: string, body: string) => {
  return sendDesktopNotification(title, body);
});

ipcMain.handle(IPC_CHANNELS.GET_DIAGNOSTICS_REPORT, async () => {
  return diagnosticsService.generateDiagnosticsReport();
});

ipcMain.handle(IPC_CHANNELS.GITHUB_UPDATE, async () => {
  const repositoryRoot = path.resolve(__dirname, '../../..');
  const runGit = async (args: string[]) => {
    const result = await execFileAsync('git', args, {
      cwd: repositoryRoot,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout.trim();
  };

  try {
    const dirtyFiles = await runGit(['status', '--porcelain']);
    if (dirtyFiles) {
      return {
        success: false,
        status: 'blocked',
        message: 'Update paused because this installation has local changes. Commit or discard them first.',
      };
    }

    const previousCommit = await runGit(['rev-parse', '--short', 'HEAD']);
    await runGit(['-c', 'http.sslBackend=openssl', 'fetch', 'origin', 'main']);
    const localCommit = await runGit(['rev-parse', 'HEAD']);
    const remoteCommit = await runGit(['rev-parse', 'origin/main']);

    if (localCommit === remoteCommit) {
      return {
        success: true,
        status: 'up-to-date',
        message: `Hermes Hub is already up to date (${previousCommit}).`,
        previousCommit,
        currentCommit: previousCommit,
      };
    }

    const commonAncestor = await runGit(['merge-base', localCommit, remoteCommit]);
    if (commonAncestor !== localCommit) {
      return {
        success: false,
        status: 'blocked',
        message: 'The local branch has diverged from GitHub. Update safely from Git before using one-click updates.',
        previousCommit,
      };
    }

    await runGit(['-c', 'http.sslBackend=openssl', 'pull', '--ff-only', 'origin', 'main']);
    const commandShell = process.env.ComSpec || 'cmd.exe';
    await execFileAsync(commandShell, ['/d', '/s', '/c', 'pnpm install --frozen-lockfile && pnpm build'], {
      cwd: repositoryRoot,
      timeout: 10 * 60_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    const currentCommit = await runGit(['rev-parse', '--short', 'HEAD']);

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1500);

    return {
      success: true,
      status: 'updated',
      message: `Updated from ${previousCommit} to ${currentCommit}. Restarting Hermes Hub…`,
      previousCommit,
      currentCommit,
      restartScheduled: true,
    };
  } catch (error: any) {
    const detail = error?.stderr?.trim() || error?.message || 'Unknown update error';
    return {
      success: false,
      status: 'failed',
      message: `GitHub update failed: ${detail}`,
    };
  }
});

ipcMain.handle(IPC_CHANNELS.EXPORT_DIAGNOSTICS, async (_event, outputPath?: string) => {
  const filePath = await diagnosticsService.exportDiagnosticsToFile(outputPath);
  const report = await diagnosticsService.generateDiagnosticsReport();
  return {
    success: true,
    filePath,
    report,
  };
});

ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_event, folderPath: string) => {
  await shell.openPath(folderPath);
  return true;
});

app.whenReady().then(() => {
  // Create the desktop window first. Network or integration startup must never
  // prevent the control center from becoming visible.
  createWindow();

  agentServer.start()
    .then((port) => console.log(`[AgentServer] Loopback HTTP server running on 127.0.0.1:${port}`))
    .catch((err) => console.warn(`[AgentServer] Failed to bind default port, running in-process:`, err));

  if (mainWindow) {
    setupTray(mainWindow, settingsManager, {
      onSyncNow: async () => {
        const res = await syncEngine.executeSyncCycle();
        sendDesktopNotification('Sync Completed', `Synchronized ${res.actions.length} file action(s).`);
      },
      onCreateBackup: async () => {
        const b = await backupService.createBackup();
        sendDesktopNotification('Backup Created', `Snapshot archive ${b.name} created successfully.`);
      },
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  const settings = settingsManager.getSettings();
  if (settings.closeToTray) {
    // Keep app running in tray
    return;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  (app as any).isQuitting = true;
  destroyTray();
  await agentServer.stop();
});
