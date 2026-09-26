import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  FileRevision,
  RevisionHistory,
  RevisionRollbackResult,
} from '@hermes-hub/types';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { DeviceIdentityService } from '../devices/DeviceService.js';

export class RevisionService {
  private workspaceService: WorkspaceService;
  private identityService: DeviceIdentityService;

  constructor(workspaceService?: WorkspaceService, identityService?: DeviceIdentityService) {
    this.identityService = identityService || new DeviceIdentityService();
    this.workspaceService = workspaceService || new WorkspaceService(this.identityService);
  }

  /**
   * Path to the master revisions manifest file
   */
  private getRevisionsManifestPath(): string {
    const layout = this.workspaceService.getLayout();
    return path.join(layout.manifests, 'file-revisions.json');
  }

  /**
   * Path to the revision history blob store
   */
  private getRevisionHistoryBlobsDir(): string {
    const layout = this.workspaceService.getLayout();
    const dir = path.join(layout.manifests, 'revision_blobs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Calculates SHA-256 of text or buffer
   */
  private calculateHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Records a new file revision. Saves the content blob and increments revision number.
   */
  async recordRevision(params: {
    relativePath: string;
    category: string;
    content?: string;
    deviceId?: string;
    deviceName?: string;
    changeSummary?: string;
    author?: string;
  }): Promise<FileRevision> {
    const wsRoot = this.workspaceService.getRootPath();
    const normPath = params.relativePath.replace(/\\/g, '/');
    const fullPath = path.join(wsRoot, normPath);

    let content = params.content;
    if (content === undefined && fs.existsSync(fullPath)) {
      content = fs.readFileSync(fullPath, 'utf-8');
    }
    if (content === undefined) content = '';

    const sha = this.calculateHash(content);
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    const localDev = this.identityService.getLocalDevice();

    // Save blob into revision_blobs
    const blobsDir = this.getRevisionHistoryBlobsDir();
    const blobPath = path.join(blobsDir, `${sha}.blob`);
    if (!fs.existsSync(blobPath)) {
      fs.writeFileSync(blobPath, content, 'utf-8');
    }

    const allRevisions = await this.getAllRevisions();
    const fileRevHistory = allRevisions.filter((r) => r.filePath === normPath);
    const nextRevNumber = fileRevHistory.length > 0 ? Math.max(...fileRevHistory.map((r) => r.revision)) + 1 : 1;

    const revisionRecord: FileRevision = {
      revision: nextRevNumber,
      filePath: normPath,
      category: params.category,
      modifiedAt: new Date().toISOString(),
      deviceId: params.deviceId || localDev.deviceId,
      deviceName: params.deviceName || localDev.deviceName,
      sha256: sha,
      sizeBytes,
      author: params.author || localDev.deviceName,
      changeSummary: params.changeSummary || `Revision ${nextRevNumber} update`,
      contentSnippet: content.slice(0, 150).replace(/[\r\n]+/g, ' '),
    };

    allRevisions.push(revisionRecord);
    fs.writeFileSync(this.getRevisionsManifestPath(), JSON.stringify(allRevisions, null, 2), 'utf-8');

    return revisionRecord;
  }

  /**
   * Retrieves all recorded file revisions
   */
  async getAllRevisions(): Promise<FileRevision[]> {
    const manifestPath = this.getRevisionsManifestPath();
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  /**
   * Retrieves revision history for a specific file path
   */
  async getFileRevisions(relativePath: string): Promise<RevisionHistory> {
    const norm = relativePath.replace(/\\/g, '/');
    const all = await this.getAllRevisions();
    const filtered = all
      .filter((r) => r.filePath === norm)
      .sort((a, b) => b.revision - a.revision);

    const currentRev = filtered.length > 0 ? filtered[0].revision : 1;

    return {
      filePath: norm,
      currentRevision: currentRev,
      totalRevisions: filtered.length,
      revisions: filtered,
    };
  }

  /**
   * Rolls back a file to an earlier revision safely
   */
  async rollbackRevision(
    relativePath: string,
    targetRevisionNumber: number
  ): Promise<RevisionRollbackResult> {
    const norm = relativePath.replace(/\\/g, '/');
    const history = await this.getFileRevisions(norm);

    const targetRev = history.revisions.find((r) => r.revision === targetRevisionNumber);
    if (!targetRev) {
      throw new Error(`Revision #${targetRevisionNumber} not found for ${norm}`);
    }

    const blobsDir = this.getRevisionHistoryBlobsDir();
    const blobPath = path.join(blobsDir, `${targetRev.sha256}.blob`);
    if (!fs.existsSync(blobPath)) {
      throw new Error(`Content blob ${targetRev.sha256} missing for revision #${targetRevisionNumber}`);
    }

    const targetContent = fs.readFileSync(blobPath, 'utf-8');
    const wsRoot = this.workspaceService.getRootPath();
    const fullPath = path.join(wsRoot, norm);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, targetContent, 'utf-8');

    // Record the rollback as a new revision pointing to the historical content
    const rolledBackRecord = await this.recordRevision({
      relativePath: norm,
      category: targetRev.category,
      content: targetContent,
      changeSummary: `Rolled back to revision #${targetRevisionNumber}`,
    });

    // Regenerate workspace manifest
    await this.workspaceService.generateManifest();

    return {
      success: true,
      filePath: norm,
      previousRevision: history.currentRevision,
      currentRevision: rolledBackRecord.revision,
      rolledBackAt: new Date().toISOString(),
      message: `Successfully rolled back ${norm} to revision #${targetRevisionNumber} (recorded as rev #${rolledBackRecord.revision})`,
    };
  }
}
