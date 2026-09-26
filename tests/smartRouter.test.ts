import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SmartRouterService, type SmartRouterCommandRunner } from '../apps/desktop/electron/smartRouter';

const directories: string[] = [];

function createService(commands: string[][] = [], runnerOverride?: SmartRouterCommandRunner) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-router-'));
  directories.push(directory);
  const runner: SmartRouterCommandRunner = runnerOverride || (async (args) => {
    commands.push(args);
    if (args[0] === 'profile' && args[1] === 'list') {
      return { success: true, output: 'PROFILE    MODEL\ndefault    inherited\n' };
    }
    return { success: true, output: 'ok' };
  });
  const hermes = { detect: async () => ({ executablePath: process.execPath }) };
  return new SmartRouterService(hermes as never, directory, runner, async () => []);
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('SmartRouterService', () => {
  it('routes ordinary work to a free model', () => {
    const service = createService();
    const decision = service.simulate({ prompt: 'Summarize this short note.', botId: 'default' });
    expect(decision.blocked).toBe(false);
    expect(decision.paid).toBe(false);
    expect(decision.selectedPoolId).toBe('free-fast');
    expect(decision.selectedModel?.class).toBe('free');
    expect(decision.estimatedCostUsd).toBe(0);
  });

  it('uses only the approved paid allowlist for highly complex work', () => {
    const service = createService();
    const decision = service.simulate({
      prompt: `Design a production distributed architecture and implement a multi-step migration. ${'architecture '.repeat(400)}`,
      botId: 'default',
      fileCount: 20,
      estimatedContextTokens: 200_000,
      requiresTools: true,
      requiresVision: true,
    });
    expect(decision.complexity).toBe(100);
    expect(decision.paid).toBe(true);
    expect(decision.blocked).toBe(false);
    expect(decision.selectedModel?.model).toBe('deepseek/deepseek-v4-flash');
    expect(decision.selectedModel?.approvedForPaidUse).toBe(true);
  });

  it('fails closed when a paid model is not approved', async () => {
    const service = createService();
    const state = await service.getState();
    service.savePolicy({
      ...state.policy,
      models: state.policy.models.map((model) => ({ ...model, approvedForPaidUse: false })),
    });
    const decision = service.simulate({ prompt: `Implement a production distributed architecture. ${'complex '.repeat(700)}`, fileCount: 20, estimatedContextTokens: 200_000, requiresTools: true });
    expect(decision.blocked).toBe(true);
    expect(decision.selectedModel).toBeUndefined();
  });

  it('blocks paid routes that exceed the user budget', async () => {
    const service = createService();
    const state = await service.getState();
    service.savePolicy({ ...state.policy, budget: { ...state.policy.budget, maxUsdPerTask: 0 } });
    const decision = service.simulate({ prompt: `Implement a production distributed architecture. ${'complex '.repeat(700)}`, fileCount: 20, estimatedContextTokens: 200_000, requiresTools: true });
    expect(decision.paid).toBe(true);
    expect(decision.blocked).toBe(true);
    expect(decision.message).toContain('budget');
  });

  it('creates and configures a native Hermes profile', async () => {
    const commands: string[][] = [];
    const service = createService(commands);
    const bot = await service.createBot({ profile: 'coding-bot', name: 'Coding Bot', description: 'Handles implementation work.', defaultPoolId: 'free-strong', skills: ['github'], cloneFrom: 'default' });
    expect(bot.profile).toBe('coding-bot');
    expect(commands).toContainEqual(['profile', 'create', 'coding-bot', '--clone-from', 'default', '--description', 'Handles implementation work.']);
    expect(commands).toContainEqual(['-p', 'coding-bot', 'config', 'set', 'model.provider', 'openrouter']);
    expect(commands).toContainEqual(['-p', 'coding-bot', 'config', 'set', 'model.default', 'qwen/qwen3.8-27b:free']);
  });

  it('requires confirmation and executes with the exact selected Hermes profile and model', async () => {
    const commands: string[][] = [];
    const service = createService(commands);
    await expect(service.execute({ prompt: 'Summarize this note.', botId: 'default', confirmed: false })).rejects.toThrow('explicit confirmation');
    const record = await service.execute({ prompt: 'Summarize this note.', botId: 'default', confirmed: true });
    expect(record.status).toBe('success');
    const command = commands.find((args) => args.includes('-z'));
    expect(command).toEqual(expect.arrayContaining(['-p', 'default', '-z', 'Summarize this note.', '-m', 'nvidia/nemotron-3.5-lightning:free', '--provider', 'openrouter']));
  });
});
