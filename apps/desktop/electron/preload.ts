import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@hermes-hub/protocol';

// Expose safe, typed API to Renderer process
contextBridge.exposeInMainWorld('hermesHub', {
  platform: process.platform,
  getDevices: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DEVICES),
  getLocalDevice: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LOCAL_DEVICE),
  getAgentHealth: () => ipcRenderer.invoke(IPC_CHANNELS.GET_AGENT_HEALTH),
  pingAgent: () => ipcRenderer.invoke(IPC_CHANNELS.PING_AGENT),
  triggerSync: () => ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_SYNC_NOW),
  openFolder: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, path),
  exportDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DIAGNOSTICS),
});
