import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DiagnosticsReport } from '@hermes-hub/types';
import { redactSecrets } from '@hermes-hub/shared';
import { DeviceIdentityService } from '../devices/DeviceService.js';
import { HealthMonitorService } from '../health/HealthMonitor.js';
import { HermesService } from '../hermes/HermesAdapter.js';
import { ITailscaleAdapter, TailscaleAdapter } from '../tailscale/TailscaleAdapter.js';
import { ISyncthingAdapter, SyncthingAdapter } from '../sync/SyncthingAdapter.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { BackupService } from '../backups/BackupService.js';

export class DiagnosticsService {
  private identityService: DeviceIdentityService;
  private healthMonitor: HealthMonitorService;
  private hermesService: HermesService;
  private tailscaleAdapter: ITailscaleAdapter;
  private syncthingAdapter: ISyncthingAdapter;
  private workspaceService: WorkspaceService;
  private backupService: BackupService;

  constructor(
    identityService?: DeviceIdentityService,
    healthMonitor?: HealthMonitorService,
    hermesService?: HermesService,
    tailscaleAdapter?: ITailscaleAdapter,
    syncthingAdapter?: ISyncthingAdapter,
    workspaceService?: WorkspaceService,
    backupService?: BackupService
  ) {
    this.identityService = identityService || new DeviceIdentityService();
    this.healthMonitor = healthMonitor || new HealthMonitorService(this.identityService);
    this.hermesService = hermesService || new HermesService();
    this.tailscaleAdapter = tailscaleAdapter || new TailscaleAdapter();
    this.syncthingAdapter = syncthingAdapter || new SyncthingAdapter();
    this.workspaceService =
      workspaceService || new WorkspaceService(this.identityService, this.hermesService);
    this.backupService =
      backupService ||
      new BackupService(this.workspaceService, this.hermesService, this.identityService);
  }

