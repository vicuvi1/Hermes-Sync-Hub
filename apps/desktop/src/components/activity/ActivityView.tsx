import React, { useState } from 'react';
import { ActivityEvent, ActivityEventType } from '@hermes-hub/types';
import { formatTimeAgo, formatBytes } from '@hermes-hub/shared';
import {
  Activity,
  FileCheck,
  Laptop,
  MessageSquare,
  Archive,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface ActivityViewProps {
  activities: ActivityEvent[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ activities }) => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = activities.filter((act) => {
    if (filter === 'all') return true;
    return act.type === filter;
  });

  const getEventIcon = (type: ActivityEventType) => {
    switch (type) {
      case 'file_sync':
        return FileCheck;
      case 'device_connect':
      case 'device_disconnect':
        return Laptop;
      case 'session_imported':
        return MessageSquare;
      case 'backup_created':
        return Archive;
      case 'conflict_detected':
        return AlertTriangle;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Filter Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'file_sync', 'session_imported', 'device_connect', 'backup_created'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all whitespace-nowrap ${
              filter === f
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? 'All Activity' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      <div className="rounded-2xl border border-border bg-card/70 overflow-hidden divide-y divide-border/40 shadow-xs">
        {filtered.map((item) => {
          const Icon = getEventIcon(item.type);
          return (
            <div
              key={item.id}
              className="p-4 hover:bg-muted/30 transition-colors flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </div>
                  {item.bytesTransferred && (
                    <div className="text-[11px] font-mono text-primary mt-1">
                      {formatBytes(item.bytesTransferred)} transferred
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right whitespace-nowrap">
                <div className="text-xs font-mono text-muted-foreground">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTimeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
