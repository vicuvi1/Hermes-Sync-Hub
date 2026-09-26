import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type OpenDialogOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '@hermes-hub/protocol';
import { CompleteOnboardingInput, Device, OverallStats, RuntimeHealth, SourceRepositoryPushInput, VaultSecret } from '@hermes-hub/types';
import { redactSecrets } from '@hermes-hub/shared';
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
  MeshCoordinatorService,
  RevisionService,
  DiagnosticsService,
  VaultService,
} from '@hermes-hub/agent';
import { SettingsManager } from './settings.js';
import { setupTray, destroyTray } from './tray.js';
import { sendDesktopNotification } from './notifications.js';
import { UpdateManager } from './updater.js';
import { SourceRepositoryService } from './sourceRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow: BrowserWindow | null = null;
const settingsManager = new SettingsManager();
const configuredSettings = settingsManager.getSettings();
const deviceIdentity = new DeviceIdentityService();
const deviceRegistry = new DeviceRegistryService(deviceIdentity, undefined, false);
const healthMonitor = new HealthMonitorService(deviceIdentity);
const hermesService = new HermesService(configuredSettings.hermesHome);
const tailscaleAdapter = new TailscaleAdapter();
const syncthingAdapter = new SyncthingAdapter();
const pairingService = new PairingService(
  deviceIdentity,
  deviceRegistry,
  tailscaleAdapter,
  syncthingAdapter,
  hermesService
);
const workspaceService = new WorkspaceService(deviceIdentity, hermesService, configuredSettings.workspacePath);
const syncEngine = new SyncEngineService(
  workspaceService,
  hermesService,
  deviceRegistry,
  syncthingAdapter
);
const sessionService = new HermesSessionService(hermesService, workspaceService);
const backupService = new BackupService(workspaceService, hermesService, deviceIdentity);
const revisionService = new RevisionService(workspaceService, deviceIdentity);
const meshCoordinator = new MeshCoordinatorService(workspaceService, deviceRegistry, backupService, syncEngine);
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
let updateManager: UpdateManager | null = null;
let vaultService: VaultService | null = null;
const sourceRepositoryService = new SourceRepositoryService();

function appendCrashLog(kind: string, error: unknown): void {
  try {
    const logDirectory = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDirectory, { recursive: true });
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(path.join(logDirectory, 'main-process.log'), `[${new Date().toISOString()}] ${kind}\n${redactSecrets(detail)}\n\n`);
  } catch {}
}

process.on('uncaughtException', (error) => appendCrashLog('uncaughtException', error));
process.on('unhandledRejection', (error) => appendCrashLog('unhandledRejection', error));

function getVaultService(): VaultService {
  if (vaultService) return vaultService;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable');
  const vaultDirectory = path.join(app.getPath('userData'), 'vault');
  const keyPath = path.join(vaultDirectory, 'master-key.bin');
  fs.mkdirSync(vaultDirectory, { recursive: true });
  let masterKey: Buffer;
  if (fs.existsSync(keyPath)) {
    masterKey = Buffer.from(safeStorage.decryptString(fs.readFileSync(keyPath)), 'base64');
  } else {
    masterKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, safeStorage.encryptString(masterKey.toString('base64')));
  }
  vaultService = new VaultService(path.join(vaultDirectory, 'secrets.vault.enc'), masterKey);
  return vaultService;
}

