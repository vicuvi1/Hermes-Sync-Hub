import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  HermesSession,
  HermesSessionDetail,
  HermesMessage,
  SessionExportFormat,
  SessionExportOptions,
  SessionExportResult,
  SessionImportPayload,
  SessionImportResult,
} from '@hermes-hub/types';
import { redactSecrets } from '@hermes-hub/shared';
import { HermesService } from '../hermes/HermesAdapter.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { HermesDiscoveryService } from '../discovery/HermesDiscovery.js';

const execFileAsync = promisify(execFile);

/**
 * Formats a session into clean, human-readable Markdown
 */
export function renderSessionMarkdown(
  session: HermesSessionDetail,
  options: { redact?: boolean } = {}
): string {
  const redact = options.redact !== false;
  const lines: string[] = [];

  lines.push(`# Session: ${session.title}`);
  lines.push('');
  lines.push(`- **Session ID:** \`${session.id}\``);
  lines.push(`- **Model:** \`${session.model}\``);
  lines.push(`- **Started At:** ${session.createdAt}`);
  lines.push(`- **Last Active:** ${session.updatedAt}`);
  lines.push(`- **Messages:** ${session.messagesCount}`);
  if (session.originDeviceName) {
    lines.push(`- **Origin Device:** ${session.originDeviceName}`);
  }
  if (session.cwd) {
    lines.push(`- **Working Directory:** \`${session.cwd}\``);
  }
  if (session.gitBranch) {
    lines.push(`- **Git Branch:** \`${session.gitBranch}\``);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of session.messages) {
    const roleCapitalized = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    let roleEmoji = '💬';
    if (msg.role === 'user') roleEmoji = '👤';
    else if (msg.role === 'assistant') roleEmoji = '🤖';
    else if (msg.role === 'system') roleEmoji = '⚙️';
    else if (msg.role === 'tool') roleEmoji = '🔧';

    lines.push(`### ${roleEmoji} ${roleCapitalized}${msg.toolName ? ` (${msg.toolName})` : ''}`);
    lines.push('');

    let content = msg.content || '';
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('**Tool Calls Invoked:**');
      for (const tc of msg.toolCalls) {
        lines.push(`- \`${tc.function.name}\`: \`${tc.function.arguments}\``);
      }
      lines.push('');
    }

    if (content) {
      lines.push(content);
      lines.push('');
    }

    if (msg.reasoning) {
      lines.push(`> *Reasoning:* ${msg.reasoning}`);
      lines.push('');
    }
  }

  let fullText = lines.join('\n');
  if (redact) {
    fullText = redactSecrets(fullText);
  }
  return fullText;
}

/**
 * Formats a session into a standalone, styled HTML transcript
 */
