import React, { useEffect, useState } from 'react';
import { HermesMemory, Device, UpdateHermesMemoryInput, UpdateHermesMemoryResult } from '@hermes-hub/types';
import { formatTimeAgo } from '@hermes-hub/shared';
import {
  Brain,
  Search,
  CheckCircle2,
  Clock,
  Laptop,
  Pencil,
  Save,
  X,
  ShieldCheck,
} from 'lucide-react';

interface MemoryViewProps {
  memories: HermesMemory[];
  devices: Device[];
  initialSelectedMemoryId?: string;
  onSaveMemory: (input: UpdateHermesMemoryInput) => Promise<UpdateHermesMemoryResult>;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ memories, devices, initialSelectedMemoryId, onSaveMemory }) => {
  const [selectedMemory, setSelectedMemory] = useState<HermesMemory>(memories[0]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { const requested = memories.find((memory) => memory.id === initialSelectedMemoryId); if (requested) setSelectedMemory(requested); }, [initialSelectedMemoryId, memories]);
  useEffect(() => {
    if (!selectedMemory) return;
    const refreshed = memories.find((memory) => memory.id === selectedMemory.id);
    if (refreshed && !isEditing) {
      setSelectedMemory(refreshed);
      setDraft(refreshed.content);
    }
  }, [memories, selectedMemory?.id, isEditing]);

  const filteredMemories = memories.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectMemory = (mem: HermesMemory) => {
    if (isEditing && draft !== selectedMemory.content && !window.confirm('Discard your unsaved memory changes?')) return;
    setSelectedMemory(mem);
    setDraft(mem.content);
    setIsEditing(false);
    setMessage(null);
  };

  const beginEditing = () => {
    if (!selectedMemory) return;
    setDraft(selectedMemory.content);
    setMessage(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(selectedMemory.content);
    setIsEditing(false);
    setMessage(null);
  };

  const saveMemory = async () => {
    if (!selectedMemory || draft === selectedMemory.content) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await onSaveMemory({ id: selectedMemory.id, content: draft, expectedUpdatedAt: selectedMemory.updatedAt });
      setSelectedMemory(result.memory);
      setDraft(result.memory.content);
      setIsEditing(false);
      setMessage(`${result.message} Recovery backup: ${result.backupId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hermes memory could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-6">
      {/* Memories List */}
      <div className="w-full md:w-5/12 flex flex-col gap-3 h-full">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search memory files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredMemories.map((mem) => {
            const isSelected = selectedMemory?.id === mem.id;
            return (
              <div
                key={mem.id}
                onClick={() => handleSelectMemory(mem)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                    : 'bg-card/70 border-border hover:border-border/80 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span>{mem.title}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">
                    Rev {mem.revision}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground font-mono mt-1 truncate">
                  {mem.path}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Modified {formatTimeAgo(mem.updatedAt)}</span>
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Synced
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Memory Content Viewer & Editor */}
      <div className="w-full md:w-7/12 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 flex flex-col justify-between overflow-hidden">
        {selectedMemory ? (
          <div className="flex flex-col h-full space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>{selectedMemory.title}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    Current Revision #{selectedMemory.revision}
                  </span>
                </h3>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  Origin: {selectedMemory.originDeviceName} • Updated {formatTimeAgo(selectedMemory.updatedAt)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? <>
                  <button onClick={cancelEditing} disabled={isSaving} className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"><X className="h-3.5 w-3.5" />Cancel</button>
                  <button onClick={() => void saveMemory()} disabled={isSaving || draft === selectedMemory.content} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/15 disabled:opacity-40"><Save className="h-3.5 w-3.5" />{isSaving ? 'Saving…' : 'Save to Hermes'}</button>
                </> : <button onClick={beginEditing} className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"><Pencil className="h-3.5 w-3.5" />Edit memory</button>}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-600 dark:text-emerald-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Connected to live Hermes.</strong> Saving writes directly to this file, creates a recovery backup first, and stages the change for your mesh.</span></div>
            {message && <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs text-primary">{message}</div>}

            {/* Device Sync Matrix (Per User Spec: Desktop ✓, Zenbook ✓, Laptop 3 pending) */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
              <div className="font-semibold text-muted-foreground mb-2 text-[11px] uppercase tracking-wider">
                Mesh Revision Status (Rev {selectedMemory.revision})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {devices.map((d) => {
                  const hasRevision = selectedMemory.devicesWithRevision.includes(d.deviceId);
                  return (
                    <div
                      key={d.deviceId}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40"
                    >
                      <span className="font-medium text-foreground truncate">{d.deviceName}</span>
                      {hasRevision ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-amber-500 font-medium text-[11px]">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {isEditing ? <textarea autoFocus spellCheck={false} value={draft} onChange={(event) => setDraft(event.target.value)} className="h-full min-h-72 w-full resize-none rounded-xl border border-primary/35 bg-background p-4 font-mono text-xs leading-relaxed text-foreground outline-none ring-2 ring-primary/10" /> : <div className="p-4 rounded-xl bg-muted/20 border border-border/40 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed h-full overflow-y-auto">{selectedMemory.content}</div>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
