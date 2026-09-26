import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from '@hermes-hub/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
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
  sessionService
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
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      // Fallback to loading built file if dev server is not running
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

ipcMain.handle(IPC_CHANNELS.EXPORT_DIAGNOSTICS, async () => {
  const health = await healthMonitor.getHealthSnapshot();
  const dummyLog = `Log entry: user key sk-or-v1-98a417df8b6e2104bcde190847321fa890123ef configured for device ${health.deviceId}.`;
  return {
    success: true,
    health,
    redactedLog: redactSecrets(dummyLog),
  };
});

ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_event, folderPath: string) => {
  await shell.openPath(folderPath);
  return true;
});

app.whenReady().then(async () => {
  try {
    const port = await agentServer.start();
    console.log(`[AgentServer] Loopback HTTP server running on 127.0.0.1:${port}`);
  } catch (err) {
    console.warn(`[AgentServer] Failed to bind default port, running in-process:`, err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await agentServer.stop();
});
