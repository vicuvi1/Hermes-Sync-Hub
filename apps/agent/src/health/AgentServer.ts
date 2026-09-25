import http from 'node:http';
import { DeviceIdentityService } from '../devices/DeviceService.js';
import { HealthMonitorService } from './HealthMonitor.js';

export const DEFAULT_AGENT_PORT = 48199;

export class AgentServer {
  private server: http.Server | null = null;
  private port: number = DEFAULT_AGENT_PORT;
  private identityService: DeviceIdentityService;
  private healthMonitor: HealthMonitorService;

  constructor(identityService?: DeviceIdentityService, healthMonitor?: HealthMonitorService) {
    this.identityService = identityService || new DeviceIdentityService();
    this.healthMonitor = healthMonitor || new HealthMonitorService(this.identityService);
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

          if (req.method === 'GET' && url === '/hardware') {
            const hardware = this.identityService.getSystemHardwareInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(hardware));
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
