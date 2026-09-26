import React, { useState, useEffect } from 'react';
import { BackupRecord, BackupVerificationResult, FileRevision, RecoveryArtifact } from '@hermes-hub/types';
import { formatBytes, formatTimeAgo } from '@hermes-hub/shared';
import {
  Archive,
  CheckCircle2,
  Clock,
  RotateCcw,
  Cloud,
  Download,
  AlertTriangle,
  Play,
  ShieldCheck,
  Trash2,
  History,
  FileText,
  RefreshCw,
  Check,
  ChevronRight,
  Sliders,
  Laptop,
  Upload,
} from 'lucide-react';

interface BackupsViewProps {
  backups: BackupRecord[];
  onCreateBackup: () => void;
  onRefresh?: () => void;
  initialSection?: 'archives' | 'revisions' | 'recovery';
}

export const BackupsView: React.FC<BackupsViewProps> = ({
  backups: initialBackups,
  onCreateBackup,
  onRefresh,
  initialSection,
}) => {
  const [backups, setBackups] = useState<BackupRecord[]>(initialBackups);
  const [autoBackupsEnabled, setAutoBackupsEnabled] = useState(true);
  const [schedule, setSchedule] = useState<'daily' | 'weekly'>('daily');
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, BackupVerificationResult>>({});
  const [activeTab, setActiveTab] = useState<'archives' | 'revisions' | 'recovery'>('archives');
  const [recoveryArtifacts, setRecoveryArtifacts] = useState<RecoveryArtifact[]>([]);
  const [recoveryConfirmId, setRecoveryConfirmId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<FileRevision[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [selectedRevisionFile, setSelectedRevisionFile] = useState<string>('memories/MEMORY.md');
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setBackups(initialBackups);
    window.hermesHub?.getRecoveryArtifacts?.().then(setRecoveryArtifacts).catch(() => undefined);
    window.hermesHub?.getAppSettings?.().then((settings) => { setAutoBackupsEnabled(settings.autoBackupEnabled); setSchedule(settings.autoBackupFrequency); }).catch(() => undefined);
  }, [initialBackups]);
  useEffect(() => { if (initialSection) setActiveTab(initialSection); }, [initialSection]);

  // Load revisions on mount and when tab changes
  useEffect(() => {
    async function loadRevisions() {
      if (activeTab === 'revisions' && window.hermesHub?.getFileRevisions) {
        setIsLoadingRevisions(true);
        try {
          const res = await window.hermesHub.getFileRevisions(selectedRevisionFile);
          if (res && res.revisions) {
            setRevisions(res.revisions);
          } else if (Array.isArray(res)) {
            setRevisions(res);
          }
        } catch (err) {
          console.warn('Failed to load file revisions:', err);
        } finally {
          setIsLoadingRevisions(false);
        }
      }
    }
    loadRevisions();
  }, [activeTab, selectedRevisionFile]);

  const handleVerify = async (backupId: string) => {
    setVerifyingId(backupId);
    try {
      if (window.hermesHub?.verifyBackup) {
        const result = await window.hermesHub.verifyBackup(backupId);
        setVerificationResults((prev) => ({ ...prev, [backupId]: result }));
      } else setRestoreMessage('Verification is unavailable because the secure desktop bridge is not connected.');
    } catch (err) {
      console.warn('Verification failed:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmRestore = async (backupId: string) => {
    setIsRestoring(true);
    setRestoreMessage(null);
    try {
      if (window.hermesHub?.restoreBackup) {
        const result = await window.hermesHub.restoreBackup({ backupId });
        if (result.success) {
          setRestoreMessage(
            `Restored ${result.restoredFilesCount} files successfully! Safety rollback snapshot captured: #${result.safetyRollbackSnapshotId?.slice(-6) || 'auto'}.`
          );
        } else {
          setRestoreMessage(`Restore blocked: ${result.error}`);
        }
      } else setRestoreMessage('Restore is unavailable because the secure desktop bridge is not connected.');
    } catch (err: any) {
      setRestoreMessage(`Failed to restore: ${err.message}`);
    } finally {
      setIsRestoring(false);
      setRestoreConfirmId(null);
      if (onRefresh) onRefresh();
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      if (window.hermesHub?.deleteBackup) {
        await window.hermesHub.deleteBackup(backupId);
        setBackups((prev) => prev.filter((b) => b.id !== backupId));
      } else setRestoreMessage('Deletion is unavailable because the secure desktop bridge is not connected.');
    } catch (err) {
      console.warn('Failed to delete backup:', err);
    }
  };

  const handleRollbackRevision = async (targetRev: number) => {
    try {
      if (window.hermesHub?.rollbackRevision) {
        const res = await window.hermesHub.rollbackRevision(selectedRevisionFile, targetRev);
        setRollbackMessage(res.message);
        // Refresh revisions
        const updated = await window.hermesHub.getFileRevisions(selectedRevisionFile);
        if (updated?.revisions) setRevisions(updated.revisions);
      } else setRollbackMessage('Rollback is unavailable because the secure desktop bridge is not connected.');
    } catch (err: any) {
      setRollbackMessage(`Rollback failed: ${err.message}`);
    }
  };

  const restoreRecovery = async (id: string) => {
    setIsRestoring(true);
    try {
      const result = await window.hermesHub?.restoreRecoveryArtifact(id, true);
      setRestoreMessage(result?.message || 'Recovery restore did not return a result.');
      setRecoveryArtifacts(await window.hermesHub!.getRecoveryArtifacts());
    } catch (error: any) { setRestoreMessage(`Recovery restore failed: ${error?.message || 'Unknown error'}`); }
    finally { setIsRestoring(false); setRecoveryConfirmId(null); }
  };
  const updateBackupPreference = async (enabled: boolean, frequency: 'daily' | 'weekly' = schedule) => {
    setAutoBackupsEnabled(enabled); setSchedule(frequency);
    await window.hermesHub?.updateAppSettings({ autoBackupEnabled: enabled, autoBackupFrequency: frequency });
  };
  const createMigrationBundle = async () => {
    try {
      const result = await window.hermesHub?.createMigrationBundle();
      setRestoreMessage(result?.message || 'Migration export did not return a result.');
      if (result?.success && result.filePath) await window.hermesHub?.openFolder(result.filePath);
    } catch (error) { setRestoreMessage(error instanceof Error ? error.message : 'Migration export failed.'); }
  };
  const importMigrationBundle = async () => {
    if (!window.confirm('Import a migration bundle? Hermes Hub will create a rollback backup before copying its settings and safe workspace files.')) return;
    try {
      const result = await window.hermesHub?.importMigrationBundle(true);
      setRestoreMessage(result?.message || 'Migration import did not return a result.');
    } catch (error) { setRestoreMessage(error instanceof Error ? error.message : 'Migration import failed.'); }
  };

  const latestBackup = backups[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Hero Status */}
      <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 shrink-0">
            <Archive className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">Local Snapshot Backups & Revisions</h3>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                <span>Anti-Corruption Verified</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
              Safe atomic snapshots and exported Hermes sessions, memories, and skills are packaged locally. Revisions track file changes deterministically.
            </p>
            {latestBackup && (
              <div className="mt-3 flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span>Last backup: <strong className="text-foreground">{formatTimeAgo(latestBackup.createdAt)}</strong></span>
                <span>•</span>
                <span>Size: <strong className="text-foreground">{formatBytes(latestBackup.sizeBytes)}</strong></span>
                <span>•</span>
                <span>Total Archives: <strong className="text-foreground">{backups.length}</strong></span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onCreateBackup}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Backup Now</span>
        </button>
      </div>

      {/* Global Notifications */}
      {restoreMessage && (
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center justify-between">
          <span>{restoreMessage}</span>
          <button onClick={() => setRestoreMessage(null)} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('archives')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'archives'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          <span>Snapshot Archives ({backups.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('revisions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'revisions'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Revision History & Rollback</span>
        </button>
        <button onClick={() => setActiveTab('recovery')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === 'recovery' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}>
          <ShieldCheck className="h-3.5 w-3.5" /><span>Recovery Center ({recoveryArtifacts.length})</span>
        </button>
      </div>

      {activeTab === 'recovery' && <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card/60 p-4"><h4 className="text-sm font-bold">Recovery Center</h4><p className="mt-1 text-xs text-muted-foreground">Browse baseline safety bundles, conflict copies, and quarantined workspace files. Only verified local recovery bundles can be restored automatically; other artifacts can be inspected from their folder.</p></div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><Laptop className="mt-0.5 h-5 w-5 text-primary" /><div><h4 className="text-sm font-bold">Move Hermes Hub to another PC</h4><p className="mt-1 max-w-3xl text-xs text-muted-foreground">Create one portable folder containing preferences, memories, skills, safe configuration, and the encrypted Shared Vault. Importing creates a rollback backup first. The Vault still requires its shared password.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void createMigrationBundle()} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Download className="h-4 w-4" />Create migration bundle</button><button onClick={() => void importMigrationBundle()} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"><Upload className="h-4 w-4" />Import migration bundle</button></div></div>
        {recoveryArtifacts.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">No recovery artifacts exist yet.</div> : recoveryArtifacts.map((artifact) => <div key={artifact.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="text-sm font-semibold">{artifact.name}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{artifact.kind}</span></div><p className="mt-1 text-xs text-muted-foreground">{artifact.description}</p><div className="mt-2 font-mono text-[10px] text-muted-foreground">{artifact.filesCount} files · {formatTimeAgo(artifact.createdAt)} · {artifact.filePath}</div></div><div className="flex gap-2"><button onClick={() => window.hermesHub?.openFolder(artifact.filePath)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Inspect folder</button>{artifact.restorable && <button onClick={() => setRecoveryConfirmId(artifact.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Restore verified files</button>}</div></div>)}
      </div>}

      {activeTab === 'archives' ? (
        <div className="space-y-6">
          {/* Backup Schedule Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Automatic Scheduled Backups</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Periodically snapshot all Hermes databases and configs
                </div>
              </div>
              <button
                onClick={() => void updateBackupPreference(!autoBackupsEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  autoBackupsEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoBackupsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Snapshot Frequency</div>
                <div className="text-xs text-muted-foreground mt-0.5">Frequency for automatic cycles</div>
              </div>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => void updateBackupPreference(autoBackupsEnabled, 'daily')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    schedule === 'daily'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => void updateBackupPreference(autoBackupsEnabled, 'weekly')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    schedule === 'weekly'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>
          </div>

          {/* Backup History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Snapshot Archives
            </h4>
            <div className="rounded-xl border border-border bg-card/70 overflow-hidden divide-y divide-border/40">
              {backups.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No backup archives found. Click "Backup Now" to create your first safe snapshot.
                </div>
              ) : (
                backups.map((b) => {
                  const verifyResult = verificationResults[b.id];
                  const isVerifying = verifyingId === b.id;

                  return (
                    <div
                      key={b.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold font-mono text-foreground text-sm">{b.name}</span>
                          {verifyResult?.valid && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-800/40">
                              <ShieldCheck className="h-3 w-3" /> SHA-256 Verified
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-[11px]">
                          <span>{formatBytes(b.sizeBytes)}</span>
                          <span>•</span>
                          <span>{b.itemCounts.sessions} sessions</span>
                          <span>•</span>
                          <span>{b.itemCounts.memories} memories</span>
                          <span>•</span>
                          <span>{b.itemCounts.skills} skills</span>
                          <span>•</span>
                          <span>{b.itemCounts.configs} configs</span>
                        </div>
                        {b.notes && (
                          <div className="text-[11px] text-muted-foreground/80 italic">{b.notes}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground mr-2 font-mono text-[11px]">
                          {formatTimeAgo(b.createdAt)}
                        </span>

                        <button
                          onClick={() => handleVerify(b.id)}
                          disabled={isVerifying}
                          title="Verify cryptographic integrity of archive files"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors font-medium text-xs disabled:opacity-50"
                        >
                          {isVerifying ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>Verify</span>
                        </button>

                        <button
                          onClick={() => setRestoreConfirmId(b.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors font-medium text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-primary" />
                          <span>Restore</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBackup(b.id)}
                          title="Delete Backup"
                          className="p-1.5 rounded-lg border border-border hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'revisions' ? (
        /* Revision History Sub-Tab */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60">
            <div>
              <h4 className="text-sm font-bold text-foreground">File Revision Audit Trail</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every modification to memories, skills, and configs records an immutable cryptographic revision blob.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Target File:</span>
              <select
                value={selectedRevisionFile}
                onChange={(e) => setSelectedRevisionFile(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-mono text-foreground focus:outline-none"
              >
                <option value="memories/MEMORY.md">memories/MEMORY.md</option>
                <option value="configs/config.template.yaml">configs/config.template.yaml</option>
                <option value="skills/hermes-core/SKILL.md">skills/hermes-core/SKILL.md</option>
              </select>
            </div>
          </div>

          {rollbackMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-300 flex items-center justify-between">
              <span>{rollbackMessage}</span>
              <button onClick={() => setRollbackMessage(null)} className="underline ml-2">
                Dismiss
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card/70 overflow-hidden divide-y divide-border/40">
            {isLoadingRevisions ? (
              <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading revision history...
              </div>
            ) : revisions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No historical revisions recorded yet for {selectedRevisionFile}. Revisions increment automatically on sync cycles.
              </div>
            ) : (
              revisions.map((rev) => (
                <div
                  key={rev.revision}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-xs border border-primary/20">
                        Rev #{rev.revision}
                      </span>
                      <span className="font-semibold text-xs text-foreground font-mono">{rev.filePath}</span>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-[11px]">
                      <span>Author: {rev.deviceName}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(rev.modifiedAt)}</span>
                      <span>•</span>
                      <span>{formatBytes(rev.sizeBytes)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">SHA: {rev.sha256.slice(0, 10)}...</span>
                    </div>
                    {rev.contentSnippet && (
                      <div className="text-[11px] font-mono text-zinc-400 bg-muted/20 p-2 rounded border border-border/30 mt-1 truncate max-w-xl">
                        {rev.contentSnippet}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRollbackRevision(rev.revision)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors font-medium text-xs shrink-0 self-end md:self-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-primary" />
                    <span>Rollback to #{rev.revision}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Restore Confirmation Dialog */}
      {restoreConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-foreground text-base">Confirm Database Restore?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Restoring a snapshot will safely restore files. An emergency safety rollback snapshot of the current state will be automatically created before restoring.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreConfirmId(null)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmRestore(restoreConfirmId)}
                disabled={isRestoring}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
      {recoveryConfirmId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-amber-500" /><h3 className="font-bold">Restore recovery bundle?</h3></div><p className="text-xs leading-relaxed text-muted-foreground">Hermes Hub will verify every SHA-256 hash, create a new safety backup of the current state, and only then restore the safe files. Live databases and secrets are excluded.</p><div className="flex justify-end gap-2"><button onClick={() => setRecoveryConfirmId(null)} className="rounded-lg border border-border px-3 py-2 text-xs">Cancel</button><button disabled={isRestoring} onClick={() => void restoreRecovery(recoveryConfirmId)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isRestoring ? 'Verifying…' : 'Verify, back up & restore'}</button></div></div></div>}
    </div>
  );
};
