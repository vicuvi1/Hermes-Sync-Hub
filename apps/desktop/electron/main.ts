import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type OpenDialogOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '@hermes-hub/protocol';
import {
  AppLocation,
  CompleteOnboardingInput,
  Device,
  OverallStats,
  RuntimeHealth,
  SavedSearch,
  SearchDocument,
  SearchEntityKind,
  SearchQuery,
  VaultEnvironmentProfile,
  VaultSetupInput,
  VaultUnlockInput,
  SourceRepositoryPushInput,
  VaultSecret,
} from '@hermes-hub/types';
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
  SharedVaultService,
  ActivityService,
  SearchService,
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
let legacyVaultService: VaultService | null = null;
let backupScheduleTimer: NodeJS.Timeout | null = null;
const sourceRepositoryService = new SourceRepositoryService();
const activityService = new ActivityService(deviceIdentity.getStorageDirectory());
const searchService = new SearchService(path.join(deviceIdentity.getStorageDirectory(), 'search', 'index.json'));
const sharedVaultService = new SharedVaultService(
  path.join(workspaceService.getRootPath(), 'vault', 'shared-vault.enc'),
  deviceIdentity.getLocalDevice().deviceName,
);
const rememberedVaultKeyPath = path.join(app.getPath('userData'), 'vault', 'shared-vault-key.bin');

const SEARCH_KINDS = new Set<SearchEntityKind>(['session', 'memory', 'skill', 'file', 'device', 'backup', 'activity', 'setting', 'action']);

