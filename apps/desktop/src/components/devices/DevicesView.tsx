import React, { useState } from 'react';
import { Device } from '@hermes-hub/types';
import { DeviceCard } from '../dashboard/DeviceCard';
import { DeviceDetailModal } from './DeviceDetailModal';
import { Plus, Search, Filter } from 'lucide-react';

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

  const filteredDevices = devices.filter(
    (d) =>
      d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
      d.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (d.tailscale.ip && d.tailscale.ip.includes(search))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search devices by name, host, or Tailscale IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          onClick={onAddDevice}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Device</span>
        </button>
      </div>

      {/* Grid */}
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

      {/* Detail Modal */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onSync={onSyncDevice}
        onAction={onAction}
      />
    </div>
  );
};
