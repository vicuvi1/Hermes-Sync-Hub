import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityEvent, ActivityEventType } from '@hermes-hub/types';

export interface RecordActivityInput {
  type: ActivityEventType;
  title: string;
  description: string;
  sourceDevice: string;
  targetDevice?: string;
  bytesTransferred?: number;
  filesCount?: number;
  status?: ActivityEvent['status'];
  metadata?: ActivityEvent['metadata'];
}

export class ActivityService {
  private readonly filePath: string;
  private readonly maxEvents: number;

  constructor(storageDirectory: string, maxEvents = 2_000) {
    this.filePath = path.join(storageDirectory, 'activity', 'events.json');
    this.maxEvents = maxEvents;
  }

  list(limit = 250): ActivityEvent[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, Math.max(1, Math.min(limit, this.maxEvents)));
    } catch {
      return [];
    }
  }

  record(input: RecordActivityInput): ActivityEvent {
    const event: ActivityEvent = {
      id: `activity-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      status: input.status || 'info',
      ...input,
    };
    const events = [event, ...this.list(this.maxEvents)].slice(0, this.maxEvents);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(events, null, 2), 'utf-8');
    fs.renameSync(temporary, this.filePath);
    return event;
  }
}
