import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  HermesSessionService,
  renderSessionMarkdown,
  renderSessionHtml,
} from '../apps/agent/src/sessions/SessionService';
import { WorkspaceService } from '../apps/agent/src/workspace/WorkspaceService';
import { DeviceIdentityService } from '../apps/agent/src/devices/DeviceService';
import { HermesService } from '../apps/agent/src/hermes/HermesAdapter';
import { AgentServer } from '../apps/agent/src/health/AgentServer';
import { AgentClient } from '../apps/agent/src/client/AgentClient';
import { HermesSessionDetail } from '@hermes-hub/types';

describe('Hermes Session Service & Portability Engine (Milestone 10)', () => {
  let tempBase: string;
  let tempHermesHome: string;
  let tempWorkspaceRoot: string;
  let workspaceService: WorkspaceService;
  let sessionService: HermesSessionService;
  let identityService: DeviceIdentityService;
  let hermesService: HermesService;
  let server: AgentServer;
  let client: AgentClient;
  let port: number;

  beforeAll(async () => {
    tempBase = path.join(os.tmpdir(), `hermes-hub-sessions-test-${Date.now()}`);
    tempHermesHome = path.join(tempBase, 'hermes_home');
    tempWorkspaceRoot = path.join(tempBase, 'workspace');

    fs.mkdirSync(tempHermesHome, { recursive: true });
    fs.mkdirSync(path.join(tempHermesHome, 'sessions'), { recursive: true });
    fs.mkdirSync(tempWorkspaceRoot, { recursive: true });

    // Seed mock request dump in hermes_home/sessions
    const dumpPayload = {
      session_id: 'test-session-dump-001',
      timestamp: '2026-09-26T01:00:00.000Z',
      request: {
        method: 'POST',
        body: {
          model: 'openrouter/anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'user',
              content: 'Can you analyze our database schema and test with api key sk-ant-api03-abcdef1234567890abcdef1234567890?',
            },
            {
              role: 'assistant',
              content: 'Certainly! I will query the database schema for you.',
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'inspect_schema',
                    arguments: '{"table":"users"}',
                  },
                },
              ],
            },
            {
              role: 'tool',
              tool_name: 'inspect_schema',
              tool_call_id: 'call_1',
              content: '{"columns": ["id", "email", "created_at"]}',
            },
          ],
        },
      },
    };

    fs.writeFileSync(
      path.join(tempHermesHome, 'sessions', 'request_dump_test-session-dump-001.json'),
      JSON.stringify(dumpPayload, null, 2),
      'utf-8'
    );

    identityService = new DeviceIdentityService(path.join(tempBase, 'identity'));
    hermesService = new HermesService(tempHermesHome);
    workspaceService = new WorkspaceService(identityService, hermesService, tempWorkspaceRoot);
    await workspaceService.initWorkspace();

    sessionService = new HermesSessionService(
      hermesService,
      workspaceService,
      tempHermesHome
    );

    // Setup AgentServer with sessionService
    server = new AgentServer(
      identityService,
      undefined,
      hermesService,
      undefined,
      undefined,
      undefined,
      undefined,
      workspaceService,
      undefined,
      sessionService
    );

    port = await server.start(0);
    client = new AgentClient(`http://127.0.0.1:${port}`);
  });

  afterAll(async () => {
    await server.stop();
    if (fs.existsSync(tempBase)) {
      fs.rmSync(tempBase, { recursive: true, force: true });
    }
  });

  describe('Discovery & Listing', () => {
    it('discovers local sessions from request dumps non-destructively', async () => {
      const sessions = await sessionService.listSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(1);
      const s = sessions.find((item) => item.id === 'test-session-dump-001');
      expect(s).toBeDefined();
      expect(s?.model).toBe('openrouter/anthropic/claude-3.5-sonnet');
      expect(s?.messagesCount).toBe(3);
      expect(s?.toolsUsed).toContain('inspect_schema');
      expect(s?.previewText).toContain('Can you analyze our database schema');
    });

    it('filters sessions by search term', async () => {
      const match = await sessionService.listSessions({ search: 'database schema' });
      expect(match.length).toBe(1);
      expect(match[0].id).toBe('test-session-dump-001');

      const noMatch = await sessionService.listSessions({ search: 'nonexistent-query-xyz' });
      expect(noMatch.length).toBe(0);
    });
  });

  describe('Session Detail Extraction', () => {
    it('extracts rich session detail with messages and tool invocations', async () => {
      const detail = await sessionService.getSessionDetail('test-session-dump-001');

      expect(detail).toBeDefined();
      expect(detail?.id).toBe('test-session-dump-001');
      expect(detail?.messages.length).toBe(3);
      expect(detail?.messages[0].role).toBe('user');
      expect(detail?.messages[1].role).toBe('assistant');
      expect(detail?.messages[1].toolCalls?.[0].function.name).toBe('inspect_schema');
      expect(detail?.messages[2].role).toBe('tool');
      expect(detail?.messages[2].toolName).toBe('inspect_schema');
    });

    it('returns null for nonexistent session detail', async () => {
      const detail = await sessionService.getSessionDetail('nonexistent-session-id');
      expect(detail).toBeNull();
    });
  });

  describe('Session Export & Secret Redaction', () => {
    const mockDetail: HermesSessionDetail = {
      id: 'export-test-01',
      title: 'API Key Test Session',
      createdAt: '2026-09-26T02:00:00.000Z',
      updatedAt: '2026-09-26T02:05:00.000Z',
      messagesCount: 2,
      model: 'openai/gpt-4o',
      originDevice: 'local',
      originDeviceName: 'Primary Machine',
      revision: 1,
      syncStatus: 'synced',
      messages: [
        {
          id: 1,
          sessionId: 'export-test-01',
          role: 'user',
          content: 'My secret key is sk-proj-1234567890abcdef1234567890 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        },
        {
          id: 2,
          sessionId: 'export-test-01',
          role: 'assistant',
          content: 'Key received safely.',
        },
      ],
    };

    it('renders clean Markdown with automatic secret redaction', () => {
      const md = renderSessionMarkdown(mockDetail, { redact: true });

      expect(md).toContain('# Session: API Key Test Session');
      expect(md).toContain('### 👤 User');
      expect(md).toContain('### 🤖 Assistant');
      expect(md).toContain('[REDACTED]');
      expect(md).not.toContain('1234567890abcdef1234567890');
    });

    it('renders styled HTML transcript with automatic secret redaction', () => {
      const html = renderSessionHtml(mockDetail, { redact: true });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Hermes Session: API Key Test Session</title>');
      expect(html).toContain('[REDACTED]');
      expect(html).not.toContain('1234567890abcdef1234567890');
    });

    it('exports session to Markdown file in workspace sessions folder', async () => {
      const result = await sessionService.exportSession({
        sessionId: 'test-session-dump-001',
        format: 'markdown',
        redactSecrets: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
      expect(result.filePath).toBeDefined();
      expect(fs.existsSync(result.filePath!)).toBe(true);

      const content = fs.readFileSync(result.filePath!, 'utf-8');
      expect(content).toContain('# Session:');
      expect(content).toContain('[REDACTED]');
      expect(content).not.toContain('abcdef1234567890abcdef1234567890');
    });

    it('exports session to JSONL format with secrets redacted', async () => {
      const result = await sessionService.exportSession({
        sessionId: 'test-session-dump-001',
        format: 'jsonl',
        redactSecrets: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('jsonl');
      expect(result.content).toBeDefined();
      expect(result.content).toContain('[REDACTED]');
      expect(result.content).not.toContain('abcdef1234567890abcdef1234567890');

      // Should be valid parseable JSON line
      const parsed = JSON.parse(result.content!.trim());
      expect(parsed.id).toBe('test-session-dump-001');
    });
  });

  describe('Safe Ingestion & Anti-Corruption Safeguards', () => {
    it('safely imports session, resets watchdog activity state, and avoids corruption', async () => {
      const importPayload = {
        id: 'peer-session-import-999',
        title: 'Peer Session Turn',
        model: 'deepseek/deepseek-v4-flash',
        last_activity_at: '2026-09-25T12:00:00Z', // Should be reset to null!
        last_activity_description: 'Running turn', // Should be reset to null!
        last_activity_provenance: 'stale-peer', // Should be reset to null!
        messages: [
          { role: 'user', content: 'What is the cluster status?' },
          { role: 'assistant', content: 'All 3 nodes are synchronized.' },
        ],
      };

      const result = await sessionService.importSession({
        content: JSON.stringify(importPayload),
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.importedIds).toContain('peer-session-import-999');

      // Check that workspace session was created
      const wsFile = path.join(tempWorkspaceRoot, 'sessions', 'peer-session-import-999.json');
      expect(fs.existsSync(wsFile)).toBe(true);

      const savedData = JSON.parse(fs.readFileSync(wsFile, 'utf-8'));
      // Verify anti-corruption watchdog invariants
      expect(savedData.last_activity_at).toBeNull();
      expect(savedData.last_activity_description).toBeNull();
      expect(savedData.last_activity_provenance).toBeNull();

      // Verify discovery now lists the imported session
      const updatedList = await sessionService.listSessions();
      expect(updatedList.some((s) => s.id === 'peer-session-import-999')).toBe(true);
    });

    it('deduplicates existing session on subsequent import without overwriting', async () => {
      const duplicatePayload = {
        id: 'peer-session-import-999',
        title: 'Duplicate Attempt',
        messages: [{ role: 'user', content: 'Duplicate' }],
      };

      const result = await sessionService.importSession({
        content: JSON.stringify(duplicatePayload),
      });

      expect(result.importedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.skippedIds).toContain('peer-session-import-999');
    });

    it('rejects corrupt import payload with invalid schema or missing messages', async () => {
      const corruptPayload = {
        id: 'corrupt-session',
        // missing messages array!
      };

      const result = await sessionService.importSession({
        content: JSON.stringify(corruptPayload),
      });

      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('messages must be an array');
    });

    it('rejects messages with invalid roles', async () => {
      const invalidRolePayload = {
        id: 'invalid-role-session',
        messages: [{ role: '', content: 'hello' }],
      };

      const result = await sessionService.importSession({
        content: JSON.stringify(invalidRolePayload),
      });

      expect(result.importedCount).toBe(0);
      expect(result.errors.some((e) => e.includes('must have a valid role'))).toBe(true);
    });
  });

  describe('AgentServer HTTP Endpoints & Client SDK', () => {
    it('fetches sessions via client.getSessions()', async () => {
      const sessions = await client.getSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.some((s) => s.id === 'test-session-dump-001')).toBe(true);
    });

    it('fetches session detail via client.getSessionDetail()', async () => {
      const detail = await client.getSessionDetail('test-session-dump-001');
      expect(detail).toBeDefined();
      expect(detail?.id).toBe('test-session-dump-001');
      expect(detail?.messages.length).toBe(3);
    });

    it('exports session via client.exportSession()', async () => {
      const res = await client.exportSession({
        sessionId: 'test-session-dump-001',
        format: 'markdown',
        redactSecrets: true,
      });

      expect(res.success).toBe(true);
      expect(res.format).toBe('markdown');
      expect(res.content).toContain('[REDACTED]');
      expect(res.content).not.toContain('abcdef1234567890abcdef1234567890');
    });

    it('imports session safely via client.importSession()', async () => {
      const newSessionPayload = {
        id: 'sdk-imported-session-777',
        title: 'SDK Ingested Conversation',
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'user', content: 'Execute tests via SDK' },
          { role: 'assistant', content: 'Tests passed cleanly.' },
        ],
      };

      const res = await client.importSession({
        content: JSON.stringify(newSessionPayload),
      });

      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(1);
      expect(res.importedIds).toContain('sdk-imported-session-777');

      const fetched = await client.getSessionDetail('sdk-imported-session-777');
      expect(fetched).toBeDefined();
      expect(fetched?.title).toBe('SDK Ingested Conversation');
    });
  });
});
