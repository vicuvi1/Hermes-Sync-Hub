import fs from 'node:fs';
import path from 'node:path';
import { SearchDocument, SearchIndexStatus, SearchQuery, SearchResult } from '@hermes-hub/types';

interface PersistedIndex {
  version: number;
  indexedAt: string;
  documents: SearchDocument[];
}

const INDEX_VERSION = 1;
const SECRET_PATTERN = /(api[_-]?key|password|passwd|secret|bearer|authorization|private[_-]?key|token)\s*[:=]/i;

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9._/-]+/g, ' ').trim();
}

function terms(value: string): string[] {
  return Array.from(new Set(normalize(value).split(/\s+/).filter((term) => term.length > 1)));
}

function safeDocument(document: SearchDocument): SearchDocument {
  const body = SECRET_PATTERN.test(document.body) ? '[Sensitive content excluded from search]' : document.body;
  return { ...document, body: body.slice(0, 200_000) };
}

export class SearchService {
  private documents: SearchDocument[] = [];
  private status: SearchIndexStatus = { state: 'empty', documentCount: 0, indexVersion: INDEX_VERSION, message: 'Search index has not been built.' };

  constructor(private readonly filePath: string) {
    this.load();
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as PersistedIndex;
      if (parsed.version !== INDEX_VERSION || !Array.isArray(parsed.documents)) throw new Error('Index version mismatch');
      this.documents = parsed.documents.map(safeDocument);
      this.status = { state: 'ready', documentCount: this.documents.length, lastIndexedAt: parsed.indexedAt, indexVersion: INDEX_VERSION, message: `${this.documents.length} local items indexed.` };
    } catch {
      this.documents = [];
    }
  }

  getStatus(): SearchIndexStatus {
    return { ...this.status };
  }

  replace(documents: SearchDocument[]): SearchIndexStatus {
    this.status = { ...this.status, state: 'indexing', message: 'Building private local search index…' };
    this.documents = documents.map(safeDocument);
    const indexedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: INDEX_VERSION, indexedAt, documents: this.documents }), 'utf-8');
    fs.renameSync(temporary, this.filePath);
    this.status = { state: 'ready', documentCount: this.documents.length, lastIndexedAt: indexedAt, indexVersion: INDEX_VERSION, message: `${this.documents.length} local items indexed.` };
    return this.getStatus();
  }

  search(query: SearchQuery): SearchResult[] {
    const queryTerms = terms(query.text);
    if (!queryTerms.length) return [];
    const allowedKinds = query.filter?.kinds ? new Set(query.filter.kinds) : null;
    const allowedDevices = query.filter?.deviceNames ? new Set(query.filter.deviceNames.map(normalize)) : null;
    const results: SearchResult[] = [];

    for (const document of this.documents) {
      if (allowedKinds && !allowedKinds.has(document.kind)) continue;
      if (allowedDevices && (!document.deviceName || !allowedDevices.has(normalize(document.deviceName)))) continue;
      const title = normalize(document.title);
      const subtitle = normalize(document.subtitle || '');
      const body = normalize(document.body);
      const keywordText = normalize((document.keywords || []).join(' '));
      let score = 0;
      const matchedTerms: string[] = [];
      for (const term of queryTerms) {
        let matched = false;
        if (title.includes(term)) { score += title === term ? 24 : 12; matched = true; }
        if (subtitle.includes(term)) { score += 6; matched = true; }
        if (keywordText.includes(term)) { score += 5; matched = true; }
        if (body.includes(term)) { score += 2; matched = true; }
        if (matched) matchedTerms.push(term);
      }
      if (!matchedTerms.length) continue;
      score += matchedTerms.length === queryTerms.length ? 10 : 0;
      const first = Math.max(0, body.indexOf(matchedTerms[0]));
      const rawBody = document.body.replace(/\s+/g, ' ').trim();
      const start = Math.max(0, Math.min(first - 60, Math.max(0, rawBody.length - 180)));
      results.push({ document, score, matchedTerms, excerpt: rawBody.slice(start, start + 180) || document.subtitle || '' });
    }
    return results.sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title)).slice(0, Math.max(1, Math.min(query.limit || 50, 100)));
  }
}
