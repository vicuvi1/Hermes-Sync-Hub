import React, { useState } from 'react';
import { CheckCircle2, CircleAlert, FolderOpen, LoaderCircle, MonitorCog, ShieldCheck } from 'lucide-react';
import { CompleteOnboardingInput, OnboardingState } from '@hermes-hub/types';

interface FirstRunWizardProps {
  state: OnboardingState;
  onComplete: (input: CompleteOnboardingInput) => Promise<void>;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ state, onComplete }) => {
  const [hermesHome, setHermesHome] = useState(state.configuredHermesHome || state.detectedHermesHome || '');
  const [workspacePath, setWorkspacePath] = useState(state.workspacePath);
  const [demoMode, setDemoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete({ hermesHome: hermesHome.trim() || undefined, workspacePath: workspacePath.trim() || undefined, demoMode });
    } catch (cause: any) {
      setSaving(false);
      setError(cause?.message || 'Unable to save setup.');
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-xl">
    <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      <div className="border-b border-border bg-gradient-to-br from-primary/15 via-card to-card p-7">
        <div className="flex items-start gap-4"><span className="rounded-2xl bg-primary p-3 text-primary-foreground"><MonitorCog className="h-7 w-7" /></span><div><span className="text-xs font-bold uppercase tracking-[.2em] text-primary">First-run setup</span><h1 className="mt-1 text-2xl font-bold">Make Hermes Hub yours</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Confirm the detected services and storage paths. Nothing is uploaded to a central server.</p></div></div>
      </div>
      <div className="grid gap-6 p-7 md:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detected services</h2>
          {Object.entries(state.runtime.services).map(([key, service]) => {
            const healthy = service.state === 'healthy';
            return <div key={key} className="flex gap-3 rounded-xl border border-border bg-background/60 p-3">{healthy ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}<div><div className="text-xs font-semibold">{service.label}</div><div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{service.detail}</div></div></div>;
          })}
        </div>
        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-semibold"><FolderOpen className="h-3.5 w-3.5 text-primary" />Hermes home</span><input value={hermesHome} onChange={(event) => setHermesHome(event.target.value)} placeholder="Automatically detect Hermes" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><span className="mt-1 block text-[11px] text-muted-foreground">Leave empty to keep automatic detection.</span></label>
          <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-semibold"><FolderOpen className="h-3.5 w-3.5 text-primary" />Managed workspace</span><input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3"><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span><span className="block text-xs font-semibold">Explore with clearly labeled demo data</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Demo data stays separate and can be disabled later.</span></span></label>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" />Secrets will use Windows-protected encrypted storage.</div>
          {error && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</div>}
          <button onClick={submit} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Saving and restarting…' : 'Finish setup'}</button>
        </div>
      </div>
    </div>
  </div>;
};
