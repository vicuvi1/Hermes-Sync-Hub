import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityService } from '../apps/agent/src/activity/ActivityService';
import { SearchService } from '../apps/agent/src/search/SearchService';
import { SearchDocument } from '../packages/types/src';

const temporaryDirectories: string[] = [];
function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-search-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('private local Command Center index', () => {
  it('indexes 10,000 mixed documents with deterministic ranking and filters', () => {
    const directory = temporaryDirectory();
    const search = new SearchService(path.join(directory, 'index.json'));
    const documents: SearchDocument[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: `document:${index}`,
      kind: index % 2 ? 'session' : 'memory',
      title: index === 9_999 ? 'Exact launch checklist' : `Hermes item ${index}`,
      body: index === 9_999 ? 'launch checklist beta readiness' : `ordinary local content ${index}`,
      location: { tab: index % 2 ? 'sessions' : 'memory', entityId: String(index) },
    }));
    const status = search.replace(documents);
    expect(status.documentCount).toBe(10_000);
    const first = search.search({ text: 'launch checklist', filter: { kinds: ['session'] } });
    const second = search.search({ text: 'launch checklist', filter: { kinds: ['session'] } });
    expect(first[0].document.id).toBe('document:9999');
    expect(second).toEqual(first);
    expect(first.every((result) => result.document.kind === 'session')).toBe(true);
  });

  it('does not persist secret-like plaintext and recovers from a corrupt index', () => {
    const directory = temporaryDirectory();
    const indexPath = path.join(directory, 'index.json');
    const search = new SearchService(indexPath);
    search.replace([{ id: 'memory:1', kind: 'memory', title: 'Credential note', body: 'api_key=do-not-store-this', location: { tab: 'memory', entityId: '1' } }]);
    expect(fs.readFileSync(indexPath, 'utf8')).not.toContain('do-not-store-this');
    fs.writeFileSync(indexPath, '{broken', 'utf8');
    expect(new SearchService(indexPath).getStatus().state).toBe('empty');
  });
});

describe('persistent activity journal', () => {
  it('persists real events newest first across service restarts', () => {
    const directory = temporaryDirectory();
    const journal = new ActivityService(directory);
    journal.record({ type: 'backup_created', title: 'Backup created', description: 'Safe archive ready.', sourceDevice: 'Test PC', status: 'success' });
    journal.record({ type: 'file_sync', title: 'Sync failed', description: 'Peer offline.', sourceDevice: 'Test PC', status: 'error' });
    const reloaded = new ActivityService(directory).list();
    expect(reloaded.map((event) => event.title)).toEqual(['Sync failed', 'Backup created']);
    expect(reloaded[0].status).toBe('error');
  });
});
