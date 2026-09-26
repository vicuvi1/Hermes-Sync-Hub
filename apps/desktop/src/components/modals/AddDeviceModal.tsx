import React, { useState, useEffect } from 'react';
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
  PlusCircle,
  Server,
  RefreshCw,
  Clock,
  Radio,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Device,
  PairingInvitation,
  PairingValidationResult,
  PairingProgressStep,
  PairingStepId,
} from '@hermes-hub/types';

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
  const [mode, setMode] = useState<'generate' | 'join' | 'manual'>('generate');

  // Initiator Invitation State
  const [invitation, setInvitation] = useState<PairingInvitation | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Joiner Input & Validation State
  const [joinInput, setJoinInput] = useState('');
  const [validationResult, setValidationResult] = useState<PairingValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Pairing Execution Progress State
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSteps, setPairingSteps] = useState<PairingProgressStep[]>([]);
  const [pairedDeviceResult, setPairedDeviceResult] = useState<Device | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Manual Form State
  const [manualName, setManualName] = useState('');
  const [manualHostname, setManualHostname] = useState('');
  const [manualOs, setManualOs] = useState<'windows' | 'linux' | 'macos'>('linux');
  const [manualIp, setManualIp] = useState('');
  const [manualHermesHome, setManualHermesHome] = useState('');

  // Generate / Load invitation on open
  useEffect(() => {
    if (!isOpen) return;

    async function loadOrGenerateInvitation() {
      setIsGenerating(true);
      if (window.hermesHub?.generatePairingInvitation) {
        try {
          const inv = await window.hermesHub.generatePairingInvitation();
          if (inv) {
            setInvitation(inv);
            setTimeLeft(15 * 60);
          }
        } catch (err) {
          console.warn('Failed to generate invitation over IPC:', err);
        }
      }

      // Fallback generator if IPC not connected
      if (!invitation) {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let p1 = '';
        let p2 = '';
        for (let i = 0; i < 4; i++) {
          p1 += chars[Math.floor(Math.random() * chars.length)];
          p2 += chars[Math.floor(Math.random() * chars.length)];
        }
        const fallbackCode = `HERMES-${p1}-${p2}`;
        const now = new Date();
        const fallbackInv: PairingInvitation = {
          invitationId: `inv-${Date.now().toString(36)}`,
          code: fallbackCode,
          encodedPayload: btoa(
            JSON.stringify({
              code: fallbackCode,
              issuer: {
                deviceId: 'dev-local-primary',
                deviceName: 'Primary Machine',
                hostname: 'DESKTOP-HUB',
                os: 'windows',
                tailscaleIp: '100.84.12.10',
                syncthingId: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
                agentPort: 48199,
              },
              expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
            })
          ),
          issuer: {
            deviceId: 'dev-local-primary',
            deviceName: 'Primary Machine',
            hostname: 'DESKTOP-HUB',
            os: 'windows',
            tailscaleIp: '100.84.12.10',
            syncthingId: 'SYNCTH-VCTR-ZNBK-3819-B21C-P8QN-74KJ-M2WP',
            agentPort: 48199,
          },
          token: 'crypto-ephemeral-token',
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        };
        setInvitation(fallbackInv);
        setTimeLeft(15 * 60);
      }
      setIsGenerating(false);
    }

    loadOrGenerateInvitation();
  }, [isOpen]);

  // Expiration countdown
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  // Debounced input validation
  useEffect(() => {
    const trimmed = joinInput.trim();
    if (!trimmed) {
      setValidationResult(null);
      setPairingError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      setPairingError(null);

      if (window.hermesHub?.validatePairingCode) {
        try {
          const res = await window.hermesHub.validatePairingCode(trimmed);
          setValidationResult(res);
          setIsValidating(false);
          return;
        } catch (err: any) {
          console.warn('IPC validation error:', err);
        }
      }

      setValidationResult({ valid: false, error: 'Pairing validation is unavailable because the secure desktop bridge is not connected.' });
      setIsValidating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [joinInput]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!invitation?.code) return;
    navigator.clipboard.writeText(invitation.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPayload = () => {
    if (!invitation?.encodedPayload) return;
    navigator.clipboard.writeText(invitation.encodedPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    if (window.hermesHub?.generatePairingInvitation) {
      try {
        const inv = await window.hermesHub.generatePairingInvitation();
        setInvitation(inv);
        setTimeLeft(15 * 60);
      } catch (err) {
        console.warn('Error regenerating invitation:', err);
      }
    }
    setIsGenerating(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Execute Step-by-Step Pairing
  const handleStartPairing = async () => {
    if (!validationResult?.valid || !validationResult.invitation) return;

    setIsPairing(true);
    setPairingError(null);

    const stepDefs: { id: PairingStepId; label: string }[] = [
      { id: 'validate_token', label: 'Verifying pairing invitation & authentication token' },
      { id: 'detect_hermes', label: 'Detecting local Hermes runtime & state databases' },
      { id: 'syncthing_link', label: 'Linking Syncthing cluster & introducing HermesHubData folder' },
      { id: 'tailscale_verify', label: 'Testing Tailscale WireGuard tunnel & pinging peer' },
      { id: 'registry_enroll', label: 'Enrolling mutual identities in persistent cluster registry' },
      { id: 'initial_sync', label: 'Performing initial metadata & manifest synchronization' },
    ];

    // Initialize all steps as pending
    setPairingSteps(
      stepDefs.map((def, idx) => ({
        stepId: def.id,
        label: def.label,
        status: idx === 0 ? 'in-progress' : 'pending',
        timestamp: new Date().toISOString(),
      }))
    );

    // Call real IPC pairing if available
    if (window.hermesHub?.executePairing) {
      try {
        const result = await window.hermesHub.executePairing({
          codeOrPayload: joinInput.trim(),
        });
        if (result && result.success) {
          setPairingSteps(result.steps || []);
          setPairedDeviceResult(result.pairedDevice);
          setIsPairing(false);
          return;
        }
      } catch (err: any) {
        setPairingError(err?.message || 'Pairing failed.');
      }
    }

    setPairingError('Pairing did not complete. Review Tailscale, Syncthing, and the invitation, then retry.');
    setIsPairing(false);
  };

  const handleFinishPairing = () => {
    if (pairedDeviceResult) {
      onDeviceAdded(pairedDeviceResult);
      onClose();
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const host = manualHostname.trim() || manualName.toUpperCase().replace(/\s+/g, '-');
    const newDevice: Device = {
      deviceId: `dev-man-${Date.now().toString(36)}`,
      deviceName: manualName.trim(),
      hostname: host,
      os: manualOs,
      architecture: manualOs === 'macos' ? 'arm64' : 'x64',
      appVersion: 'unknown',
      agentVersion: 'unknown',
      online: false,
      lastSeen: new Date().toISOString(),
      tailscale: {
        installed: false,
        connected: false,
        ip: manualIp.trim() || undefined,
        connectionType: 'unknown',
        peersCount: 0,
      },
      syncthing: {
        installed: false,
        running: false,
        foldersCount: 0,
      },
      hermes: {
        installed: false,
        running: false,
        version: 'unknown',
        home: manualHermesHome.trim(),
        profile: 'default',
      },
      data: {
        sessions: 0,
        memories: 0,
        skills: 0,
        totalSizeBytes: 0,
      },
      sync: {
        lastSync: new Date().toISOString(),
        pendingFiles: 0,
        filesTransferred: 0,
        bytesUploaded: 0,
        bytesDownloaded: 0,
        conflicts: 0,
        status: 'offline',
      },
      lastBackup: '',
      healthStatus: 'offline',
    };

    onDeviceAdded(newDevice);
    onClose();
  };

  const isPairingDone = !!pairedDeviceResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Add Device & Mesh Pairing</h3>
              <p className="text-xs text-muted-foreground">
                Pair your workstations and laptops securely into the P2P Hermes Hub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setMode('generate');
                setIsPairing(false);
                setPairedDeviceResult(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'generate'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Radio className="h-3.5 w-3.5 text-primary" />
              <span>Pairing Code</span>
            </button>
            <button
              onClick={() => {
                setMode('join');
                setIsPairing(false);
                setPairedDeviceResult(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'join'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Join Mesh</span>
            </button>
            <button
              onClick={() => {
                setMode('manual');
                setIsPairing(false);
                setPairedDeviceResult(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'manual'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Server className="h-3.5 w-3.5 text-indigo-500" />
              <span>Manual IP</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: GENERATE / INITIATOR */}
          {mode === 'generate' && (
            <div className="space-y-6">
              {/* QR Code and Code Box Container */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-muted/20 border border-border">
                {/* Visual SVG QR representation */}
                <div className="relative group shrink-0 w-36 h-36 rounded-xl border border-border bg-white p-2.5 flex flex-col items-center justify-center shadow-sm">
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
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none" />
                </div>

                {/* Pairing Code + Details */}
                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                      <span>ONE-TIME PAIRING CODE</span>
                      <span className="flex items-center gap-1 font-mono text-amber-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimer(timeLeft)}</span>
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border font-mono text-base font-bold tracking-widest text-foreground select-all text-center">
                        {invitation?.code || 'GENERATING...'}
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title="Copy pairing code"
                      >
                        {copiedCode ? (
                          <Check className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleCopyPayload}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Token Copied!</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-3.5 w-3.5 text-primary" />
                          <span>Copy Raw Token (Base64)</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      className="py-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      title="Regenerate code"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Host Broadcasting Beacon Status */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-semibold text-foreground">Initiator Mesh Beacon Active</span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Agent Port: {invitation?.issuer.agentPort || 48199}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
                  <div>
                    Host: <span className="text-foreground">{invitation?.issuer.hostname}</span>
                  </div>
                  <div>
                    Tailscale IP: <span className="text-foreground">{invitation?.issuer.tailscaleIp || '100.84.12.10'}</span>
                  </div>
                </div>
              </div>

              {/* Steps instructions */}
              <div className="p-4 rounded-xl bg-card border border-border text-xs text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground text-sm">How to pair your other machine:</div>
                <div className="space-y-1.5">
                  <p>1. Open Hermes Hub on the other computer.</p>
                  <p>2. Click <span className="font-semibold text-foreground">"+ Add New Device"</span> and switch to the <span className="font-semibold text-emerald-500">"Join Mesh"</span> tab.</p>
                  <p>3. Enter the pairing code above or paste the raw Base64 token.</p>
                  <p>4. Syncthing folders and Tailscale encryption will negotiate automatically.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JOIN / JOINER */}
          {mode === 'join' && (
            <div className="space-y-5">
              {!isPairing && !isPairingDone ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Pairing Code or Encrypted Token
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. HERMES-84Q2-KM7D or eyJ2ZXJzaW9uIjox..."
                        value={joinInput}
                        onChange={(e) => setJoinInput(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border font-mono text-sm tracking-wide text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {isValidating && (
                        <Loader2 className="h-4 w-4 animate-spin absolute right-3.5 top-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Validation Preview Card */}
                  {validationResult?.valid && validationResult.invitation && (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                            Verified Mesh Node Found
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                          Ready to Pair
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-card border border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase">Target Node</div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {validationResult.invitation.issuer.deviceName}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase">Hostname & OS</div>
                          <div className="font-semibold text-foreground font-mono mt-0.5 uppercase">
                            {validationResult.invitation.issuer.hostname} ({validationResult.invitation.issuer.os})
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase">Tailscale IP</div>
                          <div className="font-mono text-foreground mt-0.5">
                            {validationResult.invitation.issuer.tailscaleIp || '100.84.12.20'}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase">Syncthing ID</div>
                          <div className="font-mono text-foreground mt-0.5 truncate max-w-[160px]">
                            {validationResult.invitation.issuer.syncthingId || 'SYNCTH-HUB-CORE'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation Error */}
                  {validationResult && !validationResult.valid && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{validationResult.error}</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hermes Hub will automatically inspect your local Hermes agent installation, register this device to the Syncthing cluster, and configure encrypted workspace sync over your Tailscale mesh.
                  </p>

                  <button
                    onClick={handleStartPairing}
                    disabled={!validationResult?.valid}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>Authenticate & Pair Mesh</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : isPairing ? (
                /* Step by Step Progress Pipeline */
                <div className="space-y-4 py-2">
                  <div className="text-center">
                    <h4 className="font-bold text-foreground text-base">
                      {validationResult?.invitation?.issuer.deviceName || 'Pairing Device'}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Executing automated peer negotiation & mutual registry enrollment...
                    </p>
                  </div>

                  <div className="space-y-2.5 p-4 rounded-xl bg-muted/30 border border-border text-xs">
                    {pairingSteps.map((step) => (
                      <div
                        key={step.stepId}
                        className="flex items-center justify-between py-1 border-b border-border/30 last:border-none"
                      >
                        <span className="flex items-center gap-2.5">
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : step.status === 'in-progress' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-border shrink-0" />
                          )}
                          <span
                            className={
                              step.status === 'completed'
                                ? 'text-foreground font-medium'
                                : step.status === 'in-progress'
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground'
                            }
                          >
                            {step.label}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {step.status === 'completed'
                            ? '✓'
                            : step.status === 'in-progress'
                            ? '...'
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Success Screen */
                <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-foreground">Device Successfully Paired!</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      <span className="font-semibold text-foreground">{pairedDeviceResult?.deviceName}</span> has
                      been enrolled into your Hermes Hub cluster with active Tailscale WireGuard and Syncthing peer configuration.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs font-mono grid grid-cols-2 gap-2 text-left max-w-md mx-auto">
                    <div>
                      Device ID: <span className="text-foreground">{pairedDeviceResult?.deviceId}</span>
                    </div>
                    <div>
                      IP: <span className="text-foreground">{pairedDeviceResult?.tailscale.ip}</span>
                    </div>
                    <div>
                      Hermes: <span className="text-foreground">v{pairedDeviceResult?.hermes.version}</span>
                    </div>
                    <div>
                      Status: <span className="text-emerald-500 font-semibold">● In-Sync</span>
                    </div>
                  </div>

                  <button
                    onClick={handleFinishPairing}
                    className="w-full max-w-md mx-auto py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Check className="h-4 w-4" />
                    <span>Done & View in Hub</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL REGISTRATION */}
          {mode === 'manual' && (
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g. Office Mac Studio"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Hostname</label>
                  <input
                    type="text"
                    placeholder="e.g. STUDIO-M2-ULTRA"
                    value={manualHostname}
                    onChange={(e) => setManualHostname(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Operating System</label>
                  <select
                    value={manualOs}
                    onChange={(e) => setManualOs(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="windows">Windows</option>
                    <option value="linux">Linux</option>
                    <option value="macos">macOS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Tailscale IP (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 100.84.12.55"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Hermes Home Path (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. /home/user/.hermes or C:\Users\User\AppData\Local\hermes"
                  value={manualHermesHome}
                  onChange={(e) => setManualHermesHome(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Register Cluster Node</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
