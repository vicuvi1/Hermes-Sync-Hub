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
  getHermesStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HERMES_STATUS),
  getTailscaleState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_TAILSCALE_STATE),
  pingTailscalePeer: (ipOrHost: string) => ipcRenderer.invoke(IPC_CHANNELS.PING_TAILSCALE_PEER, ipOrHost),
  getSyncthingState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYNCTHING_STATE),
  addDevice: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_DEVICE, data),
  removeDevice: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.REMOVE_DEVICE, id),
  compareDevices: (aId: string, bId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMPARE_DEVICES, aId, bId),
  getOverallStats: () => ipcRenderer.invoke(IPC_CHANNELS.GET_OVERALL_STATS),
  generatePairingInvitation: () => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_PAIRING_INVITATION),
  getActivePairingInvitation: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVE_PAIRING_INVITATION),
  validatePairingCode: (codeOrPayload: string) => ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_PAIRING_CODE, codeOrPayload),
  executePairing: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_PAIRING, payload),
});

