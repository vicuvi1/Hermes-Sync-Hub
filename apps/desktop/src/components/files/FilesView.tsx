import React, { useState, useEffect } from 'react';
import {
  HermesFile,
  HermesFileCategory,
  WorkspaceStatus,
  ClusterManifest,
  ManifestVerificationResult,
  SafeSnapshotRecord,
  ConflictItem,
} from '@hermes-hub/types';
import { formatBytes, formatTimeAgo } from '@hermes-hub/shared';
import {
  FolderSync,
  Search,
  Copy,
  Check,
  FileCode,
  FileText,
  FileSpreadsheet,
  Terminal,
  Laptop,
  CheckCircle2,
  FolderLock,
  ShieldCheck,
  RefreshCw,
  Camera,
  Layers,
  Database,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface FilesViewProps {
  files: HermesFile[];
  initialSelectedFileId?: string;
}

const CATEGORIES: (HermesFileCategory | 'All')[] = [
  'All',
  'Configuration',
  'Memories',
  'Skills',
  'Sessions/Exports',
  'Logs',
];

export const FilesView: React.FC<FilesViewProps> = ({ files, initialSelectedFileId }) => {
  const [selectedCategory, setSelectedCategory] = useState<HermesFileCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Milestone 8 Workspace & Snapshots State
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ManifestVerificationResult | null>(null);
  const [isGeneratingManifest, setIsGeneratingManifest] = useState(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [snapshots, setSnapshots] = useState<SafeSnapshotRecord[]>([]);
  const [showSnapshotsSection, setShowSnapshotsSection] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [resolvingConflict, setResolvingConflict] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspaceData() {
      if (window.hermesHub?.getWorkspaceStatus) {
        try {
          const status = await window.hermesHub.getWorkspaceStatus();
          if (status) setWorkspaceStatus(status);
        } catch (err) {
          console.warn('Failed to load workspace status:', err);
        }
      }

      if (window.hermesHub?.getSnapshots) {
        try {
          const snaps = await window.hermesHub.getSnapshots();
          if (snaps) setSnapshots(snaps);
        } catch (err) {
          console.warn('Failed to load snapshots:', err);
        }
      }
    }

    loadWorkspaceData();
    window.hermesHub?.getSyncConflicts?.().then(setConflicts).catch(() => undefined);
  }, []);
  useEffect(() => { const requested = files.find((file) => file.id === initialSelectedFileId); if (requested) setSearch(requested.name); }, [initialSelectedFileId, files]);

  const resolveConflict = async (conflict: ConflictItem, resolution: 'use_local' | 'use_remote' | 'keep_both') => {
    if (!window.hermesHub?.resolveSyncConflict) { setBannerMessage('Conflict resolution is unavailable because the secure desktop bridge is not connected.'); return; }
    setResolvingConflict(conflict.id);
    try {
      const result = await window.hermesHub.resolveSyncConflict(conflict.id, resolution);
      setBannerMessage(result.message);
      setConflicts(await window.hermesHub.getSyncConflicts());
    } catch (error: any) { setBannerMessage(`Conflict resolution failed: ${error?.message || 'Unknown error'}`); }
    finally { setResolvingConflict(null); }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    if (window.hermesHub?.verifyManifest) {
      try {
        const res = await window.hermesHub.verifyManifest();
        setVerificationResult(res);
        setBannerMessage(`Workspace integrity verified: ${res.matchingCount}/${res.totalChecked} files verified matching SHA-256 digests ✓`);
        setIsVerifying(false);
        return;
      } catch (err) {
        console.warn('IPC verification failed:', err);
      }
    }

    setBannerMessage('Integrity verification is unavailable because the secure desktop bridge is not connected.');
    setIsVerifying(false);
  };

  const handleGenerateManifest = async () => {
    setIsGeneratingManifest(true);
    if (window.hermesHub?.generateManifest) {
      try {
        const man = await window.hermesHub.generateManifest();
        if (window.hermesHub.getWorkspaceStatus) {
          const status = await window.hermesHub.getWorkspaceStatus();
          setWorkspaceStatus(status);
        }
        setBannerMessage(`Manifest revision #${man.revision} generated with ${man.files.length} indexed files ✓`);
      } catch (err: any) {
        setBannerMessage(`Failed to generate manifest: ${err.message}`);
      }
    } else setBannerMessage('Manifest generation is unavailable because the secure desktop bridge is not connected.');
    setIsGeneratingManifest(false);
  };

  const handleCreateSnapshot = async () => {
    setIsTakingSnapshot(true);
    if (window.hermesHub?.createSafeSnapshot) {
      try {
        const snap = await window.hermesHub.createSafeSnapshot({
          name: `Manual Safe Snapshot ${new Date().toLocaleTimeString()}`,
        });
        setSnapshots([snap, ...snapshots]);
        if (window.hermesHub.getWorkspaceStatus) {
          const status = await window.hermesHub.getWorkspaceStatus();
          setWorkspaceStatus(status);
        }
        setBannerMessage(`Safe non-destructive snapshot created (${snap.name}) [${snap.sha256.slice(0, 15)}...] ✓`);
      } catch (err: any) {
        setBannerMessage(`Failed to create snapshot: ${err.message}`);
      }
    } else setBannerMessage('Snapshot creation is unavailable because the secure desktop bridge is not connected.');
    setIsTakingSnapshot(false);
  };

  const filteredFiles = files.filter((f) => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.path.toLowerCase().includes(search.toLowerCase()) ||
      f.sha256.includes(search);
    return matchesCategory && matchesSearch;
  });

  const handleCopyPath = (file: HermesFile) => {
    navigator.clipboard.writeText(file.path);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const rootDisplay = workspaceStatus?.rootPath || 'HermesHubData';
  const manifestRev = workspaceStatus?.activeManifestRevision || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Workspace Management Header Card */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <FolderSync className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Hermes Hub Managed Workspace</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-semibold">
                  Manifest Rev #{manifestRev}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                {rootDisplay}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck className={`h-4 w-4 text-emerald-500 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>Verify Integrity</span>
            </button>

            <button
              onClick={handleGenerateManifest}
              disabled={isGeneratingManifest}
              className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`h-4 w-4 text-primary ${isGeneratingManifest ? 'animate-spin' : ''}`} />
              <span>Rebuild Manifest</span>
            </button>

            <button
              onClick={handleCreateSnapshot}
              disabled={isTakingSnapshot}
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Camera className={`h-4 w-4 ${isTakingSnapshot ? 'animate-spin' : ''}`} />
              <span>Create Safe Snapshot</span>
            </button>
          </div>
        </div>

        {/* Directory Layout Chips */}
        <div className="pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">manifests/</span>
            <span className="font-semibold text-foreground">index.json</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">snapshots/</span>
            <span className="font-semibold text-foreground">{snapshots.length} safe states</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">devices/</span>
            <span className="font-semibold text-foreground">cluster nodes</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">memories/</span>
            <span className="font-semibold text-foreground">MEMORY.md</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">skills/</span>
            <span className="font-semibold text-foreground">modular packages</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">configs/</span>
            <span className="font-semibold text-foreground">sanitized YAML</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">backups/</span>
            <span className="font-semibold text-foreground">archives (.tar.gz)</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
            <span className="text-muted-foreground block text-[10px] uppercase">activity/</span>
            <span className="font-semibold text-foreground">device-events.log</span>
          </div>
        </div>
      </div>

      {/* Banner Toast Notification */}
      {bannerMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-500 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-emerald-500 hover:text-emerald-400 p-1"
          >
            ×
          </button>
        </div>
      )}

      {conflicts.length > 0 && <section className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
        <div><h3 className="font-bold text-foreground">Conflict Center</h3><p className="mt-1 text-xs text-muted-foreground">Both versions stay preserved. Every resolution creates a local recovery copy before changing either file.</p></div>
        {conflicts.map((conflict) => <div key={conflict.id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold">{conflict.filePath}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-rose-500">{conflict.state || 'both-changed'} · detected {formatTimeAgo(conflict.detectedAt)}</div></div></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase text-muted-foreground">Local · {conflict.leftVersion.deviceName}</div><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">{conflict.leftVersion.snippet || '(empty or deleted)'}</pre><div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{conflict.leftVersion.hash}</div></div><div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase text-muted-foreground">Remote · {conflict.rightVersion.deviceName}</div><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">{conflict.rightVersion.snippet || '(empty or deleted)'}</pre><div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{conflict.rightVersion.hash}</div></div></div>
          <div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={resolvingConflict === conflict.id} onClick={() => resolveConflict(conflict, 'use_local')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">Keep local</button><button disabled={resolvingConflict === conflict.id} onClick={() => resolveConflict(conflict, 'use_remote')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">Keep remote</button><button disabled={resolvingConflict === conflict.id} onClick={() => resolveConflict(conflict, 'keep_both')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Keep both</button></div>
        </div>)}
      </section>}

      {/* Safe Snapshots Toggle & Panel */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowSnapshotsSection(!showSnapshotsSection)}
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <Database className="h-4 w-4 text-primary" />
          <span>Safe State Snapshots ({snapshots.length})</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            [{showSnapshotsSection ? 'Hide' : 'Show'}]
          </span>
        </button>
      </div>

      {showSnapshotsSection && (
        <div className="p-4 rounded-2xl border border-border bg-card/60 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Anti-corruption engine: Active SQLite WAL files are isolated from direct file-level sync.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-3.5 rounded-xl bg-background border border-border/70 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-foreground">{snap.name}</div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      snap.isClean
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}
                  >
                    {snap.isClean ? 'Clean Lock State' : 'Live Snapshot'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  SHA: {snap.sha256}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>{snap.recordCounts.sessions} sessions • {snap.recordCounts.memories} memories</span>
                  <span>{formatTimeAgo(snap.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files or hashes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-card border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Files Table */}
      <div className="rounded-2xl border border-border bg-card/70 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">File Name & Path</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">SHA-256 Digest</th>
                <th className="py-3 px-4">Origin & Rev</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{file.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-xs mt-0.5">
                      {file.path}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-medium text-foreground">
                      {file.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {formatBytes(file.size)}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    <span className="truncate max-w-[120px] block" title={file.sha256}>
                      {file.sha256.slice(0, 16)}...
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    <div>Rev #{file.revision}</div>
                    <div className="text-[10px] text-muted-foreground/80">{file.originDeviceName}</div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {formatTimeAgo(file.modifiedAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleCopyPath(file)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy path"
                    >
                      {copiedId === file.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
