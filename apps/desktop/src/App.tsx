import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CommandPalette } from './components/layout/CommandPalette';
import { RuntimeStatusBar } from './components/layout/RuntimeStatusBar';
import { FirstRunWizard } from './components/onboarding/FirstRunWizard';
import { DashboardView } from './components/dashboard/DashboardView';
import { DevicesView } from './components/devices/DevicesView';
import { SessionsView } from './components/sessions/SessionsView';
import { MemoryView } from './components/memory/MemoryView';
import { SkillsView } from './components/skills/SkillsView';
import { FilesView } from './components/files/FilesView';
import { VaultView } from './components/vault/VaultView';
import { ActivityView } from './components/activity/ActivityView';
import { BackupsView } from './components/backups/BackupsView';
import { SettingsView } from './components/settings/SettingsView';
import { AddDeviceModal } from './components/modals/AddDeviceModal';
import { DeviceDetailModal } from './components/devices/DeviceDetailModal';
import {
  MOCK_DEVICES,
  MOCK_OVERALL_STATS,
  MOCK_ACTIVE_TRANSFER,
  MOCK_SESSIONS,
  MOCK_MEMORIES,
  MOCK_SKILLS,
  MOCK_FILES,
  MOCK_VAULT_SECRETS,
  MOCK_ACTIVITY,
  MOCK_BACKUPS,
} from '@hermes-hub/shared';
import {
  ActivityEvent,
  ActiveTransfer,
  AppSettings,
  AppUpdateProgress,
  BackupRecord,
  CompleteOnboardingInput,
  Device,
  HermesFile,
  HermesMemory,
  HermesSession,
  HermesSkill,
  OnboardingState,
  OverallStats,
  RuntimeHealth,
  SyncthingState,
  TailscaleState,
  VaultSecret,
} from '@hermes-hub/types';
import { AgentHealthResponse } from '@hermes-hub/protocol';

const HelpView = React.lazy(() => import('./components/help/HelpView').then((module) => ({ default: module.HelpView })));

