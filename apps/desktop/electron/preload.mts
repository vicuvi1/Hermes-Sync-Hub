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
  getReadme: () => ipcRenderer.invoke(IPC_CHANNELS.GET_README),
  getSourceRepositoryStatus: (workspacePath?: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_SOURCE_REPOSITORY_STATUS, workspacePath),
  pickSourceRepository: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_SOURCE_REPOSITORY),
  pullSourceRepository: (workspacePath: string) => ipcRenderer.invoke(IPC_CHANNELS.PULL_SOURCE_REPOSITORY, workspacePath),
  pushSourceRepository: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.PUSH_SOURCE_REPOSITORY, input),
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
  getWorkspaceStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_WORKSPACE_STATUS),
  initWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.INIT_WORKSPACE),
  getManifest: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MANIFEST),
  generateManifest: () => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_MANIFEST),
  verifyManifest: () => ipcRenderer.invoke(IPC_CHANNELS.VERIFY_MANIFEST),
  getSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SNAPSHOTS),
  createSafeSnapshot: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_SAFE_SNAPSHOT, options),
  triggerSyncCycle: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_SYNC_CYCLE, options),
  getSyncSummary: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYNC_SUMMARY),
  getSyncConflicts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYNC_CONFLICTS),
  resolveSyncConflict: (conflictId: string, resolution: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_SYNC_CONFLICT, conflictId, resolution),
  // Milestone 10 Sessions
  getSessions: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS, options),
  getMemories: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MEMORIES),
  getSkills: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SKILLS),
  getFiles: () => ipcRenderer.invoke(IPC_CHANNELS.GET_FILES),
  getActivity: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVITY),
  getSessionDetail: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION_DETAIL, sessionId),
  exportSession: (options: any) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SESSION, options),
  importSession: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_SESSION, payload),
  // Milestone 12 Backups & Revisions
  getBackups: () => ipcRenderer.invoke(IPC_CHANNELS.GET_BACKUPS),
  createBackup: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_BACKUP, options),
  verifyBackup: (backupId: string) => ipcRenderer.invoke(IPC_CHANNELS.VERIFY_BACKUP, backupId),
  restoreBackup: (options: any) => ipcRenderer.invoke(IPC_CHANNELS.RESTORE_BACKUP, options),
  deleteBackup: (backupId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_BACKUP, backupId),
  getFileRevisions: (filePath?: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_REVISIONS, filePath),
  rollbackRevision: (filePath: string, targetRevision: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.ROLLBACK_REVISION, filePath, targetRevision),
  // Milestone 13 Polish & Diagnostics
  getAppSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_SETTINGS),
  updateAppSettings: (updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_APP_SETTINGS, updates),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, title, body),
  getDiagnosticsReport: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DIAGNOSTICS_REPORT),
  getVaultSecrets: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VAULT_SECRETS),
  getVaultSecret: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_VAULT_SECRET, id),
  saveVaultSecret: (secret: any) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_VAULT_SECRET, secret),
  deleteVaultSecret: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_VAULT_SECRET, id),
  getRuntimeHealth: () => ipcRenderer.invoke(IPC_CHANNELS.GET_RUNTIME_HEALTH),
  getOnboardingState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ONBOARDING_STATE),
  completeOnboarding: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.COMPLETE_ONBOARDING, input),
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  downloadAndInstallUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_AND_INSTALL_UPDATE),
  githubUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_AND_INSTALL_UPDATE),
  onUpdateStatus: (callback: (status: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: any) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS, listener);
  },
});

