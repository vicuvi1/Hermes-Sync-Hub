import fs, { type FSWatcher } from 'node:fs';
import type { ContinuousSyncStatus } from '@hermes-hub/types';

export type ContinuousSyncTrigger = NonNullable<ContinuousSyncStatus['trigger']>;
export type ContinuousSyncResult = { actions?: unknown[]; conflicts?: unknown[]; transportReady?: boolean };
export type ContinuousSyncRunner = () => Promise<ContinuousSyncResult>;
export type ContinuousSyncRoot = { path: string; accepts?: (relativePath: string) => boolean };

export interface ContinuousSyncOptions {
  enabled: boolean;
  intervalSeconds: number;
  debounceMs: number;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export class ContinuousSyncService {
  private watchers: FSWatcher[] = [];
  private periodicTimer?: NodeJS.Timeout;
  private scheduledTimer?: NodeJS.Timeout;
  private running = false;
  private rerunRequested = false;
  private suppressEventsUntil = 0;
  private options: ContinuousSyncOptions;
  private status: ContinuousSyncStatus;

  constructor(
    private readonly runner: ContinuousSyncRunner,
    options: ContinuousSyncOptions,
    private readonly onStatus?: (status: ContinuousSyncStatus) => void,
  ) {
    this.options = this.normalize(options);
    this.status = { enabled: this.options.enabled, state: 'stopped', watchedRoots: [], lastActionsCount: 0, pendingConflicts: 0, transportState: 'unknown', message: this.options.enabled ? 'Continuous synchronization is starting.' : 'Continuous synchronization is disabled.' };
  }

  private normalize(options: ContinuousSyncOptions): ContinuousSyncOptions {
    return { enabled: options.enabled === true, intervalSeconds: clamp(Number(options.intervalSeconds), 10, 3600), debounceMs: clamp(Number(options.debounceMs), 250, 10_000) };
  }

  getStatus(): ContinuousSyncStatus { return { ...this.status, watchedRoots: [...this.status.watchedRoots] }; }

  private publish(updates: Partial<ContinuousSyncStatus>): void {
    this.status = { ...this.status, ...updates, enabled: this.options.enabled };
    this.onStatus?.(this.getStatus());
  }

  start(roots: ContinuousSyncRoot[]): void {
    this.stop(false);
    const available = roots.filter((root) => {
      try { return fs.existsSync(root.path) && fs.statSync(root.path).isDirectory(); } catch { return false; }
    });
    this.status.watchedRoots = available.map((root) => root.path);
    if (!this.options.enabled) {
      this.publish({ state: 'stopped', message: 'Continuous synchronization is disabled.' });
      return;
    }
    for (const root of available) {
      try {
        const watcher = fs.watch(root.path, { recursive: true }, (_event, filename) => {
          if (Date.now() < this.suppressEventsUntil || this.running) return;
          const relative = String(filename || '').replace(/\\/g, '/');
          if (root.accepts && !root.accepts(relative)) return;
          this.schedule('file-change', this.options.debounceMs);
        });
        watcher.on('error', () => {});
        this.watchers.push(watcher);
      } catch {}
    }
    this.periodicTimer = setInterval(() => this.schedule('periodic', 0), this.options.intervalSeconds * 1000);
    this.periodicTimer.unref?.();
    this.publish({ state: 'watching', watchedRoots: available.map((root) => root.path), message: `Watching ${available.length} data location(s); safety reconciliation runs every ${this.options.intervalSeconds} seconds.` });
    this.schedule('startup', 2500);
  }

  update(options: ContinuousSyncOptions, roots: ContinuousSyncRoot[]): void {
    this.options = this.normalize(options);
    this.start(roots);
  }

  schedule(trigger: ContinuousSyncTrigger, delayMs = this.options.debounceMs): void {
    if (!this.options.enabled) return;
    if (this.running) { this.rerunRequested = true; return; }
    if (this.scheduledTimer) clearTimeout(this.scheduledTimer);
    const nextAttemptAt = new Date(Date.now() + Math.max(0, delayMs)).toISOString();
    this.publish({ state: trigger === 'retry' ? 'retrying' : 'scheduled', trigger, nextAttemptAt, message: trigger === 'file-change' ? 'A supported file changed; synchronization is queued.' : trigger === 'retry' ? 'Synchronization will retry automatically.' : 'Background synchronization is queued.' });
    this.scheduledTimer = setTimeout(() => void this.run(trigger), Math.max(0, delayMs));
    this.scheduledTimer.unref?.();
  }

  async run(trigger: ContinuousSyncTrigger = 'manual'): Promise<void> {
    if (!this.options.enabled || this.running) { if (this.running) this.rerunRequested = true; return; }
    if (this.scheduledTimer) { clearTimeout(this.scheduledTimer); this.scheduledTimer = undefined; }
    this.running = true;
    this.publish({ state: 'syncing', trigger, lastAttemptAt: new Date().toISOString(), nextAttemptAt: undefined, lastError: undefined, message: 'Reconciling Hermes files and requesting immediate Syncthing transfer…' });
    try {
      const result = await this.runner();
      this.suppressEventsUntil = Date.now() + 3000;
      const transportState = result.transportReady === undefined ? 'unknown' : result.transportReady ? 'ready' : 'unavailable';
      this.publish({ state: result.transportReady === false ? 'retrying' : 'watching', transportState, lastSuccessAt: new Date().toISOString(), nextAttemptAt: result.transportReady === false ? new Date(Date.now() + this.options.intervalSeconds * 1000).toISOString() : undefined, lastActionsCount: result.actions?.length || 0, pendingConflicts: result.conflicts?.length || 0, message: result.conflicts?.length ? `Background sync preserved ${result.conflicts.length} conflict(s) for review.` : result.transportReady === false ? 'Local files are staged, but Syncthing is not running. Cross-PC transfer will retry automatically.' : 'Background synchronization is current.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background synchronization failed.';
      this.publish({ state: 'error', lastError: message, message });
      this.running = false;
      this.schedule('retry', Math.min(15_000, this.options.intervalSeconds * 1000));
      return;
    } finally {
      this.running = false;
    }
    if (this.rerunRequested) { this.rerunRequested = false; this.schedule('file-change', this.options.debounceMs); }
  }

  stop(publish = true): void {
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    if (this.scheduledTimer) clearTimeout(this.scheduledTimer);
    this.periodicTimer = undefined;
    this.scheduledTimer = undefined;
    this.rerunRequested = false;
    if (publish) this.publish({ state: 'stopped', watchedRoots: [], nextAttemptAt: undefined, message: 'Continuous synchronization is stopped.' });
  }
}