async function getRuntimeHealth(): Promise<RuntimeHealth> {
  const [agentResult, hermesResult, tailscaleResult, syncthingResult, workspaceResult, syncResult] = await Promise.allSettled([
    healthMonitor.getHealthSnapshot(),
    hermesService.getStatus(),
    tailscaleAdapter.getState(),
    syncthingAdapter.getState(),
    workspaceService.getWorkspaceStatus(),
    syncEngine.getSyncSummary(),
  ]);
  const hermes = hermesResult.status === 'fulfilled' ? hermesResult.value : null;
  const tailscale = tailscaleResult.status === 'fulfilled' ? tailscaleResult.value : null;
  const syncthing = syncthingResult.status === 'fulfilled' ? syncthingResult.value : null;
  const workspace = workspaceResult.status === 'fulfilled' ? workspaceResult.value : null;
  const services: RuntimeHealth['services'] = {
    agent: agentResult.status === 'fulfilled'
      ? { state: 'healthy', label: 'Local agent', detail: 'Background services are responding.', required: true }
      : { state: 'error', label: 'Local agent', detail: 'The local agent did not respond.', required: true },
    hermes: hermes?.isInstalled
      ? { state: hermes.isRunning ? 'healthy' : 'offline', label: 'Hermes Agent', detail: hermes.isRunning ? `Running ${hermes.version}` : 'Installed but not currently running.', required: true }
      : { state: 'unavailable', label: 'Hermes Agent', detail: 'Hermes Agent was not detected.', required: true },
    tailscale: tailscale?.installed
      ? { state: tailscale.connected ? 'healthy' : 'offline', label: 'Tailscale', detail: tailscale.connected ? `${tailscale.peers.length} peer(s) visible.` : 'Installed but disconnected.', required: false }
      : { state: 'unavailable', label: 'Tailscale', detail: 'Tailscale is not installed.', required: false },
    syncthing: syncthing?.installed
      ? { state: syncthing.running ? 'healthy' : 'offline', label: 'Syncthing', detail: syncthing.running ? `${syncthing.folders.length} folder(s) configured.` : 'Installed but not running.', required: false }
      : { state: 'unavailable', label: 'Syncthing', detail: 'Syncthing is not installed.', required: false },
    workspace: workspace?.isInitialized
      ? { state: 'healthy', label: 'Workspace', detail: `${workspace.totalFiles} tracked file(s).`, required: true }
      : { state: 'misconfigured', label: 'Workspace', detail: 'The managed workspace has not been initialized.', required: true },
  };
  const requiredReady = Object.values(services).filter((service) => service.required).every((service) => service.state === 'healthy');
  const hasHealthyCore = services.agent.state === 'healthy' && (services.hermes.state === 'healthy' || configuredSettings.demoMode);
  return {
    checkedAt: new Date().toISOString(),
    overall: requiredReady ? 'ready' : hasHealthyCore ? 'attention' : 'setup-required',
    services,
    lastSuccessfulSync: syncResult.status === 'fulfilled' ? syncResult.value.lastSync : undefined,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Hermes Hub',
    backgroundColor: '#0a0d14',
    webPreferences: {
      // Electron requires an explicit .mjs extension for an ESM preload.
      preload: path.join(__dirname, 'preload.mjs'),
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

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    appendCrashLog(`preload-error (${preloadPath})`, error);
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

ipcMain.handle(IPC_CHANNELS.GET_MESH_SYNC_STATUS, async () => meshCoordinator.getStatus());
ipcMain.handle(IPC_CHANNELS.SET_PRIMARY_DEVICE, async (_event, deviceId: string) => meshCoordinator.setPrimaryDevice(deviceId));
ipcMain.handle(IPC_CHANNELS.PUBLISH_PRIMARY_BASELINE, async (_event, confirmed: boolean) => meshCoordinator.publishPrimaryBaseline(confirmed));
ipcMain.handle(IPC_CHANNELS.ADOPT_PRIMARY_BASELINE, async (_event, confirmed: boolean) => meshCoordinator.adoptPrimaryBaseline(confirmed));

// Milestone 10 Safe Session Access, Export & Import
ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async (_event, options?: any) => {
  return sessionService.listSessions(options || {});
});

ipcMain.handle(IPC_CHANNELS.GET_MEMORIES, async () => hermesService.getMemories());
ipcMain.handle(IPC_CHANNELS.GET_SKILLS, async () => hermesService.getSkills());
ipcMain.handle(IPC_CHANNELS.GET_FILES, async () => hermesService.getConfigFiles());
ipcMain.handle(IPC_CHANNELS.GET_ACTIVITY, async () => []);

ipcMain.handle(IPC_CHANNELS.GET_VAULT_SECRETS, async () => getVaultService().listSecrets());
ipcMain.handle(IPC_CHANNELS.GET_VAULT_SECRET, async (_event, id: string) => getVaultService().getSecret(id));
ipcMain.handle(IPC_CHANNELS.SAVE_VAULT_SECRET, async (_event, secret: VaultSecret) => getVaultService().saveSecret(secret));
ipcMain.handle(IPC_CHANNELS.DELETE_VAULT_SECRET, async (_event, id: string) => getVaultService().deleteSecret(id));

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

ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, async () => app.getVersion());
ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => updateManager?.check());
ipcMain.handle(IPC_CHANNELS.DOWNLOAD_AND_INSTALL_UPDATE, async () => updateManager?.downloadAndInstall());
ipcMain.handle(IPC_CHANNELS.GITHUB_UPDATE, async () => updateManager?.downloadAndInstall());
ipcMain.handle(IPC_CHANNELS.GET_RUNTIME_HEALTH, async () => getRuntimeHealth());
ipcMain.handle(IPC_CHANNELS.GET_ONBOARDING_STATE, async () => {
  const settings = settingsManager.getSettings();
  const detected = await hermesService.detect();
  return {
    completed: settings.onboardingCompleted,
    detectedHermesHome: detected?.homePath,
    configuredHermesHome: settings.hermesHome,
    workspacePath: settings.workspacePath || workspaceService.getRootPath(),
    runtime: await getRuntimeHealth(),
  };
});
ipcMain.handle(IPC_CHANNELS.COMPLETE_ONBOARDING, async (_event, input: CompleteOnboardingInput) => {
  const settings = settingsManager.updateSettings({
    onboardingCompleted: true,
    demoMode: input.demoMode,
    hermesHome: input.hermesHome || undefined,
    workspacePath: input.workspacePath || undefined,
  });
  if (!input.demoMode && !input.workspacePath) await workspaceService.initWorkspace();
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 500);
  return settings;
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

ipcMain.handle(IPC_CHANNELS.GET_README, async () => {
  const readmePath = app.isPackaged
    ? path.join(process.resourcesPath, 'README.md')
    : path.resolve(__dirname, '../../..', 'README.md');
  return fs.readFileSync(readmePath, 'utf8');
});

ipcMain.handle(IPC_CHANNELS.GET_SOURCE_REPOSITORY_STATUS, async (_event, workspacePath?: string) => {
  return sourceRepositoryService.getStatus(workspacePath || settingsManager.getSettings().repositoryWorkspacePath);
});

ipcMain.handle(IPC_CHANNELS.PICK_SOURCE_REPOSITORY, async () => {
  const options: OpenDialogOptions = {
    title: 'Choose the Hermes Hub source folder',
    properties: ['openDirectory'],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle(IPC_CHANNELS.PULL_SOURCE_REPOSITORY, async (_event, workspacePath: string) => {
  settingsManager.updateSettings({ repositoryWorkspacePath: workspacePath });
  return sourceRepositoryService.pull(workspacePath);
});

ipcMain.handle(IPC_CHANNELS.PUSH_SOURCE_REPOSITORY, async (_event, input: SourceRepositoryPushInput) => {
  settingsManager.updateSettings({ repositoryWorkspacePath: input.workspacePath });
  return sourceRepositoryService.push(input);
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Create the desktop window first. Network or integration startup must never
  // prevent the control center from becoming visible.
  createWindow();
  updateManager = new UpdateManager(() => mainWindow);

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

  if (settingsManager.getSettings().autoCheckUpdates) {
    setTimeout(async () => {
      const result = await updateManager?.check();
      if (result?.state === 'available' && settingsManager.getSettings().autoInstallUpdates) {
        await updateManager?.downloadAndInstall();
      }
    }, 5000);
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