  /**
   * Compiles a comprehensive, secret-redacted diagnostic snapshot
   */
  async generateDiagnosticsReport(): Promise<DiagnosticsReport> {
    const localDev = this.identityService.getLocalDevice();
    const hardware = this.identityService.getSystemHardwareInfo();
    const health = await this.healthMonitor.getHealthSnapshot();
    const hermesStatus = await this.hermesService.getStatus();
    const tsState = await this.tailscaleAdapter.getState();
    const syncState = await this.syncthingAdapter.getState();
    const wsStatus = await this.workspaceService.getWorkspaceStatus();
    const manifestVerify = await this.workspaceService.verifyManifest();
    const snapshots = await this.workspaceService.getSnapshots();
    const backups = await this.backupService.getBackups();

    const report: DiagnosticsReport = {
      generatedAt: new Date().toISOString(),
      system: {
        hostname: localDev.hostname,
        os: localDev.os,
        platform: process.platform,
        arch: hardware.architecture,
        cpuCores: hardware.cpuCores,
        totalMemoryMb: Math.round(hardware.totalMemoryBytes / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      },
      agent: {
        status: health.status,
        uptimeSeconds: health.uptimeSeconds,
        pid: health.pid,
        rssMemoryMb: health.memoryUsageMb.rss,
        loopbackPort: 42424,
      },
      hermes: {
        installed: hermesStatus.isInstalled,
        running: hermesStatus.isRunning,
        version: hermesStatus.version,
        home: hermesStatus.homeDirectory,
        detectedDatabases: hermesStatus.detectedDatabases || [],
      },
      tailscale: {
        installed: tsState.installed,
        connected: tsState.connected,
        backendState: tsState.backendState,
        selfIp: tsState.self?.ipv4,
        peersCount: tsState.peers.length,
      },
      syncthing: {
        installed: syncState.installed,
        running: syncState.running,
        deviceId: syncState.myID,
        foldersCount: syncState.folders.length,
        devicesCount: syncState.devices.length,
      },
      workspace: {
        rootPath: wsStatus.rootPath,
        manifestValid: manifestVerify.valid,
        totalTrackedFiles: wsStatus.totalFiles,
        snapshotsCount: snapshots.length,
        backupsCount: backups.length,
      },
      recentLogs: [
        `Local device registered as ${localDev.deviceName} (${localDev.deviceId})`,
        `Hermes adapter detected version ${hermesStatus.version} at ${hermesStatus.homeDirectory}`,
        `Tailscale mesh peer connection state: ${tsState.connected ? 'connected' : 'offline'} (${tsState.peers.length} peers)`,
        `Syncthing instance state: ${syncState.running ? 'running' : 'stopped'} (${syncState.devices.length} devices)`,
        `Workspace manifest verification: ${manifestVerify.valid ? 'passed' : 'failed'}`,
        `Backups available: ${backups.length} valid archive bundles`,
      ],
    };

    // Guarantee that secrets are never leaked in diagnostic logs or metadata
    const jsonStr = JSON.stringify(report);
    const cleanStr = redactSecrets(jsonStr);
    return JSON.parse(cleanStr);
  }

  /**
   * Formats the diagnostic report into clean, shareable Markdown
   */
  async renderDiagnosticsMarkdown(): Promise<string> {
    const report = await this.generateDiagnosticsReport();

    const lines: string[] = [
      `# Hermes Hub Diagnostic Report`,
      ``,
      `*Generated at: ${report.generatedAt}*`,
      ``,
      `## System & Hardware`,
      `- **Hostname:** \`${report.system.hostname}\``,
      `- **OS:** \`${report.system.os}\` (${report.system.platform} ${report.system.arch})`,
      `- **CPU Cores:** ${report.system.cpuCores}`,
      `- **Memory:** ${report.system.freeMemoryMb} MB free / ${report.system.totalMemoryMb} MB total`,
      ``,
      `## Agent Daemon`,
      `- **Status:** \`${report.agent.status}\``,
      `- **Uptime:** ${report.agent.uptimeSeconds} seconds`,
      `- **PID:** ${report.agent.pid}`,
      `- **Memory (RSS):** ${report.agent.rssMemoryMb} MB`,
      ``,
      `## Hermes Agent Detection`,
      `- **Installed:** ${report.hermes.installed ? 'Yes' : 'No'}`,
      `- **Running:** ${report.hermes.running ? 'Yes (Active WAL)' : 'Stopped (Clean)'}`,
      `- **Version:** \`${report.hermes.version}\``,
      `- **Home Path:** \`${report.hermes.home}\``,
      `- **Databases:** ${report.hermes.detectedDatabases.join(', ') || 'None'}`,
      ``,
      `## Network & Mesh (Tailscale)`,
      `- **Installed:** ${report.tailscale.installed ? 'Yes' : 'No'}`,
      `- **Connected:** ${report.tailscale.connected ? 'Yes' : 'No'} (${report.tailscale.backendState || 'Unknown'})`,
      `- **Self IP:** \`${report.tailscale.selfIp || 'N/A'}\``,
      `- **Peers:** ${report.tailscale.peersCount} mesh peers`,
      ``,
      `## Sync Engine (Syncthing)`,
      `- **Running:** ${report.syncthing.running ? 'Yes' : 'No'}`,
      `- **Device ID:** \`${report.syncthing.deviceId || 'N/A'}\``,
      `- **Shared Folders:** ${report.syncthing.foldersCount}`,
      `- **Connected Devices:** ${report.syncthing.devicesCount}`,
      ``,
      `## Managed Workspace & Backups`,
      `- **Workspace Root:** \`${report.workspace.rootPath}\``,
      `- **Manifest Valid:** ${report.workspace.manifestValid ? '✅ Verified' : '⚠️ Tampering Detected'}`,
      `- **Tracked Files:** ${report.workspace.totalTrackedFiles}`,
      `- **Snapshots:** ${report.workspace.snapshotsCount}`,
      `- **Backups:** ${report.workspace.backupsCount}`,
      ``,
      `---`,
      `*Report generated by Hermes Hub Diagnostics Engine with secret redaction.*`,
    ];

    return lines.join('\n');
  }

  /**
   * Exports the diagnostic report to a file
   */
  async exportDiagnosticsToFile(outputPath?: string): Promise<string> {
    const md = await this.renderDiagnosticsMarkdown();
    const wsRoot = this.workspaceService.getRootPath();
    const filePath =
      outputPath ||
      path.join(wsRoot, 'activity', `diagnostics-${Date.now()}.md`);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, md, 'utf-8');
    return filePath;
  }
}