function requireString(value: unknown, label: string, maxLength = 1_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function validateSearchQuery(value: unknown): SearchQuery {
  if (!value || typeof value !== 'object') throw new Error('Search query is required.');
  const raw = value as SearchQuery;
  const text = requireString(raw.text, 'Search text', 500);
  const kinds = raw.filter?.kinds;
  if (kinds && (!Array.isArray(kinds) || kinds.some((kind) => !SEARCH_KINDS.has(kind)))) {
    throw new Error('Search filter contains an unsupported item type.');
  }
  return { text, filter: kinds ? { ...raw.filter, kinds } : raw.filter, limit: Math.min(Math.max(raw.limit || 50, 1), 100) };
}

function searchDocument(id: string, kind: SearchEntityKind, title: string, body: string, location: AppLocation, extra: Partial<SearchDocument> = {}): SearchDocument {
  return { id, kind, title, body: redactSecrets(body || ''), location, ...extra };
}

async function buildSearchDocuments(): Promise<SearchDocument[]> {
  const [devices, sessions, memories, skills, files, backups] = await Promise.all([
    deviceRegistry.getAllDevices(),
    sessionService.listSessions({ limit: 10_000 }),
    hermesService.getMemories(),
    hermesService.getSkills(),
    hermesService.getConfigFiles(),
    backupService.getBackups(),
  ]);
  const documents: SearchDocument[] = [];
  const sessionDetails = await Promise.all(sessions.map((session) => sessionService.getSessionDetail(session.id).catch(() => null)));
  sessions.forEach((session, index) => {
    const detail = sessionDetails[index];
    const messages = detail?.messages.map((message) => `${message.role}: ${message.content || ''}`).join('\n') || '';
    documents.push(searchDocument(`session:${session.id}`, 'session', session.title, [session.previewText, session.model, ...(session.toolsUsed || []), messages].filter(Boolean).join('\n'), { tab: 'sessions', entityId: session.id }, { subtitle: `${session.model} · ${session.messagesCount} messages`, updatedAt: session.updatedAt, deviceName: session.originDeviceName, keywords: session.toolsUsed }));
  });
  memories.forEach((memory) => documents.push(searchDocument(`memory:${memory.id}`, 'memory', memory.title, memory.content, { tab: 'memory', entityId: memory.id }, { subtitle: memory.path, updatedAt: memory.updatedAt, deviceName: memory.originDeviceName })));
  skills.forEach((skill) => documents.push(searchDocument(`skill:${skill.id}`, 'skill', skill.name, `${skill.description}\n${skill.tags.join(' ')}`, { tab: 'skills', entityId: skill.id }, { subtitle: skill.description, updatedAt: skill.lastModified, deviceName: skill.originDeviceName, keywords: skill.tags })));
  files.forEach((file) => documents.push(searchDocument(`file:${file.id}`, 'file', file.name, `${file.path}\n${file.category}\n${file.sha256}`, { tab: 'files', entityId: file.id }, { subtitle: file.path, updatedAt: file.modifiedAt, deviceName: file.originDeviceName, keywords: [file.category, file.sha256] })));
  devices.forEach((device) => documents.push(searchDocument(`device:${device.deviceId}`, 'device', device.deviceName, `${device.hostname} ${device.os} ${device.healthStatus} ${device.hermes.home}`, { tab: 'devices', entityId: device.deviceId }, { subtitle: `${device.online ? 'Online' : 'Offline'} · ${device.os}`, updatedAt: device.lastSeen, deviceName: device.deviceName })));
  backups.forEach((backup) => documents.push(searchDocument(`backup:${backup.id}`, 'backup', backup.name, `${backup.health} ${Object.entries(backup.itemCounts).map(([key, count]) => `${key} ${count}`).join(' ')}`, { tab: 'backups', entityId: backup.id }, { subtitle: `${backup.health} · ${backup.sizeBytes} bytes`, updatedAt: backup.createdAt })));
  meshCoordinator.listRecoveryArtifacts().forEach((artifact) => documents.push(searchDocument(`backup:${artifact.id}`, 'backup', artifact.name, `${artifact.kind} ${artifact.description} ${artifact.filePath}`, { tab: 'backups', entityId: artifact.id, section: 'recovery' }, { subtitle: artifact.description, updatedAt: artifact.createdAt })));
  activityService.list(1_000).forEach((event) => documents.push(searchDocument(`activity:${event.id}`, 'activity', event.title, event.description, { tab: 'activity', entityId: event.id }, { subtitle: `${event.status} · ${event.sourceDevice}`, updatedAt: event.timestamp, deviceName: event.sourceDevice })));

  const pages: Array<[string, string, AppLocation['tab'], string]> = [
    ['settings', 'Settings', 'settings', 'Application, integrations, privacy, updates and Developer Mode'],
    ['help', 'Help & README', 'help', 'Product handbook, setup and troubleshooting'],
    ['vault', 'Shared Vault', 'vault', 'Password-unlocked encrypted secrets and environment profiles. Secret values are never indexed.'],
  ];
  pages.forEach(([id, title, tab, body]) => documents.push(searchDocument(`setting:${id}`, 'setting', title, body, { tab })));
  const actions = [
    ['sync', 'Sync now', 'Synchronize supported Hermes files across configured devices'],
    ['backup', 'Create backup', 'Create a protected local recovery backup'],
    ['update', 'Check for updates', 'Check GitHub Releases for a newer Hermes Hub version'],
    ['pair', 'Pair device', 'Connect another computer to the Hermes mesh'],
  ];
  actions.forEach(([id, title, body]) => documents.push(searchDocument(`action:${id}`, 'action', title, body, { tab: id === 'pair' ? 'devices' : 'dashboard', entityId: id })));
  return documents;
}

async function reindexSearch(): Promise<ReturnType<SearchService['getStatus']>> {
  mainWindow?.webContents.send(IPC_CHANNELS.SEARCH_INDEX_STATUS, { ...searchService.getStatus(), state: 'indexing', message: 'Building private local search index…' });
  try {
    const status = searchService.replace(await buildSearchDocuments());
    mainWindow?.webContents.send(IPC_CHANNELS.SEARCH_INDEX_STATUS, status);
    activityService.record({ type: 'search_reindexed', title: 'Command Center index updated', description: status.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
    return status;
  } catch (error) {
    const status = { ...searchService.getStatus(), state: 'failed' as const, message: error instanceof Error ? error.message : 'Search indexing failed.' };
    mainWindow?.webContents.send(IPC_CHANNELS.SEARCH_INDEX_STATUS, status);
    return status;
  }
}

function appendCrashLog(kind: string, error: unknown): void {
  try {
    const logDirectory = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDirectory, { recursive: true });
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(path.join(logDirectory, 'main-process.log'), `[${new Date().toISOString()}] ${kind}\n${redactSecrets(detail)}\n\n`);
  } catch {}
}

async function runScheduledBackupIfDue(): Promise<void> {
  const settings = settingsManager.getSettings();
  if (!settings.autoBackupEnabled) return;
  const backups = await backupService.getBackups();
  const newest = backups[0]?.createdAt ? new Date(backups[0].createdAt).getTime() : 0;
  const interval = settings.autoBackupFrequency === 'weekly' ? 7 * 24 * 60 * 60 * 1_000 : 24 * 60 * 60 * 1_000;
  if (Date.now() - newest < interval) return;
  const backup = await backupService.createBackup({ name: `Automatic ${settings.autoBackupFrequency} backup` });
  activityService.record({ type: 'backup_created', title: 'Scheduled backup created', description: backup.name, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
}

process.on('uncaughtException', (error) => appendCrashLog('uncaughtException', error));
process.on('unhandledRejection', (error) => appendCrashLog('unhandledRejection', error));

function getLegacyVaultService(): VaultService {
  if (legacyVaultService) return legacyVaultService;
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
  legacyVaultService = new VaultService(path.join(vaultDirectory, 'secrets.vault.enc'), masterKey);
  return legacyVaultService;
}

function rememberSharedVaultKey(key: Buffer | null): void {
  fs.mkdirSync(path.dirname(rememberedVaultKeyPath), { recursive: true });
  if (!key) {
    if (fs.existsSync(rememberedVaultKeyPath)) fs.unlinkSync(rememberedVaultKeyPath);
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable.');
  fs.writeFileSync(rememberedVaultKeyPath, safeStorage.encryptString(key.toString('base64')));
}

async function unlockRememberedSharedVault(): Promise<void> {
  if (!sharedVaultService.isConfigured() || !fs.existsSync(rememberedVaultKeyPath) || !safeStorage.isEncryptionAvailable()) return;
  try {
    const key = Buffer.from(safeStorage.decryptString(fs.readFileSync(rememberedVaultKeyPath)), 'base64');
    await sharedVaultService.unlockWithKey(key);
    key.fill(0);
  } catch (error) {
    appendCrashLog('shared-vault-auto-unlock', error);
    rememberSharedVaultKey(null);
  }
}

function validateVaultSecret(value: unknown): VaultSecret {
  if (!value || typeof value !== 'object') throw new Error('Secret details are required.');
  const secret = value as VaultSecret;
  const categories: VaultSecret['category'][] = ['API Keys', 'Auth Tokens', 'Passwords', 'SSH Keys', 'Certificates', 'Recovery Codes', 'Tailscale', 'Custom'];
  if (!categories.includes(secret.category)) throw new Error('Unsupported secret category.');
  return {
    ...secret,
    id: requireString(secret.id, 'Secret ID', 100),
    key: requireString(secret.key, 'Secret name', 200),
    value: requireString(secret.value, 'Secret value', 100_000),
    description: typeof secret.description === 'string' ? secret.description.slice(0, 2_000) : undefined,
    updatedAt: new Date().toISOString(),
    originDevice: deviceIdentity.getLocalDevice().deviceName,
    isMasked: false,
  };
}

function validateEnvironment(value: unknown): VaultEnvironmentProfile {
  if (!value || typeof value !== 'object') throw new Error('Environment profile is required.');
  const profile = value as VaultEnvironmentProfile;
  if (!Array.isArray(profile.variables) || profile.variables.length > 500) throw new Error('Environment profile may contain up to 500 variables.');
  const variables = profile.variables.map((variable) => ({
    key: requireString(variable.key, 'Variable name', 200),
    value: typeof variable.value === 'string' && variable.value.length <= 100_000 ? variable.value : (() => { throw new Error('Variable value is too large.'); })(),
    description: typeof variable.description === 'string' ? variable.description.slice(0, 1_000) : undefined,
    isMasked: false,
  }));
  return {
    id: requireString(profile.id, 'Environment ID', 100),
    name: requireString(profile.name, 'Environment name', 100),
    description: typeof profile.description === 'string' ? profile.description.slice(0, 2_000) : undefined,
    variables,
    updatedAt: new Date().toISOString(),
    originDevice: deviceIdentity.getLocalDevice().deviceName,
  };
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
    activityService.record({ type: 'file_sync', title: 'Synchronization completed', description: `Completed ${result.actions.length} file action(s).`, sourceDevice: deviceIdentity.getLocalDevice().deviceName, filesCount: result.actions.length, status: 'success' });
    void reindexSearch();
    return { success: true, message: 'Sync cycle completed successfully', result };
  } catch (err: any) {
    activityService.record({ type: 'file_sync', title: 'Synchronization failed', description: err.message || 'Sync failed', sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'error' });
    return { success: false, message: err.message || 'Sync failed' };
  }
});

ipcMain.handle(IPC_CHANNELS.TRIGGER_SYNC_CYCLE, async (_event, options: any) => {
  try {
    const result = await syncEngine.executeSyncCycle(options);
    activityService.record({ type: 'file_sync', title: 'Synchronization completed', description: `Completed ${result.actions.length} file action(s).`, sourceDevice: deviceIdentity.getLocalDevice().deviceName, filesCount: result.actions.length, status: 'success' });
    void reindexSearch();
    return result;
  } catch (error) {
    activityService.record({ type: 'file_sync', title: 'Synchronization failed', description: error instanceof Error ? error.message : 'Sync failed', sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'error' });
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.GET_SYNC_SUMMARY, async () => {
  return syncEngine.getSyncSummary();
});

ipcMain.handle(IPC_CHANNELS.GET_SYNC_CONFLICTS, async () => {
  return syncEngine.getConflicts();
});

ipcMain.handle(IPC_CHANNELS.RESOLVE_SYNC_CONFLICT, async (_event, conflictId: string, resolution: any) => {
  requireString(conflictId, 'Conflict ID', 200);
  if (!['use_local', 'use_remote', 'keep_both'].includes(resolution)) throw new Error('Unsupported conflict resolution.');
  const result = await syncEngine.resolveConflict(conflictId, resolution);
  activityService.record({ type: 'conflict_detected', title: 'Conflict resolved with recovery copy', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: result.success ? 'success' : 'error' });
  return result;
});

ipcMain.handle(IPC_CHANNELS.GET_MESH_SYNC_STATUS, async () => meshCoordinator.getStatus());
ipcMain.handle(IPC_CHANNELS.SET_PRIMARY_DEVICE, async (_event, deviceId: string) => meshCoordinator.setPrimaryDevice(deviceId));
ipcMain.handle(IPC_CHANNELS.PUBLISH_PRIMARY_BASELINE, async (_event, confirmed: boolean) => {
  if (confirmed !== true) throw new Error('Publishing a baseline requires explicit confirmation.');
  const result = await meshCoordinator.publishPrimaryBaseline(true);
  activityService.record({ type: 'baseline_published', title: 'Main PC baseline published', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, filesCount: result.filesCopied, status: result.success ? 'success' : 'error' });
  void reindexSearch();
  return result;
});
ipcMain.handle(IPC_CHANNELS.ADOPT_PRIMARY_BASELINE, async (_event, confirmed: boolean) => {
  if (confirmed !== true) throw new Error('Adopting a baseline requires explicit confirmation.');
  const result = await meshCoordinator.adoptPrimaryBaseline(true);
  activityService.record({ type: 'baseline_adopted', title: 'Main PC baseline adopted', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, filesCount: result.filesCopied, status: result.success ? 'success' : 'error' });
  void reindexSearch();
  return result;
});

// Milestone 10 Safe Session Access, Export & Import
ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async (_event, options?: any) => {
  return sessionService.listSessions(options || {});
});

ipcMain.handle(IPC_CHANNELS.GET_MEMORIES, async () => hermesService.getMemories());
ipcMain.handle(IPC_CHANNELS.GET_SKILLS, async () => hermesService.getSkills());
ipcMain.handle(IPC_CHANNELS.GET_FILES, async () => hermesService.getConfigFiles());
ipcMain.handle(IPC_CHANNELS.GET_ACTIVITY, async () => activityService.list());
ipcMain.handle(IPC_CHANNELS.GET_RECOVERY_ARTIFACTS, async () => meshCoordinator.listRecoveryArtifacts());
ipcMain.handle(IPC_CHANNELS.RESTORE_RECOVERY_ARTIFACT, async (_event, id: unknown, confirmed: unknown) => {
  const result = await meshCoordinator.restoreRecoveryArtifact(requireString(id, 'Recovery artifact ID', 100), confirmed === true);
  activityService.record({ type: 'backup_created', title: 'Recovery artifact restored', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
  void reindexSearch();
  return result;
});
ipcMain.handle(IPC_CHANNELS.GET_SEARCH_INDEX_STATUS, async () => searchService.getStatus());
ipcMain.handle(IPC_CHANNELS.REINDEX_SEARCH, async () => reindexSearch());
ipcMain.handle(IPC_CHANNELS.SEARCH_ALL, async (_event, input: unknown) => {
  const query = validateSearchQuery(input);
  const settings = settingsManager.getSettings();
  const recentSearches = [query.text, ...settings.recentSearches.filter((item) => item.toLowerCase() !== query.text.toLowerCase())].slice(0, 10);
  settingsManager.updateSettings({ recentSearches });
  return searchService.search(query);
});
ipcMain.handle(IPC_CHANNELS.SAVE_SEARCH, async (_event, input: unknown) => {
  if (!input || typeof input !== 'object') throw new Error('Saved search details are required.');
  const value = input as { name?: unknown; query?: unknown };
  const saved: SavedSearch = { id: crypto.randomUUID(), name: requireString(value.name, 'Saved search name', 80), query: validateSearchQuery(value.query), createdAt: new Date().toISOString() };
  const settings = settingsManager.getSettings();
  settingsManager.updateSettings({ savedSearches: [saved, ...settings.savedSearches].slice(0, 25) });
  return saved;
});
ipcMain.handle(IPC_CHANNELS.DELETE_SAVED_SEARCH, async (_event, id: unknown) => {
  const searchId = requireString(id, 'Saved search ID', 100);
  const settings = settingsManager.getSettings();
  settingsManager.updateSettings({ savedSearches: settings.savedSearches.filter((item) => item.id !== searchId) });
  return true;
});

ipcMain.handle(IPC_CHANNELS.GET_VAULT_STATUS, async () => sharedVaultService.getStatus(fs.existsSync(rememberedVaultKeyPath)));
ipcMain.handle(IPC_CHANNELS.SETUP_SHARED_VAULT, async (_event, input: VaultSetupInput) => {
  if (!input || typeof input !== 'object') throw new Error('Vault setup details are required.');
  const password = requireString(input.password, 'Vault password', 512);
  let existingSecrets: VaultSecret[] = [];
  if (input.importExistingLocalVault) {
    const legacy = getLegacyVaultService();
    const listed = await legacy.listSecrets();
    existingSecrets = (await Promise.all(listed.map((secret) => legacy.getSecret(secret.id)))).filter((secret): secret is VaultSecret => Boolean(secret));
  }
  const key = await sharedVaultService.setup(password, existingSecrets);
  rememberSharedVaultKey(input.rememberOnThisPc ? key : null);
  key.fill(0);
  activityService.record({ type: 'health_warning', title: 'Shared Vault configured', description: `Encrypted Vault transport is ready with ${existingSecrets.length} imported item(s).`, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
  return sharedVaultService.getStatus(fs.existsSync(rememberedVaultKeyPath));
});
ipcMain.handle(IPC_CHANNELS.UNLOCK_SHARED_VAULT, async (_event, input: VaultUnlockInput) => {
  if (!input || typeof input !== 'object') throw new Error('Vault unlock details are required.');
  const key = await sharedVaultService.unlock(requireString(input.password, 'Vault password', 512));
  rememberSharedVaultKey(input.rememberOnThisPc ? key : null);
  key.fill(0);
  return sharedVaultService.getStatus(fs.existsSync(rememberedVaultKeyPath));
});
ipcMain.handle(IPC_CHANNELS.LOCK_SHARED_VAULT, async () => {
  sharedVaultService.lock();
  rememberSharedVaultKey(null);
  return sharedVaultService.getStatus(false);
});
ipcMain.handle(IPC_CHANNELS.CHANGE_VAULT_PASSWORD, async (_event, currentPassword: unknown, newPassword: unknown, rememberOnThisPc: boolean) => {
  const key = await sharedVaultService.changePassword(requireString(currentPassword, 'Current password', 512), requireString(newPassword, 'New password', 512));
  rememberSharedVaultKey(rememberOnThisPc ? key : null);
  key.fill(0);
  return sharedVaultService.getStatus(fs.existsSync(rememberedVaultKeyPath));
});
ipcMain.handle(IPC_CHANNELS.GET_VAULT_SECRETS, async () => sharedVaultService.listSecrets());
ipcMain.handle(IPC_CHANNELS.GET_VAULT_SECRET, async (_event, id: unknown) => sharedVaultService.getSecret(requireString(id, 'Secret ID', 100)));
ipcMain.handle(IPC_CHANNELS.SAVE_VAULT_SECRET, async (_event, secret: unknown) => sharedVaultService.saveSecret(validateVaultSecret(secret)));
ipcMain.handle(IPC_CHANNELS.DELETE_VAULT_SECRET, async (_event, id: unknown) => sharedVaultService.deleteSecret(requireString(id, 'Secret ID', 100)));
ipcMain.handle(IPC_CHANNELS.GET_VAULT_ENVIRONMENTS, async () => sharedVaultService.listEnvironments());
ipcMain.handle(IPC_CHANNELS.GET_VAULT_ENVIRONMENT, async (_event, id: unknown) => sharedVaultService.getEnvironment(requireString(id, 'Environment ID', 100)));
ipcMain.handle(IPC_CHANNELS.SAVE_VAULT_ENVIRONMENT, async (_event, profile: unknown) => sharedVaultService.saveEnvironment(validateEnvironment(profile)));
ipcMain.handle(IPC_CHANNELS.DELETE_VAULT_ENVIRONMENT, async (_event, id: unknown) => sharedVaultService.deleteEnvironment(requireString(id, 'Environment ID', 100)));

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
  activityService.record({ type: 'backup_created', title: 'Backup created', description: `${b.name} was captured successfully.`, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
  void reindexSearch();
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

ipcMain.handle(IPC_CHANNELS.CREATE_MIGRATION_BUNDLE, async () => {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, { title: 'Choose where to create the migration bundle', properties: ['openDirectory', 'createDirectory'] })
    : await dialog.showOpenDialog({ title: 'Choose where to create the migration bundle', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return { success: false, message: 'Migration export cancelled.' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.join(result.filePaths[0], `Hermes-Hub-Migration-${stamp}`);
  fs.mkdirSync(bundlePath, { recursive: true });
  const workspaceExport = path.join(bundlePath, 'workspace');
  fs.mkdirSync(workspaceExport, { recursive: true });
  const layout = workspaceService.getLayout();
  for (const category of ['memories', 'skills', 'configs'] as const) {
    const source = layout[category];
    if (source && fs.existsSync(source)) fs.cpSync(source, path.join(workspaceExport, category), { recursive: true });
  }
  if (sharedVaultService.isConfigured()) fs.copyFileSync(sharedVaultService.getPath(), path.join(bundlePath, 'shared-vault.enc'));
  const settings = settingsManager.getSettings();
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceDevice: deviceIdentity.getLocalDevice().deviceName,
    includesSharedVault: sharedVaultService.isConfigured(),
    preferences: {
      theme: settings.theme,
      closeToTray: settings.closeToTray,
      notificationsEnabled: settings.notificationsEnabled,
      autoBackupEnabled: settings.autoBackupEnabled,
      autoBackupFrequency: settings.autoBackupFrequency,
      maxBackupsToRetain: settings.maxBackupsToRetain,
    },
  };
  fs.writeFileSync(path.join(bundlePath, 'migration-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(bundlePath, 'RESTORE-INSTRUCTIONS.txt'), 'Open Hermes Hub > Backups > Recovery Center > Import migration bundle. Select this folder. The Shared Vault remains encrypted and requires the same password.\r\n', 'utf8');
  activityService.record({ type: 'backup_created', title: 'Migration bundle created', description: 'Settings, safe workspace files, and the encrypted Shared Vault were exported.', sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
  return { success: true, filePath: bundlePath, message: 'Migration bundle created. Keep the folder together when moving it to another PC.' };
});

ipcMain.handle(IPC_CHANNELS.IMPORT_MIGRATION_BUNDLE, async (_event, confirmed: boolean) => {
  if (confirmed !== true) throw new Error('Migration import requires confirmation.');
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, { title: 'Choose a Hermes Hub migration bundle', properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ title: 'Choose a Hermes Hub migration bundle', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return { success: false, message: 'Migration import cancelled.' };
  const bundlePath = result.filePaths[0];
  const manifestPath = path.join(bundlePath, 'migration-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('This folder is not a Hermes Hub migration bundle.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version?: number; preferences?: Record<string, unknown> };
  if (manifest.version !== 1) throw new Error('Unsupported migration bundle version.');
  const backup = await backupService.createBackup({ name: 'Before migration import', notes: 'Automatic rollback point before importing a PC migration bundle.' });
  const workspaceImport = path.join(bundlePath, 'workspace');
  const layout = workspaceService.getLayout();
  for (const category of ['memories', 'skills', 'configs'] as const) {
    const source = path.join(workspaceImport, category);
    if (fs.existsSync(source)) fs.cpSync(source, layout[category], { recursive: true, force: true });
  }
  const importedVault = path.join(bundlePath, 'shared-vault.enc');
  if (fs.existsSync(importedVault)) {
    fs.mkdirSync(path.dirname(sharedVaultService.getPath()), { recursive: true });
    if (fs.existsSync(sharedVaultService.getPath())) {
      const recoveryPath = path.join(workspaceService.getRootPath(), 'backups', `vault-before-migration-${Date.now()}.enc`);
      fs.mkdirSync(path.dirname(recoveryPath), { recursive: true });
      fs.copyFileSync(sharedVaultService.getPath(), recoveryPath);
    }
    sharedVaultService.lock();
    rememberSharedVaultKey(null);
    fs.copyFileSync(importedVault, sharedVaultService.getPath());
  }
  const allowed = ['theme', 'closeToTray', 'notificationsEnabled', 'autoBackupEnabled', 'autoBackupFrequency', 'maxBackupsToRetain'];
  const preferenceUpdates = Object.fromEntries(Object.entries(manifest.preferences || {}).filter(([key]) => allowed.includes(key)));
  settingsManager.updateSettings(preferenceUpdates);
  await workspaceService.generateManifest();
  activityService.record({ type: 'backup_created', title: 'Migration bundle imported', description: `Imported after creating rollback backup ${backup.id}.`, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: 'success' });
  return { success: true, filePath: bundlePath, message: 'Migration imported. Unlock the Shared Vault with the same password.', requiresRestart: false };
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
ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
  const result = await updateManager?.check();
  if (result) activityService.record({ type: 'update_checked', title: 'Application update checked', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: result.state === 'failed' ? 'error' : result.state === 'offline' ? 'warning' : 'info' });
  return result;
});
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
  if (!settingsManager.getSettings().developerMode) throw new Error('Source repository controls require Developer Mode.');
  return sourceRepositoryService.getStatus(workspacePath || settingsManager.getSettings().repositoryWorkspacePath);
});

ipcMain.handle(IPC_CHANNELS.PICK_SOURCE_REPOSITORY, async () => {
  if (!settingsManager.getSettings().developerMode) throw new Error('Source repository controls require Developer Mode.');
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
  if (!settingsManager.getSettings().developerMode) throw new Error('Source repository controls require Developer Mode.');
  requireString(workspacePath, 'Repository folder', 2_000);
  settingsManager.updateSettings({ repositoryWorkspacePath: workspacePath });
  const result = await sourceRepositoryService.pull(workspacePath);
  activityService.record({ type: 'repository_sync', title: 'Repository update pulled', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: result.success ? 'success' : 'error' });
  return result;
});

ipcMain.handle(IPC_CHANNELS.PUSH_SOURCE_REPOSITORY, async (_event, input: SourceRepositoryPushInput) => {
  if (!settingsManager.getSettings().developerMode) throw new Error('Source repository controls require Developer Mode.');
  if (!input?.confirmed) throw new Error('Repository publish must be explicitly confirmed.');
  requireString(input.workspacePath, 'Repository folder', 2_000);
  requireString(input.commitMessage, 'Commit message', 200);
  settingsManager.updateSettings({ repositoryWorkspacePath: input.workspacePath });
  const result = await sourceRepositoryService.push(input);
  activityService.record({ type: 'repository_sync', title: 'Repository changes published', description: result.message, sourceDevice: deviceIdentity.getLocalDevice().deviceName, status: result.success ? 'success' : 'error' });
  return result;
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

app.whenReady().then(async () => {
  // Create the desktop window first. Network or integration startup must never
  // prevent the control center from becoming visible.
  createWindow();
  updateManager = new UpdateManager(() => mainWindow);
  await unlockRememberedSharedVault();

  agentServer.start()
    .then((port) => console.log(`[AgentServer] Loopback HTTP server running on 127.0.0.1:${port}`))
    .catch((err) => console.warn(`[AgentServer] Failed to bind default port, running in-process:`, err));

  void reindexSearch();

  setTimeout(() => void runScheduledBackupIfDue().catch((error) => appendCrashLog('scheduled-backup', error)), 10_000);
  backupScheduleTimer = setInterval(() => void runScheduledBackupIfDue().catch((error) => appendCrashLog('scheduled-backup', error)), 60 * 60 * 1_000);

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
  if (backupScheduleTimer) clearInterval(backupScheduleTimer);
  destroyTray();
  await agentServer.stop();
});
