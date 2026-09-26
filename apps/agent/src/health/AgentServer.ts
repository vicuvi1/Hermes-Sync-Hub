import http from 'node:http';
import { DeviceIdentityService } from '../devices/DeviceService.js';
import { DeviceRegistryService } from '../devices/DeviceRegistry.js';
import { HealthMonitorService } from './HealthMonitor.js';
import { HermesService } from '../hermes/HermesAdapter.js';
import { TailscaleAdapter, ITailscaleAdapter } from '../tailscale/TailscaleAdapter.js';
import { SyncthingAdapter, ISyncthingAdapter } from '../sync/SyncthingAdapter.js';
import { PairingService } from '../pairing/PairingService.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';

export const DEFAULT_AGENT_PORT = 48199;

export class AgentServer {
  private server: http.Server | null = null;
  private port: number = DEFAULT_AGENT_PORT;
  private identityService: DeviceIdentityService;
  private deviceRegistry: DeviceRegistryService;
  private healthMonitor: HealthMonitorService;
  private hermesService: HermesService;
  private tailscaleAdapter: ITailscaleAdapter;
  private syncthingAdapter: ISyncthingAdapter;
  private pairingService: PairingService;
  private workspaceService: WorkspaceService;

  constructor(
    identityService?: DeviceIdentityService,
    healthMonitor?: HealthMonitorService,
    hermesService?: HermesService,
    tailscaleAdapter?: ITailscaleAdapter,
    syncthingAdapter?: ISyncthingAdapter,
    deviceRegistry?: DeviceRegistryService,
    pairingService?: PairingService,
    workspaceService?: WorkspaceService
  ) {
    this.identityService = identityService || new DeviceIdentityService();
    this.deviceRegistry = deviceRegistry || new DeviceRegistryService(this.identityService);
    this.healthMonitor = healthMonitor || new HealthMonitorService(this.identityService);
    this.hermesService = hermesService || new HermesService();
    this.tailscaleAdapter = tailscaleAdapter || new TailscaleAdapter();
    this.syncthingAdapter = syncthingAdapter || new SyncthingAdapter();
    this.pairingService =
      pairingService ||
      new PairingService(
        this.identityService,
        this.deviceRegistry,
        this.tailscaleAdapter,
        this.syncthingAdapter,
        this.hermesService
      );
    this.workspaceService =
      workspaceService ||
      new WorkspaceService(this.identityService, this.hermesService);
  }

  /**
   * Starts the local loopback HTTP server
   */
  start(port = DEFAULT_AGENT_PORT): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS for local desktop renderer
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = req.url?.split('?')[0] || '/';

        try {
          if (req.method === 'GET' && url === '/health') {
            const health = await this.healthMonitor.getHealthSnapshot();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
            return;
          }

          if (req.method === 'GET' && url === '/device') {
            const device = this.identityService.getLocalDevice();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(device));
            return;
          }

          if (req.method === 'GET' && url === '/devices') {
            const devices = await this.deviceRegistry.reconcile(this.tailscaleAdapter, this.syncthingAdapter);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(devices));
            return;
          }

          if (req.method === 'POST' && url === '/devices') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const created = await this.deviceRegistry.addDevice(parsed);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(created));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
              }
            });
            return;
          }

          if (req.method === 'DELETE' && url.startsWith('/devices/')) {
            const deviceId = url.slice('/devices/'.length);
            const success = await this.deviceRegistry.removeDevice(deviceId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success }));
            return;
          }

          if (req.method === 'GET' && url.startsWith('/devices/compare')) {
            const fullUrl = new URL(req.url || '', 'http://127.0.0.1');
            const a = fullUrl.searchParams.get('a');
            const b = fullUrl.searchParams.get('b');
            if (!a || !b) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing query parameters a and b' }));
              return;
            }
            try {
              const comparison = await this.deviceRegistry.compareDevices(a, b);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(comparison));
            } catch (err: any) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Comparison failed' }));
            }
            return;
          }

          if (req.method === 'POST' && url === '/pairing/invitation') {
            try {
              const invitation = await this.pairingService.generateInvitation();
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(invitation));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          if (req.method === 'GET' && url === '/pairing/invitation/active') {
            const active = this.pairingService.getActiveInvitation();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ active }));
            return;
          }

          if (req.method === 'POST' && url === '/pairing/validate') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const result = this.pairingService.validateCodeOrPayload(parsed.codeOrPayload || '');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (req.method === 'POST' && url === '/pairing/execute') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const result = await this.pairingService.executePairing(parsed);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (req.method === 'GET' && url === '/workspace/status') {
            const status = await this.workspaceService.getWorkspaceStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
            return;
          }

          if (req.method === 'POST' && url === '/workspace/init') {
            const status = await this.workspaceService.initWorkspace();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
            return;
          }

          if (req.method === 'GET' && url === '/workspace/manifest') {
            const manifest = await this.workspaceService.getManifest();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(manifest));
            return;
          }

          if (req.method === 'POST' && url === '/workspace/manifest/generate') {
            const manifest = await this.workspaceService.generateManifest();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(manifest));
            return;
          }

          if (req.method === 'POST' && url === '/workspace/manifest/verify') {
            const verification = await this.workspaceService.verifyManifest();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(verification));
            return;
          }

          if (req.method === 'GET' && url === '/workspace/snapshots') {
            const snapshots = await this.workspaceService.getSnapshots();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(snapshots));
            return;
          }

          if (req.method === 'POST' && url === '/workspace/snapshots') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const snapshot = await this.workspaceService.createSafeSnapshot(parsed);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(snapshot));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (req.method === 'GET' && url === '/hardware') {
            const hardware = this.identityService.getSystemHardwareInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(hardware));
            return;
          }

          if (req.method === 'GET' && url === '/hermes') {
            const hermesStatus = await this.hermesService.getStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(hermesStatus));
            return;
          }

          if (req.method === 'GET' && url === '/tailscale') {
            const tailscaleState = await this.tailscaleAdapter.getState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tailscaleState));
            return;
          }

          if (req.method === 'POST' && url === '/tailscale/ping') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const target = parsed.ipOrHost || '100.84.12.20';
                const result = await this.tailscaleAdapter.pingPeer(target);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message || 'Invalid request body' }));
              }
            });
            return;
          }

          if (req.method === 'GET' && (url === '/syncthing' || url === '/syncthing/state')) {
            const state = await this.syncthingAdapter.getState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state));
            return;
          }

          if (req.method === 'GET' && url === '/syncthing/devices') {
            const devices = await this.syncthingAdapter.getDevices();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(devices));
            return;
          }

          if (req.method === 'GET' && url === '/syncthing/folders') {
            const folders = await this.syncthingAdapter.getFolders();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(folders));
            return;
          }

          if (req.method === 'GET' && url === '/syncthing/connections') {
            const conns = await this.syncthingAdapter.getConnectionState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(conns));
            return;
          }

          if (req.method === 'GET' && url === '/syncthing/transfer') {
            const transfer = await this.syncthingAdapter.getTransferState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(transfer));
            return;
          }

          if (req.method === 'POST' && url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ pong: true, time: new Date().toISOString() }));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });

      // Strictly bind to 127.0.0.1 for local-only loopback security
      this.server.listen(port, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve(this.port);
        } else {
          resolve(port);
        }
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Stops the server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) reject(err);
        else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  getPort(): number {
    return this.port;
  }
}
