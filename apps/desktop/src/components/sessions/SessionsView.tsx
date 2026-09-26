import React, { useState, useEffect } from 'react';
import {
  HermesSession,
  HermesSessionDetail,
  HermesMessage,
  SessionExportFormat,
  SessionExportResult,
  SessionImportResult,
} from '@hermes-hub/types';
import { formatTimeAgo, redactSecrets } from '@hermes-hub/shared';
import {
  MessageSquare,
  Search,
  Cpu,
  Clock,
  Laptop,
  CheckCircle2,
  Wrench,
  Hash,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  RefreshCw,
  Shield,
  FileText,
  Code,
  FileCode,
  Check,
  AlertCircle,
  X,
  Eye,
  Terminal,
  Copy,
  Sparkles,
} from 'lucide-react';

interface SessionsViewProps {
  sessions: HermesSession[];
  onRefresh?: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({ sessions: initialSessions, onRefresh }) => {
  const [sessions, setSessions] = useState<HermesSession[]>(initialSessions);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<HermesSession | null>(
    initialSessions.length > 0 ? initialSessions[0] : null
  );
  const [sessionDetail, setSessionDetail] = useState<HermesSessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<SessionExportFormat>('markdown');
  const [redactEnabled, setRedactEnabled] = useState(true);
  const [exportResult, setExportResult] = useState<SessionExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importResult, setImportResult] = useState<SessionImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Sync state when parent sessions prop changes
  useEffect(() => {
    setSessions(initialSessions);
    if (!selectedSession && initialSessions.length > 0) {
      setSelectedSession(initialSessions[0]);
    }
  }, [initialSessions]);

