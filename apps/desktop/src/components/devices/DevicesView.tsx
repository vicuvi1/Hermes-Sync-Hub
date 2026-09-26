import React, { useState } from 'react';
import { Device } from '@hermes-hub/types';
import { formatBytes } from '@hermes-hub/shared';
import { DeviceCard } from '../dashboard/DeviceCard';
import { DeviceDetailModal } from './DeviceDetailModal';
import { DeviceCompareModal } from './DeviceCompareModal';
import { MeshPrimaryPanel } from './MeshPrimaryPanel';
import {
  Plus,
  Search,
  Filter,
  GitCompare,
  Server,
  Radio,
  WifiOff,
  MessagesSquare,
  HardDrive,
  Cpu,
} from 'lucide-react';

interface DevicesViewProps {
  devices: Device[];
  onAddDevice: () => void;
  onSyncDevice: (device: Device) => void;
  onAction: (action: string, device: Device) => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  devices,
  onAddDevice,
  onSyncDevice,
  onAction,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'online' | 'offline' | 'windows' | 'linux' | 'macos'>('all');
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareDevA, setCompareDevA] = useState<Device | null>(null);
  const [compareDevB, setCompareDevB] = useState<Device | null>(null);

  // Aggregates
  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.online).length;
  const offlineCount = totalCount - onlineCount;
  const totalSessions = devices.reduce((sum, d) => sum + (d.data?.sessions || 0), 0);
  const totalStorageBytes = devices.reduce((sum, d) => sum + (d.data?.totalSizeBytes || 0), 0);

  // Filtering
  const filteredDevices = devices.filter((d) => {
    // Search match
    const q = search.toLowerCase();
    const matchesSearch =
      d.deviceName.toLowerCase().includes(q) ||
      d.hostname.toLowerCase().includes(q) ||
      (d.tailscale?.ip && d.tailscale.ip.includes(q)) ||
      (d.hermes?.profile && d.hermes.profile.toLowerCase().includes(q)) ||
      (d.hermes?.version && d.hermes.version.includes(q));

    if (!matchesSearch) return false;

    // Filter pill match
    if (filterTab === 'online') return d.online;
    if (filterTab === 'offline') return !d.online;
    if (filterTab === 'windows') return d.os === 'windows';
    if (filterTab === 'linux') return d.os === 'linux';
    if (filterTab === 'macos') return d.os === 'macos';
    return true;
  });

  const handleOpenCompare = (devA?: Device, devB?: Device) => {
    if (devA) setCompareDevA(devA);
    else if (devices.length > 0) setCompareDevA(devices[0]);

    if (devB) setCompareDevB(devB);
    else if (devices.length > 1) setCompareDevB(devices[1]);

    setIsCompareOpen(true);
  };

  const handleModalAction = (action: string, device: Device) => {
    if (action === 'compare_device') {
      setSelectedDevice(null);
      handleOpenCompare(device, devices.find((d) => d.deviceId !== device.deviceId));
      return;
    }
    onAction(action, device);
  };

  return (
    <div className="space-y-6 pb-12">
      <MeshPrimaryPanel devices={devices} />

      {/* Cluster Overview Header Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Cluster Nodes</div>
            <div className="text-lg font-bold font-mono text-foreground">{totalCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Online Live</div>
            <div className="text-lg font-bold font-mono text-emerald-500 flex items-center gap-1.5">
              <span>{onlineCount}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-zinc-500/10 text-zinc-400">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Offline</div>
            <div className="text-lg font-bold font-mono text-zinc-400">{offlineCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <MessagesSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Hermes Sessions</div>
            <div className="text-lg font-bold font-mono text-foreground">{totalSessions}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Storage</div>
            <div className="text-lg font-bold font-mono text-foreground truncate">
              {formatBytes(totalStorageBytes)}
            </div>
          </div>
        </div>
      </div>

      {/* Top action row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search devices by name, hostname, Tailscale IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2">
          {devices.length >= 2 && (
            <button
              onClick={() => handleOpenCompare()}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:bg-muted transition-all shadow-xs"
            >
              <GitCompare className="h-4 w-4 text-primary" />
              <span>Compare Devices</span>
            </button>
          )}

          <button
            onClick={onAddDevice}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Device</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs / Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterTab === 'all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All Nodes ({totalCount})
        </button>
        <button
          onClick={() => setFilterTab('online')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            filterTab === 'online'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Online ({onlineCount})
        </button>
        <button
          onClick={() => setFilterTab('offline')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterTab === 'offline'
              ? 'bg-zinc-700 text-white shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Offline ({offlineCount})
        </button>
        <span className="h-4 w-[1px] bg-border mx-1" />
        <button
          onClick={() => setFilterTab('windows')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterTab === 'windows'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Windows
        </button>
        <button
          onClick={() => setFilterTab('linux')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterTab === 'linux'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Linux
        </button>
        <button
          onClick={() => setFilterTab('macos')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterTab === 'macos'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          macOS
        </button>
      </div>

      {/* Grid */}
      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              onSelect={(dev) => setSelectedDevice(dev)}
              onSyncDevice={onSyncDevice}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">No devices found</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              No cluster devices matched the search term or selected filters.
            </p>
          </div>
          <button
            onClick={() => {
              setSearch('');
              setFilterTab('all');
            }}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onSync={onSyncDevice}
        onAction={handleModalAction}
      />

      {/* Compare Modal */}
      <DeviceCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        devices={devices}
        initialDeviceA={compareDevA}
        initialDeviceB={compareDevB}
      />
    </div>
  );
};
