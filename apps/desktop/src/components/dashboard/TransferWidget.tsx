import React from 'react';
import { ActiveTransfer } from '@hermes-hub/types';
import { formatBytes, formatTransferSpeed } from '@hermes-hub/shared';
import { ArrowRight, Zap, FolderSync } from 'lucide-react';

interface TransferWidgetProps {
  transfer: ActiveTransfer | null;
}

export const TransferWidget: React.FC<TransferWidgetProps> = ({ transfer }) => {
  if (!transfer) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 backdrop-blur-sm shadow-xs relative overflow-hidden">
      {/* Background subtle animated pulse */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <Zap className="h-4 w-4 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{transfer.sourceDevice}</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              <span>{transfer.targetDevice}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {transfer.filesRemaining} files remaining • {formatTransferSpeed(transfer.speedBytesPerSec)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold font-mono text-primary">
            {transfer.progressPercentage}%
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {formatBytes(transfer.bytesCurrent)} / {formatBytes(transfer.bytesTotal)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-primary/10 rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${transfer.progressPercentage}%` }}
        />
      </div>
    </div>
  );
};