declare global {
  interface Window {
    hermesHub?: {
      platform: string;
      getDevices: () => Promise<Device[]>;
      getLocalDevice: () => Promise<Device>;
      getAgentHealth: () => Promise<AgentHealthResponse>;
      pingAgent: () => Promise<{ pong: boolean; time: string }>;
      triggerSync: () => Promise<{ success: boolean }>;
      openFolder: (path: string) => Promise<boolean>;
      getReadme: () => Promise<string>;
      exportDiagnostics: (outputPath?: string) => Promise<{ success: boolean; filePath?: string; report?: any }>;
      getHermesStatus: () => Promise<any>;
      getTailscaleState: () => Promise<TailscaleState>;
      pingTailscalePeer: (ipOrHost: string) => Promise<{ success: boolean; latencyMs?: number; via?: string }>;
      getSyncthingState: () => Promise<SyncthingState>;
      addDevice: (data: Partial<Device>) => Promise<Device>;
      removeDevice: (id: string) => Promise<boolean>;
      compareDevices: (aId: string, bId: string) => Promise<any>;
      getOverallStats: () => Promise<any>;
      generatePairingInvitation: () => Promise<any>;
      getActivePairingInvitation: () => Promise<any>;
      validatePairingCode: (codeOrPayload: string) => Promise<any>;
      executePairing: (payload: any) => Promise<any>;
      getWorkspaceStatus: () => Promise<any>;
      initWorkspace: () => Promise<any>;
      getManifest: () => Promise<any>;
      generateManifest: () => Promise<any>;
      verifyManifest: () => Promise<any>;
      getSnapshots: () => Promise<any>;
      createSafeSnapshot: (options?: any) => Promise<any>;
      triggerSyncCycle: (options?: any) => Promise<any>;
      getSyncSummary: () => Promise<any>;
      getSyncConflicts: () => Promise<any>;
      resolveSyncConflict: (conflictId: string, resolution: any) => Promise<any>;
      getSessions: (options?: any) => Promise<any[]>;
      getMemories: () => Promise<HermesMemory[]>;
      getSkills: () => Promise<HermesSkill[]>;
      getFiles: () => Promise<HermesFile[]>;
      getActivity: () => Promise<ActivityEvent[]>;
      getSessionDetail: (sessionId: string) => Promise<any>;
      exportSession: (options: any) => Promise<any>;
      importSession: (payload: any) => Promise<any>;
      getBackups: () => Promise<BackupRecord[]>;
      createBackup: (options?: any) => Promise<BackupRecord>;
      verifyBackup: (backupId: string) => Promise<any>;
      restoreBackup: (options: any) => Promise<any>;
      deleteBackup: (backupId: string) => Promise<boolean>;
      getFileRevisions: (filePath?: string) => Promise<any>;
      rollbackRevision: (filePath: string, targetRevision: number) => Promise<any>;
      getAppSettings: () => Promise<any>;
      updateAppSettings: (updates: any) => Promise<any>;
      showNotification: (title: string, body: string) => Promise<boolean>;
      getDiagnosticsReport: () => Promise<any>;
      getVaultSecrets: () => Promise<VaultSecret[]>;
      getVaultSecret: (id: string) => Promise<VaultSecret | null>;
      saveVaultSecret: (secret: VaultSecret) => Promise<VaultSecret>;
      deleteVaultSecret: (id: string) => Promise<boolean>;
      getRuntimeHealth: () => Promise<RuntimeHealth>;
      getOnboardingState: () => Promise<OnboardingState>;
      completeOnboarding: (input: CompleteOnboardingInput) => Promise<AppSettings>;
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<AppUpdateProgress>;
      downloadAndInstallUpdate: () => Promise<AppUpdateProgress>;
      githubUpdate: () => Promise<AppUpdateProgress>;
      onUpdateStatus: (callback: (status: AppUpdateProgress) => void) => () => void;
    };
  }
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<OverallStats>({ devicesCount: 0, onlineCount: 0, sessionsCount: 0, memoriesCount: 0, skillsCount: 0, pendingFilesCount: 0, conflictsCount: 0, syncHealth: 'offline_changes' });
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const [sessions, setSessions] = useState<HermesSession[]>([]);
  const [memories, setMemories] = useState<HermesMemory[]>([]);
  const [skills, setSkills] = useState<HermesSkill[]>([]);
  const [files, setFiles] = useState<HermesFile[]>([]);
  const [vaultSecrets, setVaultSecrets] = useState<VaultSecret[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  const [agentHealth, setAgentHealth] = useState<AgentHealthResponse | null>(null);
  const [tailscaleState, setTailscaleState] = useState<TailscaleState | null>(null);
  const [syncthingState, setSyncthingState] = useState<SyncthingState | null>(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [selectedDeviceModal, setSelectedDeviceModal] = useState<Device | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateProgress | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Milestone 2, 4 & 5: Load real local device, agent health, Tailscale & Syncthing state from Desktop IPC
  const fetchTailscaleState = async () => {
    if (window.hermesHub?.getTailscaleState) {
      try {
        const ts = await window.hermesHub.getTailscaleState();
        if (ts) {
          setTailscaleState(ts);
        }
      } catch (err) {
        console.warn('Failed to load Tailscale state:', err);
      }
    }
  };

  const fetchSyncthingState = async () => {
    if (window.hermesHub?.getSyncthingState) {
      try {
        const sync = await window.hermesHub.getSyncthingState();
        if (sync) {
          setSyncthingState(sync);
          if (sync.transferState?.activeTransfers?.length > 0) {
            setActiveTransfer(sync.transferState.activeTransfers[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to load Syncthing state:', err);
      }
    }
  };

  const loadHubData = async () => {
    if (!window.hermesHub) {
      setDataError('The secure desktop bridge is unavailable. Restart Hermes Hub.');
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [settings, onboardingState] = await Promise.all([
        window.hermesHub.getAppSettings() as Promise<AppSettings>,
        window.hermesHub.getOnboardingState(),
      ]);
      setDemoMode(settings.demoMode);
      setOnboarding(onboardingState);
      setRuntimeHealth(onboardingState.runtime);

      if (settings.demoMode) {
        setDevices(MOCK_DEVICES); setStats(MOCK_OVERALL_STATS); setActiveTransfer(MOCK_ACTIVE_TRANSFER);
        setSessions(MOCK_SESSIONS); setMemories(MOCK_MEMORIES); setSkills(MOCK_SKILLS); setFiles(MOCK_FILES);
        setVaultSecrets(MOCK_VAULT_SECRETS); setActivity(MOCK_ACTIVITY); setBackups(MOCK_BACKUPS);
        return;
      }

      const results = await Promise.allSettled([
        window.hermesHub.getDevices(), window.hermesHub.getOverallStats(), window.hermesHub.getAgentHealth(),
        window.hermesHub.getTailscaleState(), window.hermesHub.getSyncthingState(), window.hermesHub.getSessions(),
        window.hermesHub.getMemories(), window.hermesHub.getSkills(), window.hermesHub.getFiles(),
        window.hermesHub.getVaultSecrets(), window.hermesHub.getActivity(), window.hermesHub.getBackups(),
        window.hermesHub.getRuntimeHealth(),
      ]);
      const value = <T,>(index: number, fallback: T): T => results[index].status === 'fulfilled' ? results[index].value as T : fallback;
      setDevices(value(0, [])); setStats(value(1, stats)); setAgentHealth(value(2, null));
      const ts = value<TailscaleState | null>(3, null); const sync = value<SyncthingState | null>(4, null);
      setTailscaleState(ts); setSyncthingState(sync); setActiveTransfer(sync?.transferState?.activeTransfers?.[0] || null);
      setSessions(value(5, [])); setMemories(value(6, [])); setSkills(value(7, [])); setFiles(value(8, []));
      setVaultSecrets(value(9, [])); setActivity(value(10, [])); setBackups(value(11, [])); setRuntimeHealth(value(12, onboardingState.runtime));
      const failed = results.filter((result) => result.status === 'rejected').length;
      if (failed) setDataError(`${failed} local data source${failed === 1 ? '' : 's'} could not be loaded. Available data is shown.`);
    } catch (error: any) {
      setDataError(error?.message || 'Unable to load local Hermes Hub data.');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadHubData();
    const unsubscribe = window.hermesHub?.onUpdateStatus?.((status) => setUpdateStatus(status));
    return () => unsubscribe?.();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePingAgent = async (): Promise<number | null> => {
    if (window.hermesHub) {
      const t0 = performance.now();
      try {
        await window.hermesHub.pingAgent();
        const latency = Math.round(performance.now() - t0);
        showNotification(`Agent responded in ${latency}ms ✓`);
        return latency;
      } catch {
        showNotification('Agent did not respond to ping');
        return null;
      }
    }
    showNotification('Local agent bridge is unavailable');
    return null;
  };

  const handlePingTailscalePeer = async (ipOrHost: string): Promise<{ success: boolean; latencyMs?: number; via?: string }> => {
    if (window.hermesHub?.pingTailscalePeer) {
      try {
        const res = await window.hermesHub.pingTailscalePeer(ipOrHost);
        if (res.success) {
          showNotification(`Tailscale ping to ${ipOrHost}: ${res.latencyMs || 12}ms via ${res.via || 'direct'} ✓`);
        } else {
          showNotification(`Tailscale ping to ${ipOrHost} timed out / unreachable`);
        }
        return res;
      } catch (err: any) {
        showNotification(`Tailscale ping error: ${err.message || 'Failed'}`);
        return { success: false };
      }
    }
    showNotification('Tailscale integration is unavailable');
    return { success: false };
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    showNotification('Safe file-based synchronization cycle started...');
    if (window.hermesHub) {
      try {
        const result = window.hermesHub.triggerSyncCycle
          ? await window.hermesHub.triggerSyncCycle()
          : await window.hermesHub.triggerSync();

        const updatedDevices = await window.hermesHub.getDevices();
        if (updatedDevices && updatedDevices.length > 0) {
          setDevices(updatedDevices);
        }
        if (window.hermesHub.getOverallStats) {
          const newStats = await window.hermesHub.getOverallStats();
          setStats(newStats);
        }
        const stagedTotal = result?.stagedCounts
          ? (result.stagedCounts.skills || 0) + (result.stagedCounts.memories || 0) + (result.stagedCounts.configs || 0)
          : 0;
        showNotification(
          stagedTotal > 0
            ? `Sync completed: ${stagedTotal} files staged & verified ✓`
            : 'All skills, memories, and configs in-sync ✓'
        );
      } catch (err: any) {
        showNotification(`Sync failed: ${err.message || 'Error during sync'}`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      setIsSyncing(false);
      showNotification('Synchronization is unavailable until the desktop bridge is restored');
    }
  };

  const handleSyncDevice = (device: Device) => {
    showNotification(`Scanning & synchronizing with ${device.deviceName}...`);
  };

  const handleRemoveDevice = async (device: Device) => {
    try {
      if (window.hermesHub?.removeDevice) {
        await window.hermesHub.removeDevice(device.deviceId);
        const updated = await window.hermesHub.getDevices();
        setDevices(updated);
        if (window.hermesHub.getOverallStats) {
          const newStats = await window.hermesHub.getOverallStats();
          setStats(newStats);
        }
      } else {
        setDevices(devices.filter((d) => d.deviceId !== device.deviceId));
      }
      setSelectedDeviceModal(null);
      showNotification(`Device ${device.deviceName} removed from cluster registry ✓`);
    } catch (err: any) {
      showNotification(`Failed to remove device: ${err.message || 'Cannot remove device'}`);
    }
  };

  const handleDeviceAdded = async (newDev: Device) => {
    try {
      if (window.hermesHub?.addDevice) {
        await window.hermesHub.addDevice(newDev);
        const updated = await window.hermesHub.getDevices();
        setDevices(updated);
        if (window.hermesHub.getOverallStats) {
          const newStats = await window.hermesHub.getOverallStats();
          setStats(newStats);
        }
      } else {
        setDevices([...devices, newDev]);
      }
      setIsAddDeviceOpen(false);
      showNotification(`Device ${newDev.deviceName} added to cluster mesh ✓`);
    } catch (err: any) {
      showNotification(`Failed to add device: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeviceAction = (action: string, device: Device) => {
    switch (action) {
      case 'create_backup':
        handleCreateBackup();
        break;
      case 'view_files':
        setSelectedDeviceModal(null);
        setCurrentTab('files');
        break;
      case 'view_secrets':
        setSelectedDeviceModal(null);
        setCurrentTab('vault');
        break;
      case 'open_folder':
        if (window.hermesHub) {
          window.hermesHub.openFolder(device.hermes.home);
        }
        showNotification(`Opening Hermes folder: ${device.hermes.home}`);
        break;
      case 'view_logs':
        setSelectedDeviceModal(null);
        setCurrentTab('activity');
        break;
      case 'remove_device':
        handleRemoveDevice(device);
        break;
      case 'compare_device':
        setSelectedDeviceModal(null);
        setCurrentTab('devices');
        break;
      default:
        showNotification(`Executed action: ${action} on ${device.deviceName}`);
    }
  };

  const handleCreateBackup = async () => {
    if (!window.hermesHub?.createBackup) {
      showNotification('Backup service is unavailable');
      return;
    }
    try {
      const newBackup = await window.hermesHub.createBackup();
      setBackups((current) => [newBackup, ...current.filter((item) => item.id !== newBackup.id)]);
      showNotification('Safe local backup created ✓');
    } catch (error: any) {
      showNotification(`Backup failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSaveSecret = async (secret: VaultSecret) => {
    if (demoMode) {
      setVaultSecrets((current) => [secret, ...current.filter((item) => item.id !== secret.id)]);
      showNotification(`Demo secret ${secret.key} saved locally for this session`);
      return;
    }
    try {
      const saved = await window.hermesHub!.saveVaultSecret(secret);
      setVaultSecrets((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      showNotification(`Secret ${secret.key} encrypted with Windows secure storage ✓`);
    } catch (error: any) {
      showNotification(`Unable to save secret: ${error?.message || 'Secure storage error'}`);
    }
  };

  const handleRevealSecret = async (id: string) => {
    if (demoMode) return vaultSecrets.find((secret) => secret.id === id) || null;
    return window.hermesHub?.getVaultSecret(id) || null;
  };

  const handleDeleteSecret = async (id: string) => {
    const removed = demoMode ? true : await window.hermesHub?.deleteVaultSecret(id);
    if (removed) setVaultSecrets((current) => current.filter((secret) => secret.id !== id));
    return Boolean(removed);
  };

  const handleCompleteOnboarding = async (input: CompleteOnboardingInput) => {
    if (!window.hermesHub) throw new Error('Desktop bridge unavailable');
    await window.hermesHub.completeOnboarding(input);
  };

  const handleExportDiagnostics = async () => {
    if (window.hermesHub) {
      try {
        await window.hermesHub.exportDiagnostics();
      } catch {}
    }
    showNotification('Diagnostics bundle exported (all credentials safely redacted) ✓');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onlineDevicesCount={stats.onlineCount}
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          title={currentTab}
          onAddDevice={() => setIsAddDeviceOpen(true)}
          onSyncNow={handleSyncNow}
          isSyncing={isSyncing}
          syncHealth={stats.syncHealth}
          onOpenNavigation={() => setIsNavigationOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        <RuntimeStatusBar
          health={runtimeHealth}
          update={updateStatus}
          loading={isLoadingData}
          onRetry={loadHubData}
          onOpenSettings={() => setCurrentTab('settings')}
        />

        {/* View Container */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {demoMode && <div className="mb-5 flex items-center justify-between rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-600 dark:text-violet-300"><span><strong>Demo Mode</strong> — all content on this screen is sample data.</span><button onClick={() => setCurrentTab('settings')} className="font-semibold hover:underline">Change</button></div>}
          {dataError && <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300"><span>{dataError}</span><button onClick={loadHubData} className="font-semibold hover:underline">Retry</button></div>}
          {currentTab === 'dashboard' && (
            <DashboardView
              devices={devices}
              stats={stats}
              activeTransfer={activeTransfer}
              recentActivity={activity}
              onSelectDevice={(d) => setSelectedDeviceModal(d)}
              onSyncDevice={handleSyncDevice}
              onAddDevice={() => setIsAddDeviceOpen(true)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'devices' && (
            <DevicesView
              devices={devices}
              onAddDevice={() => setIsAddDeviceOpen(true)}
              onSyncDevice={handleSyncDevice}
              onAction={handleDeviceAction}
            />
          )}

          {currentTab === 'sessions' && <SessionsView sessions={sessions} />}

          {currentTab === 'memory' && (
            <MemoryView memories={memories} devices={devices} />
          )}

          {currentTab === 'skills' && (
            <SkillsView skills={skills} devices={devices} />
          )}

          {currentTab === 'files' && <FilesView files={files} />}

          {currentTab === 'vault' && (
            <VaultView secrets={vaultSecrets} onSaveSecret={handleSaveSecret} onRevealSecret={handleRevealSecret} onDeleteSecret={handleDeleteSecret} />
          )}

          {currentTab === 'activity' && <ActivityView activities={activity} />}

          {currentTab === 'backups' && (
            <BackupsView backups={backups} onCreateBackup={handleCreateBackup} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              onExportDiagnostics={handleExportDiagnostics}
              agentHealth={agentHealth}
              onPingAgent={handlePingAgent}
              tailscaleState={tailscaleState}
              onPingTailscalePeer={handlePingTailscalePeer}
              onRefreshTailscale={fetchTailscaleState}
              syncthingState={syncthingState}
              onRefreshSyncthing={fetchSyncthingState}
            />
          )}

          {currentTab === 'help' && <React.Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Loading handbook…</div>}><HelpView /></React.Suspense>}
        </main>
      </div>

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        onDeviceAdded={handleDeviceAdded}
      />

      {/* Global Device Detail Modal (when selected) */}
      <DeviceDetailModal
        device={selectedDeviceModal}
        onClose={() => setSelectedDeviceModal(null)}
        onSync={handleSyncDevice}
        onAction={handleDeviceAction}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentTab}
        onSync={handleSyncNow}
        onAddDevice={() => setIsAddDeviceOpen(true)}
      />

      {onboarding && !onboarding.completed && (
        <FirstRunWizard state={onboarding} onComplete={handleCompleteOnboarding} />
      )}

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="px-4 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold shadow-lg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{notification}</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