  // Load detailed session messages whenever selectedSession changes
  useEffect(() => {
    let isCancelled = false;
    async function loadDetail() {
      if (!selectedSession) {
        setSessionDetail(null);
        return;
      }

      setIsLoadingDetail(true);
      try {
        if (window.hermesHub?.getSessionDetail) {
          const detail = await window.hermesHub.getSessionDetail(selectedSession.id);
          if (!isCancelled && detail) {
            setSessionDetail(detail);
            setIsLoadingDetail(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not fetch session detail over IPC:', err);
      }

      // Fallback: construct synthetic detail from HermesSession summary
      if (!isCancelled) {
        const syntheticMessages: HermesMessage[] = [];
        if (selectedSession.previewText) {
          syntheticMessages.push({
            id: 1,
            sessionId: selectedSession.id,
            role: 'user',
            content: selectedSession.previewText,
            timestamp: selectedSession.createdAt,
          });
          syntheticMessages.push({
            id: 2,
            sessionId: selectedSession.id,
            role: 'assistant',
            content: `Loaded session transcript summary for ${selectedSession.id} on model ${selectedSession.model}.`,
            timestamp: selectedSession.updatedAt,
          });
        }

        setSessionDetail({
          ...selectedSession,
          messages: syntheticMessages,
        });
        setIsLoadingDetail(false);
      }
    }

    loadDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedSession?.id]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRefresh = async () => {
    if (window.hermesHub?.getSessions) {
      try {
        const loaded = await window.hermesHub.getSessions();
        if (loaded && loaded.length > 0) {
          setSessions(loaded);
          if (!selectedSession || !loaded.some((s) => s.id === selectedSession.id)) {
            setSelectedSession(loaded[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to refresh sessions:', err);
      }
    }
    if (onRefresh) onRefresh();
  };

  const handleOpenExport = async () => {
    setIsExportOpen(true);
    setExportResult(null);
    await triggerExportPreview(exportFormat, redactEnabled);
  };

  const triggerExportPreview = async (format: SessionExportFormat, redact: boolean) => {
    if (!selectedSession) return;
    setIsExporting(true);
    try {
      if (window.hermesHub?.exportSession) {
        const res = await window.hermesHub.exportSession({
          sessionId: selectedSession.id,
          format,
          redactSecrets: redact,
        });
        setExportResult(res);
      } else {
        // Fallback simulator
        let simulated = '';
        if (format === 'markdown') {
          simulated = `# Hermes Session: ${selectedSession.title}\n\n- ID: \`${selectedSession.id}\`\n- Model: \`${selectedSession.model}\`\n\n### User\n${selectedSession.previewText || 'Hello'}`;
        } else if (format === 'html') {
          simulated = `<!DOCTYPE html><html><body><h1>${selectedSession.title}</h1><p>${selectedSession.previewText || ''}</p></body></html>`;
        } else {
          simulated = JSON.stringify(sessionDetail || selectedSession, null, 2);
        }
        if (redact) simulated = redactSecrets(simulated);
        setExportResult({
          success: true,
          exportedCount: 1,
          format,
          content: simulated,
        });
      }
    } catch (err: any) {
      setExportResult({
        success: false,
        exportedCount: 0,
        format,
        error: err.message || 'Export failed',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadExport = () => {
    if (!exportResult?.content || !selectedSession) return;
    const ext =
      exportFormat === 'markdown' ? 'md' : exportFormat === 'html' ? 'html' : exportFormat === 'jsonl' ? 'jsonl' : 'json';
    const mime =
      exportFormat === 'markdown'
        ? 'text/markdown'
        : exportFormat === 'html'
        ? 'text/html'
        : 'application/json';

    const blob = new Blob([exportResult.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hermes-session-${selectedSession.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyExportText = () => {
    if (exportResult?.content) {
      navigator.clipboard.writeText(exportResult.content);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    }
  };

  const handleExecuteImport = async () => {
    if (!importContent.trim()) {
      setImportError('Please provide JSON or JSONL session payload.');
      return;
    }
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      if (window.hermesHub?.importSession) {
        const res = await window.hermesHub.importSession({
          content: importContent.trim(),
        });
        setImportResult(res);
        if (res.success && res.importedCount > 0) {
          await handleRefresh();
        }
      } else {
        // Fallback simulation
        const parsed = JSON.parse(importContent.trim());
        const id = parsed.id || `imported-${Date.now()}`;
        const newSession: HermesSession = {
          id,
          title: parsed.title || `Imported Session ${id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messagesCount: Array.isArray(parsed.messages) ? parsed.messages.length : 2,
          model: parsed.model || 'deepseek/deepseek-v4-flash',
          originDevice: 'local',
          originDeviceName: 'Imported Turn',
          revision: 1,
          syncStatus: 'synced',
          previewText: parsed.previewText || (parsed.messages && parsed.messages[0]?.content),
        };
        setSessions([newSession, ...sessions]);
        setSelectedSession(newSession);
        setImportResult({
          success: true,
          importedCount: 1,
          skippedCount: 0,
          importedIds: [id],
          skippedIds: [],
          errors: [],
        });
      }
    } catch (err: any) {
      setImportError(err.message || 'Import failed due to invalid JSON syntax');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.model.toLowerCase().includes(search.toLowerCase()) ||
      s.originDeviceName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-6">
      {/* Sessions Left List */}
      <div className="w-full md:w-5/12 flex flex-col gap-3 h-full">
        {/* Search and Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sessions by title, model, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => {
              setIsImportOpen(true);
              setImportResult(null);
              setImportError(null);
              setImportContent('');
            }}
            title="Import Session"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={handleRefresh}
            title="Refresh Sessions"
            className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Total count badge */}
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found</span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-500">
            <Shield className="h-3 w-3" /> Non-Destructive WAL
          </span>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border/60 rounded-xl">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">No sessions found</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                      : 'bg-card/70 border-border hover:border-border/80 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm line-clamp-1">{session.title}</div>
                    <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(session.updatedAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{session.messagesCount} msgs</span>
                    </span>
                    <span>•</span>
                    <span className="font-mono truncate max-w-[120px]">{session.model}</span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Laptop className="h-3 w-3" />
                      {session.originDeviceName}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Rev {session.revision}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Session Details Right Pane */}
      <div className="w-full md:w-7/12 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 flex flex-col justify-between overflow-y-auto">
        {selectedSession ? (
          <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border/60">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-primary font-mono font-medium bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    <Hash className="h-3 w-3" />
                    <span>{selectedSession.id}</span>
                  </span>
                  <button
                    onClick={() => handleCopyId(selectedSession.id)}
                    className="text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                    title="Copy Session ID"
                  >
                    {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <h2 className="text-xl font-bold text-foreground mt-1">
                  {selectedSession.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span>Model: <strong className="text-foreground font-mono">{selectedSession.model}</strong></span>
                  <span>•</span>
                  <span>Created: {new Date(selectedSession.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>Origin: <strong className="text-foreground">{selectedSession.originDeviceName}</strong></span>
                  {sessionDetail?.cwd && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-zinc-400 truncate max-w-[200px]" title={sessionDetail.cwd}>
                        📂 {sessionDetail.cwd}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <div className="text-xs text-muted-foreground">Messages</div>
                <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {sessionDetail?.messagesCount || selectedSession.messagesCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <div className="text-xs text-muted-foreground">Tokens Estimated</div>
                <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {sessionDetail?.tokensUsed?.toLocaleString() || selectedSession.tokensUsed?.toLocaleString() || 'N/A'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <div className="text-xs text-muted-foreground">Sync Revision</div>
                <div className="text-lg font-bold font-mono text-emerald-500 mt-0.5">
                  #{selectedSession.revision}
                </div>
              </div>
            </div>

            {/* Tools Used */}
            {selectedSession.toolsUsed && selectedSession.toolsUsed.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-amber-500" />
                  <span>Agent Tools Invoked</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSession.toolsUsed.map((tool) => (
                    <span
                      key={tool}
                      className="px-2.5 py-1 rounded-md bg-amber-950/20 text-amber-300 text-xs font-mono border border-amber-900/40"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System Prompt (if present) */}
            {sessionDetail?.systemPrompt && (
              <details className="rounded-xl border border-border/50 bg-muted/20 text-xs p-3">
                <summary className="font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                  View System Prompt
                </summary>
                <div className="mt-2 font-mono whitespace-pre-wrap text-zinc-300 max-h-40 overflow-y-auto pt-2 border-t border-border/40">
                  {sessionDetail.systemPrompt}
                </div>
              </details>
            )}

            {/* Live Message Transcript */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span>Conversation Transcript</span>
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {sessionDetail?.messages ? `${sessionDetail.messages.length} turn(s)` : 'Loading turns...'}
                </span>
              </div>

              {isLoadingDetail ? (
                <div className="p-8 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-center text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading transcript...
                </div>
              ) : sessionDetail?.messages && sessionDetail.messages.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {sessionDetail.messages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    const isAssistant = msg.role === 'assistant';
                    const isTool = msg.role === 'tool';
                    const isSystem = msg.role === 'system';

                    return (
                      <div
                        key={msg.id || i}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1">
                          {isUser ? (
                            <span>👤 User</span>
                          ) : isAssistant ? (
                            <span className="flex items-center gap-1 text-primary">
                              <Sparkles className="h-3 w-3" /> Assistant ({selectedSession.model.split('/').pop()})
                            </span>
                          ) : isTool ? (
                            <span className="flex items-center gap-1 text-amber-400 font-mono">
                              <Terminal className="h-3 w-3" /> Tool Output ({msg.toolName || 'tool'})
                            </span>
                          ) : (
                            <span>⚙️ System</span>
                          )}
                          {msg.timestamp && (
                            <span className="text-[10px] text-zinc-500 font-normal">
                              {formatTimeAgo(msg.timestamp)}
                            </span>
                          )}
                        </div>

                        {/* Tool Calls */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="w-full max-w-xl mb-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 font-mono text-xs">
                            <div className="text-zinc-400 font-semibold mb-1 flex items-center gap-1">
                              <Wrench className="h-3 w-3 text-amber-400" /> Tool Calls:
                            </div>
                            {msg.toolCalls.map((tc, tcIdx) => (
                              <div key={tcIdx} className="text-amber-200">
                                <span className="font-bold text-amber-400">{tc.function.name}</span>
                                <span className="text-zinc-300">({tc.function.arguments})</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Main Message Content */}
                        {msg.content && (
                          <div
                            className={`p-3.5 rounded-2xl max-w-xl text-xs whitespace-pre-wrap leading-relaxed border ${
                              isUser
                                ? 'bg-primary/20 border-primary/40 text-foreground font-normal rounded-tr-none'
                                : isAssistant
                                ? 'bg-card border-border/80 text-foreground rounded-tl-none'
                                : isTool
                                ? 'bg-amber-950/20 border-amber-900/40 text-amber-200 font-mono'
                                : 'bg-muted/40 border-border/40 text-zinc-300'
                            }`}
                          >
                            {msg.content}
                          </div>
                        )}

                        {/* Reasoning Expander (if available) */}
                        {msg.reasoning && (
                          <details className="mt-1.5 max-w-xl text-[11px] text-zinc-400 bg-muted/20 border border-border/30 rounded-lg p-2">
                            <summary className="cursor-pointer font-semibold text-zinc-300">
                              Reasoning Thought Process
                            </summary>
                            <div className="mt-1.5 whitespace-pre-wrap font-mono text-zinc-400">
                              {msg.reasoning}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedSession.previewText || 'No transcript preview available for this session.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Select a session on the left to preview details.</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {isExportOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Export Hermes Session</h3>
              </div>
              <button
                onClick={() => setIsExportOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['markdown', 'jsonl', 'html', 'json'] as SessionExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setExportFormat(fmt);
                        triggerExportPreview(fmt, redactEnabled);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                        exportFormat === fmt
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {fmt === 'jsonl' ? 'JSONL (Native)' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Secret Redaction Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-200">Redact Secrets Automatically</div>
                    <div className="text-[11px] text-emerald-400/80">
                      Sanitizes OpenAI, Anthropic, OpenRouter API keys and Bearer tokens
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={redactEnabled}
                  onChange={(e) => {
                    setRedactEnabled(e.target.checked);
                    triggerExportPreview(exportFormat, e.target.checked);
                  }}
                  className="rounded border-zinc-600 h-4 w-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Preview Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Export Preview
                  </label>
                  <button
                    onClick={handleCopyExportText}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
                  >
                    {copiedExport ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedExport ? 'Copied' : 'Copy Preview'}</span>
                  </button>
                </div>
                <div className="bg-zinc-950 border border-border/80 rounded-xl p-3.5 font-mono text-xs text-zinc-300 max-h-52 overflow-y-auto whitespace-pre-wrap">
                  {isExporting ? (
                    <div className="flex items-center justify-center p-6 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Generating export...
                    </div>
                  ) : exportResult?.content ? (
                    exportResult.content
                  ) : exportResult?.error ? (
                    <span className="text-red-400">{exportResult.error}</span>
                  ) : (
                    'No preview available.'
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
              <span className="text-xs text-muted-foreground font-mono">
                {exportResult?.filePath ? `Saved: ${exportResult.filePath}` : 'Ready to export'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExportOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadExport}
                  disabled={!exportResult?.content || isExporting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all disabled:opacity-50 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Import Hermes Session</h3>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary leading-relaxed">
                <strong>Anti-Corruption Guard:</strong> Imported turns are automatically validated, sanitized (runtime activity watchdog state reset to <code>null</code>), and deduplicated against existing Hermes sessions.
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Paste JSON or JSONL Payload
                </label>
                <textarea
                  rows={8}
                  placeholder={`{\n  "id": "external-session-1",\n  "title": "Debug Database Migration",\n  "model": "deepseek-v4-flash",\n  "messages": [\n    { "role": "user", "content": "How do I fix WAL locks?" }\n  ]\n}`}
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-zinc-950 border border-border text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>

              {/* Status messages */}
              {importError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{importError}</span>
                </div>
              )}

              {importResult && (
                <div className={`p-3 rounded-xl border text-xs ${
                  importResult.success
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                    : 'bg-red-950/20 border-red-900/40 text-red-300'
                }`}>
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    {importResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                    <span>{importResult.success ? 'Import Completed' : 'Import Failed'}</span>
                  </div>
                  <div>Imported: {importResult.importedCount} session(s)</div>
                  {importResult.skippedCount > 0 && <div>Skipped (duplicate ID): {importResult.skippedCount}</div>}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="list-disc list-inside mt-1 text-red-400">
                      {importResult.errors.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/10">
              <button
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isImporting || !importContent.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all disabled:opacity-50 shadow-xs"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Safe Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