export function renderSessionHtml(
  session: HermesSessionDetail,
  options: { redact?: boolean } = {}
): string {
  const md = renderSessionMarkdown(session, options);
  const escapedTitle = session.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const messageHtmls = session.messages.map((m) => {
    const isUser = m.role === 'user';
    const isAssistant = m.role === 'assistant';
    const isTool = m.role === 'tool';
    const rawContent = m.content || '';
    const displayContent = options.redact !== false ? redactSecrets(rawContent) : rawContent;
    const escapedContent = displayContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const bubbleClass = isUser
      ? 'bg-blue-950/40 border-blue-800/40 text-blue-100 ml-12'
      : isAssistant
      ? 'bg-zinc-900 border-zinc-800 text-zinc-100 mr-12'
      : isTool
      ? 'bg-amber-950/30 border-amber-900/40 text-amber-200 text-xs font-mono'
      : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-300 text-xs';

    const roleBadge = isUser
      ? '👤 User'
      : isAssistant
      ? `🤖 Assistant (${session.model})`
      : isTool
      ? `🔧 Tool Output (${m.toolName || 'tool'})`
      : '⚙️ System';

    return `
      <div class="mb-4">
        <div class="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
          <span>${roleBadge}</span>
        </div>
        <div class="p-4 rounded-xl border ${bubbleClass} whitespace-pre-wrap leading-relaxed">
          ${escapedContent}
        </div>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hermes Session: ${escapedTitle}</title>
  <style>
    body {
      background-color: #090a0f;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 860px;
      width: 100%;
    }
    .header {
      border-bottom: 1px solid #27272a;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #fafafa;
    }
    .meta {
      font-size: 0.8rem;
      color: #a1a1aa;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .meta strong { color: #f4f4f5; }
    .msg {
      margin-bottom: 1.5rem;
    }
    .msg-header {
      font-size: 0.75rem;
      font-weight: 600;
      color: #71717a;
      margin-bottom: 0.35rem;
    }
    .msg-body {
      padding: 1rem;
      border-radius: 0.75rem;
      line-height: 1.6;
      border: 1px solid #27272a;
      background: #18181b;
      font-size: 0.9rem;
    }
    .user { background: #172554; border-color: #1e40af; color: #dbeafe; margin-left: 2rem; }
    .tool { background: #1c1917; border-color: #44403c; color: #fef08a; font-family: monospace; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapedTitle}</h1>
      <div class="meta">
        <span>ID: <strong>${session.id}</strong></span>
        <span>Model: <strong>${session.model}</strong></span>
        <span>Messages: <strong>${session.messagesCount}</strong></span>
        <span>Date: <strong>${session.createdAt}</strong></span>
      </div>
    </div>
    <div class="messages">
      ${messageHtmls}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Service orchestrating non-destructive Hermes session discovery,
 * rich transcript reading, secret-redacted export, and safe validated import.
 */
export class HermesSessionService {
  private hermesService: HermesService;
  private workspaceService?: WorkspaceService;
  private discovery: HermesDiscoveryService;
  private customHermesHome?: string;

  constructor(
    hermesService?: HermesService,
    workspaceService?: WorkspaceService,
    customHermesHome?: string,
    discovery?: HermesDiscoveryService
  ) {
    this.customHermesHome = customHermesHome;
    this.discovery = discovery || new HermesDiscoveryService(customHermesHome);
    this.hermesService = hermesService || new HermesService(customHermesHome, this.discovery);
    this.workspaceService = workspaceService;
  }

  /**
   * Resolves active Hermes home directory
   */
  async resolveHermesHome(): Promise<string | null> {
    if (this.customHermesHome && fs.existsSync(this.customHermesHome)) {
      return this.customHermesHome;
    }
    const info = await this.hermesService.detect();
    if (info?.homePath && fs.existsSync(info.homePath)) {
      return info.homePath;
    }
    return this.discovery.findHermesHome();
  }

  /**
   * Discovers sessions non-destructively from CLI, local request dumps, and workspace
   */
  async listSessions(options: { limit?: number; search?: string } = {}): Promise<HermesSession[]> {
    const limit = options.limit || 50;
    const sessionMap = new Map<string, HermesSession>();

    const home = await this.resolveHermesHome();

    // 1. Try reading CLI if available (non-destructive read via subprocess)
    const exe = this.discovery.findHermesExecutable(home);
    if (exe) {
      try {
        const { stdout } = await execFileAsync(exe, ['sessions', 'list', '--limit', String(limit)], {
          timeout: 4000,
        });
        const cliSessions = this.parseCliSessionList(stdout);
        for (const s of cliSessions) {
          sessionMap.set(s.id, s);
        }
      } catch {}
    }

    // 2. Discover sessions from <hermesHome>/sessions/ request_dump_*.json
    if (home) {
      const dumpSessions = this.scanSessionDumps(home);
      for (const s of dumpSessions) {
        if (!sessionMap.has(s.id)) {
          sessionMap.set(s.id, s);
        } else {
          // Merge rich details if dump has more data
          const existing = sessionMap.get(s.id)!;
          if (!existing.previewText && s.previewText) {
            existing.previewText = s.previewText;
          }
          if (s.toolsUsed && s.toolsUsed.length > 0) {
            existing.toolsUsed = Array.from(new Set([...(existing.toolsUsed || []), ...s.toolsUsed]));
          }
        }
      }
    }

    // 3. Discover sessions from workspace sessions directory if available
    if (this.workspaceService) {
      const wsRoot = this.workspaceService.getRootPath();
      const wsSessionsDir = path.join(wsRoot, 'sessions');
      if (fs.existsSync(wsSessionsDir)) {
        try {
          const files = fs.readdirSync(wsSessionsDir);
          for (const file of files) {
            if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;
            const full = path.join(wsSessionsDir, file);
            try {
              const content = fs.readFileSync(full, 'utf-8');
              const parsed = JSON.parse(content);
              const items = Array.isArray(parsed) ? parsed : [parsed];
              for (const item of items) {
                if (item.id && !sessionMap.has(item.id)) {
                  sessionMap.set(item.id, {
                    id: item.id,
                    title: item.title || `Session ${item.id}`,
                    createdAt: item.createdAt || new Date().toISOString(),
                    updatedAt: item.updatedAt || new Date().toISOString(),
                    messagesCount: Array.isArray(item.messages) ? item.messages.length : (item.message_count || 1),
                    model: item.model || 'hermes-model',
                    tokensUsed: item.tokensUsed || item.input_tokens,
                    toolsUsed: item.toolsUsed || [],
                    originDevice: item.originDevice || 'workspace',
                    originDeviceName: item.originDeviceName || 'Sync Workspace',
                    revision: 1,
                    syncStatus: 'synced',
                    previewText: item.previewText || (item.messages && item.messages[0]?.content),
                  });
                }
              }
            } catch {}
          }
        } catch {}
      }
    }

    let sessions = Array.from(sessionMap.values());

    // Filter by search string if supplied
    if (options.search) {
      const q = options.search.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.model.toLowerCase().includes(q) ||
          (s.previewText && s.previewText.toLowerCase().includes(q))
      );
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return sessions.slice(0, limit);
  }

  /**
   * Non-destructively scans session request dump JSON files in <home>/sessions
   */
  private scanSessionDumps(home: string): HermesSession[] {
    const sessionsDir = path.join(home, 'sessions');
    if (!fs.existsSync(sessionsDir)) return [];

    const results: HermesSession[] = [];
    try {
      const files = fs.readdirSync(sessionsDir);
      for (const fileName of files) {
        if (!fileName.startsWith('request_dump_') || !fileName.endsWith('.json')) continue;
        const filePath = path.join(sessionsDir, fileName);

        try {
          const stat = fs.statSync(filePath);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);

          const sessionId = data.session_id || fileName.replace('request_dump_', '').replace('.json', '');
          const messages = data.request?.body?.messages || [];
          const model = data.request?.body?.model || 'openrouter/deepseek/deepseek-v4-flash';

          // Extract first user query as title
          let firstUserPrompt = '';
          const toolsUsed: string[] = [];
          for (const m of messages) {
            if (!firstUserPrompt && m.role === 'user' && m.content) {
              firstUserPrompt = m.content.slice(0, 100);
            }
            if (m.tool_calls && Array.isArray(m.tool_calls)) {
              for (const tc of m.tool_calls) {
                if (tc.function?.name) toolsUsed.push(tc.function.name);
              }
            }
          }

          const title = firstUserPrompt
            ? firstUserPrompt.replace(/[\r\n]+/g, ' ')
            : `Session ${sessionId.slice(0, 15)}`;

          results.push({
            id: sessionId,
            title,
            createdAt: data.timestamp || stat.birthtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
            messagesCount: messages.length,
            model,
            tokensUsed: Math.round(stat.size / 4), // rough estimate
            toolsUsed: Array.from(new Set(toolsUsed)),
            originDevice: 'local',
            originDeviceName: 'Local Machine',
            revision: 1,
            syncStatus: 'synced',
            previewText: firstUserPrompt,
          });
        } catch {}
      }
    } catch {}

    return results;
  }

  /**
   * Parses the text output of `hermes sessions list` into structured sessions
   */
  private parseCliSessionList(cliOutput: string): HermesSession[] {
    const sessions: HermesSession[] = [];
    const lines = cliOutput.split(/\r?\n/);
    let separatorSeen = false;

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.includes('───')) {
        separatorSeen = true;
        continue;
      }
      if (!separatorSeen) continue;

      // Format is e.g. "Title (28)  Preview (40)  Last Active (13)  ID"
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length >= 2) {
        const id = parts[parts.length - 1];
        if (id && id.length >= 6) {
          const title = parts[0] || `Session ${id}`;
          const preview = parts.length > 2 ? parts[1] : title;
          sessions.push({
            id,
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messagesCount: 2,
            model: 'deepseek/deepseek-v4-flash',
            originDevice: 'local',
            originDeviceName: 'Local Machine',
            revision: 1,
            syncStatus: 'synced',
            previewText: preview,
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Retrieves full session details including messages non-destructively
   */
  async getSessionDetail(sessionId: string): Promise<HermesSessionDetail | null> {
    const home = await this.resolveHermesHome();
    const cleanId = sessionId.trim();

    // 1. Try reading directly from Hermes CLI via JSONL export to stdout
    const exe = this.discovery.findHermesExecutable(home);
    if (exe) {
      try {
        const { stdout } = await execFileAsync(
          exe,
          ['sessions', 'export', '--session-id', cleanId, '--format', 'jsonl', '--redact', '-'],
          { timeout: 5000 }
        );
        if (stdout && stdout.trim()) {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const raw = JSON.parse(lastLine);
          return this.convertRawExportToDetail(raw, cleanId);
        }
      } catch {}
    }

    // 2. Try reading from session dump files in <hermesHome>/sessions/
    if (home) {
      const sessionsDir = path.join(home, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        try {
          const files = fs.readdirSync(sessionsDir);
          for (const file of files) {
            if (file.includes(cleanId) && file.endsWith('.json')) {
              const full = path.join(sessionsDir, file);
              const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
              return this.convertDumpToDetail(data, cleanId);
            }
          }
        } catch {}
      }
    }

    // 3. Try reading from workspace sessions directory
    if (this.workspaceService) {
      const wsSessionPath = path.join(this.workspaceService.getRootPath(), 'sessions', `${cleanId}.json`);
      if (fs.existsSync(wsSessionPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(wsSessionPath, 'utf-8'));
          return this.convertDumpToDetail(parsed, cleanId);
        } catch {}
      }
    }

    return null;
  }

  /**
   * Converts a native request dump payload to HermesSessionDetail
   */
  private convertDumpToDetail(data: any, cleanId: string): HermesSessionDetail {
    const rawMessages = data.request?.body?.messages || data.messages || [];
    const model = data.request?.body?.model || data.model || 'openrouter/deepseek/deepseek-v4-flash';
    const messages: HermesMessage[] = [];

    let idx = 1;
    let title = '';
    const toolsUsed: string[] = [];

    for (const m of rawMessages) {
      if (!title && m.role === 'user' && m.content) {
        title = m.content.slice(0, 100).replace(/[\r\n]+/g, ' ');
      }
      if (m.tool_calls && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          if (tc.function?.name) toolsUsed.push(tc.function.name);
        }
      }

      messages.push({
        id: m.id || idx++,
        sessionId: cleanId,
        role: m.role || 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''),
        timestamp: m.timestamp || data.timestamp,
        tokenCount: m.token_count,
        toolCallId: m.tool_call_id,
        toolName: m.tool_name,
        reasoning: m.reasoning || m.reasoning_content,
        toolCalls: m.tool_calls,
      });
    }

    return {
      id: cleanId,
      title: data.title || title || `Session ${cleanId}`,
      createdAt: data.timestamp || new Date().toISOString(),
      updatedAt: data.timestamp || new Date().toISOString(),
      messagesCount: messages.length,
      model,
      tokensUsed: data.input_tokens ? data.input_tokens + (data.output_tokens || 0) : undefined,
      toolsUsed: Array.from(new Set(toolsUsed)),
      originDevice: 'local',
      originDeviceName: 'Local Machine',
      revision: 1,
      syncStatus: 'synced',
      previewText: title,
      messages,
      systemPrompt: rawMessages.find((m: any) => m.role === 'system')?.content,
      cwd: data.cwd,
      gitBranch: data.git_branch,
      costUsd: data.actual_cost_usd || data.estimated_cost_usd,
      endReason: data.reason || data.end_reason,
    };
  }

  /**
   * Converts a native Hermes CLI export line to HermesSessionDetail
   */
  private convertRawExportToDetail(raw: any, cleanId: string): HermesSessionDetail {
    const rawMessages = raw.messages || [];
    const messages: HermesMessage[] = rawMessages.map((m: any, i: number) => ({
      id: m.id || i + 1,
      sessionId: cleanId,
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''),
      timestamp: m.timestamp,
      tokenCount: m.token_count,
      toolCallId: m.tool_call_id,
      toolName: m.tool_name,
      reasoning: m.reasoning || m.reasoning_content,
      toolCalls: m.tool_calls,
    }));

    return {
      id: cleanId,
      title: raw.title || `Session ${cleanId}`,
      createdAt: raw.started_at ? new Date(raw.started_at * 1000).toISOString() : new Date().toISOString(),
      updatedAt: raw.ended_at ? new Date(raw.ended_at * 1000).toISOString() : new Date().toISOString(),
      messagesCount: messages.length,
      model: raw.model || 'openrouter/deepseek/deepseek-v4-flash',
      tokensUsed: (raw.input_tokens || 0) + (raw.output_tokens || 0),
      originDevice: 'local',
      originDeviceName: 'Local Machine',
      revision: 1,
      syncStatus: 'synced',
      previewText: raw.preview || messages.find((m) => m.role === 'user')?.content?.slice(0, 100),
      messages,
      systemPrompt: raw.system_prompt,
      cwd: raw.cwd,
      gitBranch: raw.git_branch,
      costUsd: raw.actual_cost_usd || raw.estimated_cost_usd,
      endReason: raw.end_reason,
    };
  }

  /**
   * Safely exports one or more sessions to JSONL, Markdown, HTML, or JSON
   * with automatic secret redaction.
   */
  async exportSession(options: SessionExportOptions): Promise<SessionExportResult> {
    const format: SessionExportFormat = options.format || 'jsonl';
    const redact = options.redactSecrets !== false;

    let sessionsToExport: HermesSessionDetail[] = [];

    if (options.sessionId) {
      const detail = await this.getSessionDetail(options.sessionId);
      if (!detail) {
        return {
          success: false,
          exportedCount: 0,
          format,
          error: `Session ${options.sessionId} not found`,
        };
      }
      sessionsToExport.push(detail);
    } else {
      // Export all available sessions
      const list = await this.listSessions({ limit: 100 });
      for (const item of list) {
        const detail = await this.getSessionDetail(item.id);
        if (detail) sessionsToExport.push(detail);
      }
    }

    if (sessionsToExport.length === 0) {
      return {
        success: false,
        exportedCount: 0,
        format,
        error: 'No sessions available to export',
      };
    }

    let renderedContent = '';

    if (format === 'markdown') {
      renderedContent = sessionsToExport
        .map((s) => renderSessionMarkdown(s, { redact }))
        .join('\n\n---\n\n');
    } else if (format === 'html') {
      renderedContent = renderSessionHtml(sessionsToExport[0], { redact });
    } else if (format === 'json') {
      renderedContent = JSON.stringify(
        sessionsToExport.length === 1 ? sessionsToExport[0] : sessionsToExport,
        null,
        2
      );
      if (redact) renderedContent = redactSecrets(renderedContent);
    } else {
      // Default: JSONL
      renderedContent = sessionsToExport
        .map((s) => {
          const raw = JSON.stringify(s);
          return redact ? redactSecrets(raw) : raw;
        })
        .join('\n') + '\n';
    }

    // Determine output file path
    let targetFilePath = options.outputPath;
    if (!targetFilePath && this.workspaceService) {
      const layout = this.workspaceService.getLayout();
      const sessionsDir = path.join(this.workspaceService.getRootPath(), 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      const ext = format === 'markdown' ? 'md' : format;
      const fileId = options.sessionId || `all-${Date.now()}`;
      targetFilePath = path.join(sessionsDir, `session-${fileId}.${ext}`);
    }

    if (targetFilePath) {
      fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
      fs.writeFileSync(targetFilePath, renderedContent, 'utf-8');

      // Update workspace manifest
      if (this.workspaceService) {
        await this.workspaceService.generateManifest();
      }
    }

    return {
      success: true,
      exportedCount: sessionsToExport.length,
      format,
      content: renderedContent,
      filePath: targetFilePath,
    };
  }

  /**
   * Safely imports a session payload (JSON / JSONL).
   * Validates schema, ensures anti-corruption (resets last_activity_* to null),
   * and prevents session ID collisions unless forced.
   */
  async importSession(payload: SessionImportPayload): Promise<SessionImportResult> {
    let rawContent = payload.content;

    if (!rawContent && payload.filePath && fs.existsSync(payload.filePath)) {
      rawContent = fs.readFileSync(payload.filePath, 'utf-8');
    }

    let sessionsToImport: any[] = [];
    if (payload.sessions && Array.isArray(payload.sessions)) {
      sessionsToImport = payload.sessions;
    } else if (rawContent) {
      const trimmed = rawContent.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          sessionsToImport = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // Fall back to JSONL parse
          const lines = trimmed.split('\n');
          for (const l of lines) {
            if (!l.trim()) continue;
            try {
              sessionsToImport.push(JSON.parse(l));
            } catch {}
          }
        }
      } else {
        // Line delimited JSON
        const lines = trimmed.split('\n');
        for (const l of lines) {
          if (!l.trim()) continue;
          try {
            sessionsToImport.push(JSON.parse(l));
          } catch {}
        }
      }
    }

    if (sessionsToImport.length === 0) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        importedIds: [],
        skippedIds: [],
        errors: ['No valid session entries found in import payload'],
      };
    }

    const existingSessions = await this.listSessions({ limit: 1000 });
    const existingIdSet = new Set(existingSessions.map((s) => s.id));

    const importedIds: string[] = [];
    const skippedIds: string[] = [];
    const errors: string[] = [];

    const home = await this.resolveHermesHome();
    const homeSessionsDir = home ? path.join(home, 'sessions') : null;
    if (homeSessionsDir && !fs.existsSync(homeSessionsDir)) {
      fs.mkdirSync(homeSessionsDir, { recursive: true });
    }

    const wsSessionsDir = this.workspaceService
      ? path.join(this.workspaceService.getRootPath(), 'sessions')
      : null;
    if (wsSessionsDir && !fs.existsSync(wsSessionsDir)) {
      fs.mkdirSync(wsSessionsDir, { recursive: true });
    }

    for (let i = 0; i < sessionsToImport.length; i++) {
      const item = sessionsToImport[i];

      // 1. Schema Validation
      if (!item || typeof item !== 'object') {
        errors.push(`Entry #${i}: session must be a JSON object`);
        continue;
      }

      const id = String(item.id || item.session_id || '').trim();
      if (!id) {
        errors.push(`Entry #${i}: session id is required`);
        continue;
      }

      const messages = item.messages || item.request?.body?.messages;
      if (!Array.isArray(messages)) {
        errors.push(`Entry #${i} (${id}): messages must be an array`);
        continue;
      }

      // Check messages validity
      let validRoles = true;
      for (let mIdx = 0; mIdx < messages.length; mIdx++) {
        const m = messages[mIdx];
        if (!m || typeof m !== 'object' || !m.role) {
          errors.push(`Entry #${i} (${id}): message #${mIdx} must have a valid role`);
          validRoles = false;
          break;
        }
      }
      if (!validRoles) continue;

      // 2. Deduplication check
      if (existingIdSet.has(id)) {
        skippedIds.push(id);
        continue;
      }

      // 3. Anti-Corruption Sanitization (contract with Hermes watchdog)
      // Reset live runtime activity state so watchdog does not trip on imported historical turns
      const sanitizedSession = {
        ...item,
        id,
        session_id: id,
        last_activity_at: null,
        last_activity_description: null,
        last_activity_provenance: null,
        parent_session_id: item.parent_session_id !== id ? item.parent_session_id : null,
      };

      // 4. Safe Non-Destructive Ingestion
      // Write to workspace sessions
      if (wsSessionsDir) {
        const wsDest = path.join(wsSessionsDir, `${id}.json`);
        fs.writeFileSync(wsDest, JSON.stringify(sanitizedSession, null, 2), 'utf-8');
      }

      // Write to local Hermes sessions directory as request dump
      if (homeSessionsDir) {
        const localDumpFile = path.join(homeSessionsDir, `request_dump_${id}_imported.json`);
        const dumpPayload = {
          session_id: id,
          title: sanitizedSession.title,
          timestamp: sanitizedSession.createdAt || new Date().toISOString(),
          reason: 'imported',
          request: {
            method: 'POST',
            body: {
              model: sanitizedSession.model || 'openrouter/deepseek/deepseek-v4-flash',
              messages: messages.map((m: any) => ({
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls || m.toolCalls,
                tool_name: m.tool_name || m.toolName,
                tool_call_id: m.tool_call_id || m.toolCallId,
              })),
            },
          },
        };
        fs.writeFileSync(localDumpFile, JSON.stringify(dumpPayload, null, 2), 'utf-8');
      }

      importedIds.push(id);
      existingIdSet.add(id);
    }

    // 5. Update workspace manifest if any sessions were imported
    if (importedIds.length > 0 && this.workspaceService) {
      await this.workspaceService.generateManifest();
    }

    return {
      success: importedIds.length > 0 || skippedIds.length > 0,
      importedCount: importedIds.length,
      skippedCount: skippedIds.length,
      importedIds,
      skippedIds,
      errors,
    };
  }
}
