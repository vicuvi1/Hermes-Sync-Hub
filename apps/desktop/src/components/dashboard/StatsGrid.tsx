import React from 'react';
import { OverallStats } from '@hermes-hub/types';
import { Laptop, MessageSquare, Brain, Sparkles, Clock, AlertTriangle } from 'lucide-react';

interface StatsGridProps {
  stats: OverallStats;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Devices',
      value: stats.devicesCount,
      subValue: `${stats.onlineCount} online`,
      icon: Laptop,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      label: 'Sessions',
      value: stats.sessionsCount,
      subValue: 'Indexed across mesh',
      icon: MessageSquare,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Memories',
      value: stats.memoriesCount,
      subValue: 'Persistent notes',
      icon: Brain,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    {
      label: 'Skills',
      value: stats.skillsCount,
      subValue: 'Agent capabilities',
      icon: Sparkles,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Pending Files',
      value: stats.pendingFilesCount,
      subValue: stats.pendingFilesCount === 0 ? 'Up to date' : 'Queued for sync',
      icon: Clock,
      color: stats.pendingFilesCount === 0 ? 'text-emerald-500' : 'text-amber-500',
      bgColor: stats.pendingFilesCount === 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      borderColor: stats.pendingFilesCount === 0 ? 'border-emerald-500/20' : 'border-amber-500/20',
    },
    {
      label: 'Conflicts',
      value: stats.conflictsCount,
      subValue: stats.conflictsCount === 0 ? 'Zero conflicts' : 'Attention needed',
      icon: AlertTriangle,
      color: stats.conflictsCount === 0 ? 'text-emerald-500' : 'text-rose-500',
      bgColor: stats.conflictsCount === 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      borderColor: stats.conflictsCount === 0 ? 'border-emerald-500/20' : 'border-rose-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="rounded-xl border border-border/80 bg-card/60 p-3.5 backdrop-blur-sm shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              <div className={`p-1.5 rounded-md ${card.bgColor} ${card.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                {card.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {card.subValue}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
