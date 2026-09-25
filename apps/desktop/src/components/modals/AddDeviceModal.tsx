import React, { useState } from 'react';
import {
  X,
  QrCode,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Laptop,
  Layers,
  Wifi,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Device } from '@hermes-hub/types';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: (device: Device) => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onDeviceAdded,
}) => {
  const [mode, setMode] = useState<'generate' | 'join'>('generate');
  const [pairingCode] = useState('HERMES-84Q2-KM7D');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSteps, setPairingSteps] = useState<{
    deviceAdded: boolean;
    hermesDetected: boolean;
    syncthingConnected: boolean;
    tailscaleConnected: boolean;
    synchronizing: boolean;
  }>({
    deviceAdded: false,
    hermesDetected: false,
    syncthingConnected: false,
    tailscaleConnected: false,
    synchronizing: false,
  });

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartJoin = () => {
    if (!joinCodeInput.trim()) return;
    setIsPairing(true);

    setTimeout(() => {
      setPairingSteps((prev) => ({ ...prev, deviceAdded: true }));
    }, 600);

    setTimeout(() => {
      setPairingSteps((prev) => ({ ...prev, hermesDetected: true }));
    }, 1200);

    setTimeout(() => {
      setPairingSteps((prev) => ({ ...prev, syncthingConnected: true }));
    }, 1800);

    setTimeout(() => {
      setPairingSteps((prev) => ({ ...prev, tailscaleConnected: true }));
    }, 2400);

    setTimeout(() => {
      setPairingSteps((prev) => ({ ...prev, synchronizing: true }));
      setIsPairing(false);
    }, 3000);
  };

  const isCompleted = pairingSteps.synchronizing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Add New Device</h3>
              <p className="text-xs text-muted-foreground">Pair your computers into the P2P mesh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setMode('generate');
                setIsPairing(false);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'generate'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Generate Pairing Code
            </button>
            <button
              onClick={() => {
                setMode('join');
                setIsPairing(false);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'join'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Join Existing Hub
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {mode === 'generate' ? (
            <div className="space-y-6 text-center">
              {/* QR Code Placeholder Representation */}
              <div className="mx-auto w-44 h-44 rounded-2xl border border-border bg-white p-3 flex flex-col items-center justify-center shadow-inner">
                {/* Visual SVG QR representation */}
                <svg
                  className="w-full h-full text-zinc-900"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                  <line x1="18" y1="7" x2="18.01" y2="7"></line>
                  <line x1="7" y1="18" x2="7.01" y2="18"></line>
                  <line x1="18" y1="18" x2="18.01" y2="18"></line>
                  <path d="M10 7h4v2h-4z"></path>
                  <path d="M7 10v4h2v-4z"></path>
                  <path d="M10 14h4v2h-4z"></path>
                </svg>
              </div>

              {/* Pairing Code Box */}
              <div>
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">
                  One-Time Device Pairing Code
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="px-4 py-2.5 rounded-xl bg-muted/60 border border-border font-mono text-lg font-bold tracking-widest text-foreground select-all">
                    {pairingCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground text-left space-y-1">
                <div className="font-semibold text-foreground">Next steps on the target machine:</div>
                <p>1. Open Hermes Hub on the other computer.</p>
                <p>2. Select "Join Existing Hub".</p>
                <p>3. Enter the pairing code above or scan the QR code.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {!isPairing && !isCompleted ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Enter Pairing Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HERMES-84Q2-KM7D"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2.5 rounded-xl bg-background border border-border font-mono text-sm tracking-wider uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hermes Hub will automatically discover your local Hermes agent installation, register this device to the Syncthing cluster, and configure encrypted workspace sync over your Tailscale mesh.
                  </p>

                  <button
                    onClick={handleStartJoin}
                    disabled={!joinCodeInput.trim()}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>Connect & Configure Mesh</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                /* Animated Pairing Progress */
                <div className="space-y-4">
                  <div className="text-center pb-2">
                    <h4 className="font-bold text-foreground text-base">Victor Zenbook</h4>
                    <p className="text-xs text-muted-foreground">Pairing and establishing mesh connections...</p>
                  </div>

                  <div className="space-y-2.5 p-4 rounded-xl bg-muted/40 border border-border/50 text-xs font-medium">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {pairingSteps.deviceAdded ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        <span>Device added</span>
                      </span>
                      <span className="text-muted-foreground">
                        {pairingSteps.deviceAdded ? '✓' : '...'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {pairingSteps.hermesDetected ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-border" />
                        )}
                        <span>Hermes detected</span>
                      </span>
                      <span className="text-muted-foreground">
                        {pairingSteps.hermesDetected ? '✓' : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {pairingSteps.syncthingConnected ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-border" />
                        )}
                        <span>Syncthing connected</span>
                      </span>
                      <span className="text-muted-foreground">
                        {pairingSteps.syncthingConnected ? '✓' : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {pairingSteps.tailscaleConnected ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-border" />
                        )}
                        <span>Tailscale connected</span>
                      </span>
                      <span className="text-muted-foreground">
                        {pairingSteps.tailscaleConnected ? '✓' : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 font-semibold text-primary">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-spin" />
                        <span>Synchronizing...</span>
                      </span>
                      <span>Active</span>
                    </div>
                  </div>

                  {isCompleted && (
                    <button
                      onClick={onClose}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      <span>Done</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
