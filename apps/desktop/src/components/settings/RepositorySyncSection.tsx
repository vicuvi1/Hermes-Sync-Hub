import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Github,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { SourceRepositoryResult, SourceRepositoryStatus } from '@hermes-hub/types';

const REPOSITORY_URL = 'https://github.com/vicuvi1/Hermes-Sync-Hub.git';

export const RepositorySyncSection: React.FC = () => {
  const [workspacePath, setWorkspacePath] = useState('');
  const [status, setStatus] = useState<SourceRepositoryStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState('Update Hermes Hub from desktop app');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'status' | 'pull' | 'push' | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkStatus = async (selectedPath = workspacePath) => {
    if (!window.hermesHub?.getSourceRepositoryStatus) return;
    setBusy('status');
    setResult(null);
    try {
      const next = await window.hermesHub.getSourceRepositoryStatus(selectedPath || undefined);
      setStatus(next);
      if (next.workspacePath) setWorkspacePath(next.workspacePath);
      if (selectedPath) await window.hermesHub.updateAppSettings({ repositoryWorkspacePath: selectedPath });
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'Could not inspect the repository.' });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    window.hermesHub?.getAppSettings?.().then((settings) => {
      const savedPath = settings.repositoryWorkspacePath || '';
      setWorkspacePath(savedPath);
      checkStatus(savedPath);
    });
  }, []);

  const chooseFolder = async () => {
    const selected = await window.hermesHub?.pickSourceRepository?.();
    if (selected) {
      setWorkspacePath(selected);
      await checkStatus(selected);
    }
  };

  const applyResult = (next: SourceRepositoryResult) => {
    setStatus(next.status);
    setResult({ success: next.success, message: next.message });
    if (next.success) setConfirmed(false);
  };

  const pull = async () => {
    if (!window.hermesHub || !workspacePath) return;
    setBusy('pull');
    setResult(null);
    try {
      applyResult(await window.hermesHub.pullSourceRepository(workspacePath));
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'Pull failed.' });
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    if (!window.hermesHub || !workspacePath) return;
    setBusy('push');
    setResult(null);
    try {
      applyResult(await window.hermesHub.pushSourceRepository({ workspacePath, commitMessage, confirmed }));
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'Push failed.' });
    } finally {
      setBusy(null);
    }
  };

  const canPull = Boolean(status?.validRepository && status.branch === 'main' && !status.changedFiles.length && !busy);
  const canPush = Boolean(status?.validRepository && status.branch === 'main' && confirmed && commitMessage.trim() && !busy);

  return <div className="space-y-3">
    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Repository Sync</h3>
    <div className="rounded-xl border border-border bg-card/70 p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-border bg-background p-2.5 text-foreground"><Github className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Push GPT/Reverso edits or pull the latest source</div>
          <div className="mt-1 text-xs text-muted-foreground">This developer tool uses Git installed on this computer. It is separate from the safe application updater above.</div>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 break-all font-mono text-[11px] text-primary hover:underline">{REPOSITORY_URL}<ExternalLink className="h-3 w-3 shrink-0" /></a>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Local source folder</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} placeholder="Choose the folder containing .git" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary" />
          <button onClick={chooseFolder} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"><FolderOpen className="h-4 w-4" />Browse</button>
          <button onClick={() => checkStatus()} disabled={Boolean(busy) || !workspacePath.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">{busy === 'status' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Check</button>
        </div>
      </div>

      {status && <div className="space-y-3">
        <div className={`rounded-lg border p-3 text-xs ${status.validRepository ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400' : 'border-amber-500/25 bg-amber-500/5 text-amber-400'}`}>
          <div className="flex items-center gap-2">{status.validRepository ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}<span>{status.message}</span></div>
        </div>
        {status.validRepository && <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Branch', status.branch || '—'], ['Commit', status.commit || '—'], ['Ahead', String(status.ahead)], ['Behind', String(status.behind)]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-background p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs text-foreground">{value}</div></div>)}
          </div>
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-foreground"><FileCode2 className="h-4 w-4" />Changed files ({status.changedFiles.length})</div>
            <div className="max-h-40 overflow-auto px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {status.changedFiles.length ? status.changedFiles.map((file) => <div key={file} className="py-0.5 break-all">{file}</div>) : <div>No uncommitted files.</div>}
            </div>
          </div>
        </>}
      </div>}

      <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold text-foreground">Get latest from GitHub</div>
          <div className="mt-1 text-xs text-muted-foreground">Pull uses a fast-forward-only merge and is disabled while local files are changed.</div>
          <button onClick={pull} disabled={!canPull} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{busy === 'pull' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}Pull Latest</button>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-semibold text-foreground">Send changes to GitHub</div>
          <div className="mt-1 text-xs text-muted-foreground">All displayed changes are committed to <span className="font-mono">main</span>, then pushed to the fixed repository.</div>
          <input value={commitMessage} maxLength={200} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message" className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary" />
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>I reviewed the changed files and want to publish them to GitHub.</span></label>
          <button onClick={push} disabled={!canPush} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{busy === 'push' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}Commit &amp; Push</button>
        </div>
      </div>

      {result && <div className={`rounded-lg border p-3 text-xs ${result.success ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400' : 'border-rose-500/25 bg-rose-500/5 text-rose-400'}`}>{result.message}</div>}
      <div className="text-[10px] text-muted-foreground">Safety: only the hardcoded repository is accepted. Likely environment, credential, private-key, Vault, and database files are blocked.</div>
    </div>
  </div>;
};
