import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '@hermes-hub/protocol';
import { MOCK_DEVICES, MOCK_OVERALL_STATS, redactSecrets } from '@hermes-hub/shared';
import { DeviceIdentityService, AgentServer, HealthMonitorService } from '@hermes-hub/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const deviceIdentity = new DeviceIdentityService();
const healthMonitor = new HealthMonitorService(deviceIdentity);
const agentServer = new AgentServer(deviceIdentity, healthMonitor);

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

// Milestone 2 IPC Handlers for Local Device Agent
ipcMain.handle(IPC_CHANNELS.GET_LOCAL_DEVICE, async () => {
  return deviceIdentity.getLocalDevice();
});

ipcMain.handle(IPC_CHANNELS.GET_AGENT_HEALTH, async () => {
  return healthMonitor.getHealthSnapshot();
});

ipcMain.handle(IPC_CHANNELS.PING_AGENT, async () => {
  return { pong: true, time: new Date().toISOString() };
});

ipcMain.handle(IPC_CHANNELS.GET_DEVICES, async () => {
  const localDev = deviceIdentity.getLocalDevice();
  // Merge real local device as primary with peer devices
  const peers = MOCK_DEVICES.filter((d) => d.deviceName !== localDev.deviceName);
  return [localDev, ...peers];
});

ipcMain.handle(IPC_CHANNELS.GET_OVERALL_STATS, async () => {
  return MOCK_OVERALL_STATS;
});

ipcMain.handle(IPC_CHANNELS.TRIGGER_SYNC_NOW, async () => {
  return { success: true, message: 'Sync cycle triggered' };
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
