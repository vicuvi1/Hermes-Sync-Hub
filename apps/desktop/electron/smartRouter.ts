import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type {
  CreateHermesBotInput,
  HermesBotDefinition,
  RouterExecutionInput,
  RouterExecutionRecord,
  RouterModel,
  RouterPolicy,
  RouterTaskCategory,
  RoutingDecision,
  RoutingSimulationInput,
  SmartRouterState,
} from '@hermes-hub/types';
import type { HermesService } from '@hermes-hub/agent';
import { redactSecrets } from '@hermes-hub/shared';

type CommandResult = { success: boolean; output: string };
export type SmartRouterCommandRunner = (args: string[], timeout: number) => Promise<CommandResult>;
export type RouterCatalogFetcher = () => Promise<Array<{ id: string; name: string; contextLength: number; promptUsdPerMillion: number; completionUsdPerMillion: number }>>;

type StoredRouterData = {
  policy: RouterPolicy;
  bots: HermesBotDefinition[];
  history: RouterExecutionRecord[];
  catalog: SmartRouterState['catalog'];
};

const now = () => new Date().toISOString();
const MODEL_ID = /^[a-z0-9][a-z0-9._~:/-]{1,199}$/i;
const PROFILE_ID = /^[a-z][a-z0-9-]{1,30}$/;
const SAFE_SKILL = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

function defaultPolicy(): RouterPolicy {
  const updatedAt = now();
  return {
    version: 1,
    paidEscalationComplexity: 80,
    budget: { maxUsdPerTask: 0.25, maxUsdPerDay: 1, maxPaidRunsPerDay: 5, requireApprovalAboveUsd: 0.1 },
    models: [
      {
        id: 'openrouter:nvidia/nemotron-3.5-lightning:free', provider: 'openrouter', model: 'nvidia/nemotron-3.5-lightning:free',
        label: 'Nemotron 3.5 Lightning Free', class: 'free', enabled: true, approvedForPaidUse: false,
        contextLength: 1_000_000, promptUsdPerMillion: 0, completionUsdPerMillion: 0,
        capabilities: ['text', 'coding', 'reasoning', 'tools', 'long-context'], catalogCheckedAt: updatedAt,
      },
      {
        id: 'openrouter:qwen/qwen3.8-27b:free', provider: 'openrouter', model: 'qwen/qwen3.8-27b:free',
        label: 'Qwen 3.8 27B Free', class: 'free', enabled: true, approvedForPaidUse: false,
        contextLength: 262_144, promptUsdPerMillion: 0, completionUsdPerMillion: 0,
        capabilities: ['text', 'coding', 'reasoning', 'tools', 'long-context'], catalogCheckedAt: updatedAt,
      },
      {
        id: 'openrouter:thinkingmachines/inkling-small:free', provider: 'openrouter', model: 'thinkingmachines/inkling-small:free',
        label: 'Inkling Small Free', class: 'free', enabled: true, approvedForPaidUse: false,
        contextLength: 1_048_576, promptUsdPerMillion: 0, completionUsdPerMillion: 0,
        capabilities: ['text', 'reasoning', 'long-context'], catalogCheckedAt: updatedAt,
      },
      {
        id: 'openrouter:deepseek/deepseek-v4-flash', provider: 'openrouter', model: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash', class: 'paid', enabled: true, approvedForPaidUse: true,
        contextLength: 1_048_576, promptUsdPerMillion: 0.05, completionUsdPerMillion: 0.09,
        capabilities: ['text', 'coding', 'reasoning', 'tools', 'long-context'], catalogCheckedAt: updatedAt,
      },
    ],
    pools: [
      { id: 'free-fast', name: 'Free Fast', description: 'Fast zero-cost work for ordinary tasks.', modelIds: ['openrouter:nvidia/nemotron-3.5-lightning:free'] },
      { id: 'free-strong', name: 'Free Strong', description: 'Capable free models for coding, research, and long context.', modelIds: ['openrouter:qwen/qwen3.8-27b:free', 'openrouter:thinkingmachines/inkling-small:free'] },
      { id: 'approved-paid', name: 'Approved Paid', description: 'Explicitly approved paid escalation models only.', modelIds: ['openrouter:deepseek/deepseek-v4-flash'] },
    ],
    rules: [
      { id: 'difficult-paid', name: 'Difficult work → approved paid', enabled: true, priority: 10, minimumComplexity: 80, maximumComplexity: 100, categories: [], poolId: 'approved-paid' },
      { id: 'coding-free', name: 'Coding → strong free', enabled: true, priority: 20, minimumComplexity: 0, maximumComplexity: 79, categories: ['coding'], poolId: 'free-strong' },
      { id: 'research-free', name: 'Research and analysis → strong free', enabled: true, priority: 30, minimumComplexity: 35, maximumComplexity: 79, categories: ['research', 'analysis'], poolId: 'free-strong' },
    ],
    updatedAt,
  };
}

function defaultBot(): HermesBotDefinition {
  const timestamp = now();
  return { id: 'default', profile: 'default', name: 'Default Hermes', description: 'The default Hermes profile.', defaultPoolId: 'free-fast', skills: [], enabled: true, nativeProfileDetected: true, createdAt: timestamp, updatedAt: timestamp };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export class SmartRouterService {
  private readonly storageFile: string;
  private data: StoredRouterData;

  constructor(
    private readonly hermesService: HermesService,
    storageDirectory: string,
    private readonly injectedRunner?: SmartRouterCommandRunner,
    private readonly injectedCatalogFetcher?: RouterCatalogFetcher,
  ) {
    this.storageFile = path.join(storageDirectory, 'smart-router.json');
    this.data = this.load();
  }

  private load(): StoredRouterData {
    try {
      if (fs.existsSync(this.storageFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.storageFile, 'utf8')) as StoredRouterData;
        if (parsed?.policy?.version === 1 && Array.isArray(parsed.bots) && Array.isArray(parsed.history)) return parsed;
      }
    } catch {}
    return { policy: defaultPolicy(), bots: [defaultBot()], history: [], catalog: { state: 'stale', message: 'Refresh the live model catalog before relying on pricing.' } };
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.storageFile), { recursive: true });
    const temporary = `${this.storageFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, this.storageFile);
  }

  private async executable(): Promise<{ file: string; prefix: string[] }> {
    const installation = await this.hermesService.detect();
    if (!installation?.executablePath || !fs.existsSync(installation.executablePath)) throw new Error('Hermes is not installed or its launcher is unavailable.');
    if (process.platform === 'win32' && path.extname(installation.executablePath).toLowerCase() === '.cmd') {
      return { file: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', prefix: ['/d', '/s', '/c', installation.executablePath] };
    }
    return { file: installation.executablePath, prefix: [] };
  }

  private async run(args: string[], timeout = 60_000): Promise<CommandResult> {
    if (this.injectedRunner) {
      const result = await this.injectedRunner([...args], timeout);
      return { ...result, output: redactSecrets(result.output) };
    }
    const command = await this.executable();
    return new Promise((resolve) => {
      execFile(command.file, [...command.prefix, ...args], { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
        const output = redactSecrets([stdout, stderr].filter(Boolean).join('\n').trim() || error?.message || 'No output returned.');
        resolve({ success: !error, output });
      });
    });
  }

  private validatePolicy(input: RouterPolicy): RouterPolicy {
    if (!input || input.version !== 1) throw new Error('Unsupported routing policy version.');
    if (!Array.isArray(input.models) || input.models.length < 1 || input.models.length > 100) throw new Error('A policy must contain between 1 and 100 models.');
    if (!Array.isArray(input.pools) || input.pools.length < 1 || input.pools.length > 30) throw new Error('A policy must contain between 1 and 30 pools.');
    if (!Array.isArray(input.rules) || input.rules.length > 100) throw new Error('A policy may contain up to 100 rules.');
    const ids = new Set<string>();
    const models = input.models.map((model) => {
      if (!MODEL_ID.test(model.model) || !MODEL_ID.test(model.provider) || !MODEL_ID.test(model.id) || ids.has(model.id)) throw new Error('Model IDs and providers must be unique safe identifiers.');
      ids.add(model.id);
      const promptPrice = clamp(Number(model.promptUsdPerMillion), 0, 1_000_000);
      const completionPrice = clamp(Number(model.completionUsdPerMillion), 0, 1_000_000);
      const modelClass = promptPrice === 0 && completionPrice === 0 ? 'free' : 'paid';
      return { ...model, label: String(model.label || model.model).slice(0, 120), class: modelClass, approvedForPaidUse: modelClass === 'paid' ? model.approvedForPaidUse === true : false, promptUsdPerMillion: promptPrice, completionUsdPerMillion: completionPrice, contextLength: clamp(Number(model.contextLength), 0, 10_000_000), capabilities: Array.from(new Set(model.capabilities || [])) } as RouterModel;
    });
    const poolIds = new Set<string>();
    const pools = input.pools.map((pool) => {
      if (!MODEL_ID.test(pool.id) || poolIds.has(pool.id)) throw new Error('Pool IDs must be unique safe identifiers.');
      poolIds.add(pool.id);
      if (!Array.isArray(pool.modelIds) || pool.modelIds.some((id) => !ids.has(id))) throw new Error(`Pool ${pool.name} references an unknown model.`);
      return { ...pool, name: String(pool.name).slice(0, 100), description: String(pool.description || '').slice(0, 500), modelIds: Array.from(new Set(pool.modelIds)) };
    });
    const ruleIds = new Set<string>();
    const rules = input.rules.map((rule) => {
      if (!MODEL_ID.test(rule.id) || ruleIds.has(rule.id) || !poolIds.has(rule.poolId)) throw new Error('Every rule needs a unique valid ID and model pool.');
      ruleIds.add(rule.id);
      const minimumComplexity = clamp(Number(rule.minimumComplexity), 0, 100);
      const maximumComplexity = clamp(Number(rule.maximumComplexity), 0, 100);
      if (minimumComplexity > maximumComplexity) throw new Error(`Rule “${rule.name}” has a minimum above its maximum.`);
      return { ...rule, name: String(rule.name).slice(0, 120), priority: clamp(Number(rule.priority), 0, 10_000), minimumComplexity, maximumComplexity };
    });
    return {
      ...input, models, pools, rules,
      paidEscalationComplexity: clamp(Number(input.paidEscalationComplexity), 0, 100),
      budget: {
        maxUsdPerTask: clamp(Number(input.budget?.maxUsdPerTask), 0, 10_000),
        maxUsdPerDay: clamp(Number(input.budget?.maxUsdPerDay), 0, 100_000),
        maxPaidRunsPerDay: clamp(Number(input.budget?.maxPaidRunsPerDay), 0, 10_000),
        requireApprovalAboveUsd: clamp(Number(input.budget?.requireApprovalAboveUsd), 0, 10_000),
      },
      updatedAt: now(),
    };
  }

  savePolicy(input: RouterPolicy): RouterPolicy {
    this.data.policy = this.validatePolicy(input);
    const poolIds = new Set(this.data.policy.pools.map((pool) => pool.id));
    this.data.bots = this.data.bots.map((bot) => poolIds.has(bot.defaultPoolId) ? bot : { ...bot, defaultPoolId: this.data.policy.pools[0].id, updatedAt: now() });
    this.save();
    return this.data.policy;
  }

  private todayStats(): SmartRouterState['today'] {
    const today = new Date().toISOString().slice(0, 10);
    const records = this.data.history.filter((record) => record.createdAt.startsWith(today));
    return { spentUsd: records.reduce((sum, record) => sum + record.actualCostUsd, 0), paidRuns: records.filter((record) => record.decision.paid && record.status === 'success').length, totalRuns: records.length };
  }

  private parseProfiles(output: string): string[] {
    return Array.from(new Set(output.split(/\r?\n/).map((line) => line.match(/^\s*(?:◆\s*)?([a-z][a-z0-9-]*)\s{2,}/i)?.[1]).filter((value): value is string => typeof value === 'string' && value.toLowerCase() !== 'profile')));
  }

  async getState(): Promise<SmartRouterState> {
    try {
      const profiles = this.parseProfiles((await this.run(['profile', 'list'], 20_000)).output);
      const known = new Set(this.data.bots.map((bot) => bot.profile));
      for (const profile of profiles) if (!known.has(profile)) {
        const timestamp = now();
        this.data.bots.push({ id: profile, profile, name: profile === 'default' ? 'Default Hermes' : profile.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()), description: 'Existing Hermes profile discovered by Hermes Hub.', defaultPoolId: this.data.policy.pools[0]?.id || '', skills: [], enabled: true, nativeProfileDetected: true, createdAt: timestamp, updatedAt: timestamp });
      }
      this.data.bots = this.data.bots.map((bot) => ({ ...bot, nativeProfileDetected: profiles.includes(bot.profile) || bot.profile === 'default' }));
      this.save();
    } catch {}
    return { policy: this.data.policy, bots: this.data.bots, history: this.data.history.slice(0, 100), today: this.todayStats(), catalog: this.data.catalog };
  }

  private classify(input: RoutingSimulationInput): { category: RouterTaskCategory; complexity: number; reasons: string[] } {
    const prompt = input.prompt.trim();
    if (!prompt || prompt.length > 20_000) throw new Error('Task text must contain between 1 and 20,000 characters.');
    const lower = prompt.toLowerCase();
    let category: RouterTaskCategory = input.category || 'general';
    if (!input.category) {
      if (input.requiresVision || /image|screenshot|vision|photo|diagram/.test(lower)) category = 'vision';
      else if (/code|bug|test|typescript|python|repository|refactor|implement|api\b/.test(lower)) category = 'coding';
      else if (/research|sources?|compare|investigate|market|evidence/.test(lower)) category = 'research';
      else if (/analy[sz]e|strategy|architecture|diagnos|security|reason/.test(lower)) category = 'analysis';
      else if (/write|rewrite|article|email|document|readme/.test(lower)) category = 'writing';
      else if (input.requiresTools) category = 'tool-use';
    }
    let complexity = 12;
    const reasons = ['Base task complexity: 12'];
    if (prompt.length > 1_000) { complexity += 8; reasons.push('Long task description +8'); }
    if (prompt.length > 4_000) { complexity += 8; reasons.push('Very long task description +8'); }
    const fileCount = clamp(Number(input.fileCount || 0), 0, 100);
    if (fileCount) { const score = Math.min(20, fileCount * 3); complexity += score; reasons.push(`${fileCount} affected file(s) +${score}`); }
    const context = clamp(Number(input.estimatedContextTokens || Math.ceil(prompt.length / 4)), 0, 10_000_000);
    if (context > 32_000) { complexity += 10; reasons.push('Large context +10'); }
    if (context > 128_000) { complexity += 10; reasons.push('Very large context +10'); }
    if (input.requiresTools) { complexity += 10; reasons.push('Tool use required +10'); }
    if (input.requiresVision) { complexity += 12; reasons.push('Vision input required +12'); }
    if (category === 'coding') { complexity += 14; reasons.push('Coding task +14'); }
    if (category === 'research' || category === 'analysis') { complexity += 10; reasons.push(`${category} task +10`); }
    if (/multi[- ]?(step|agent)|migration|production|security|architecture|root cause|performance|concurrent|distributed/.test(lower)) { complexity += 18; reasons.push('Complexity indicators +18'); }
    if (/quick|short|simple|one line|summari[sz]e/.test(lower) && complexity < 50) { complexity -= 8; reasons.push('Simple-task indicator −8'); }
    return { category, complexity: Math.round(clamp(complexity, 0, 100)), reasons };
  }

  simulate(input: RoutingSimulationInput): RoutingDecision {
    const classified = this.classify(input);
    const bot = this.data.bots.find((item) => item.id === (input.botId || 'default') && item.enabled) || this.data.bots.find((item) => item.id === 'default') || this.data.bots[0];
    const rules = [...this.data.policy.rules].filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority);
    const rule = rules.find((item) => classified.complexity >= item.minimumComplexity && classified.complexity <= item.maximumComplexity && (!item.categories.length || item.categories.includes(classified.category)));
    const pool = this.data.policy.pools.find((item) => item.id === (rule?.poolId || bot?.defaultPoolId)) || this.data.policy.pools[0];
    const candidates = (pool?.modelIds || []).map((id) => this.data.policy.models.find((model) => model.id === id)).filter((model): model is RouterModel => Boolean(model?.enabled));
    const selected = candidates.find((model) => model.class === 'free' || model.approvedForPaidUse);
    const inputTokens = clamp(Number(input.estimatedContextTokens || Math.ceil(input.prompt.length / 4)), 0, 10_000_000);
    const estimatedCostUsd = selected ? (inputTokens * selected.promptUsdPerMillion + 2_000 * selected.completionUsdPerMillion) / 1_000_000 : 0;
    const today = this.todayStats();
    const paid = selected?.class === 'paid';
    const budgetBlocked = Boolean(paid && (estimatedCostUsd > this.data.policy.budget.maxUsdPerTask || today.spentUsd + estimatedCostUsd > this.data.policy.budget.maxUsdPerDay || today.paidRuns >= this.data.policy.budget.maxPaidRunsPerDay));
    const paidThresholdBlocked = Boolean(paid && classified.complexity < this.data.policy.paidEscalationComplexity);
    const approval = Boolean(paid && estimatedCostUsd >= this.data.policy.budget.requireApprovalAboveUsd);
    const blocked = !selected || Boolean(paid && !selected.approvedForPaidUse) || budgetBlocked || paidThresholdBlocked;
    return {
      id: crypto.randomUUID(), createdAt: now(), botId: bot?.id || 'default', category: classified.category, complexity: classified.complexity,
      reasons: [...classified.reasons, rule ? `Matched rule: ${rule.name}` : 'Used the bot default pool'], selectedPoolId: pool?.id,
      selectedModel: selected, alternativeModelIds: candidates.slice(1).map((model) => model.id), estimatedCostUsd, paid: Boolean(paid), blocked,
      requiresApproval: approval,
      message: blocked ? (budgetBlocked ? 'Paid routing is blocked by the configured budget.' : paidThresholdBlocked ? `Paid routing is blocked below complexity ${this.data.policy.paidEscalationComplexity}.` : 'No enabled and approved model is available in the selected pool.') : paid ? `Approved paid escalation to ${selected.label}.` : `Free-first route to ${selected.label}.`,
    };
  }

  async createBot(input: CreateHermesBotInput): Promise<HermesBotDefinition> {
    const profile = String(input.profile || '').trim().toLowerCase();
    if (!PROFILE_ID.test(profile) || profile === 'default') throw new Error('Profile IDs must be 2–31 lowercase letters, numbers, or hyphens and cannot be default.');
    if (this.data.bots.some((bot) => bot.profile === profile)) throw new Error('A bot with that Hermes profile already exists.');
    const name = String(input.name || '').trim().slice(0, 100);
    const description = String(input.description || '').trim().slice(0, 500);
    if (!name || !description) throw new Error('Bot name and description are required.');
    if (!this.data.policy.pools.some((pool) => pool.id === input.defaultPoolId)) throw new Error('Select a valid default model pool.');
    const skills = Array.from(new Set(input.skills || [])).filter((skill) => SAFE_SKILL.test(skill)).slice(0, 30);
    const cloneFrom = PROFILE_ID.test(String(input.cloneFrom || 'default')) ? String(input.cloneFrom || 'default') : 'default';
    const created = await this.run(['profile', 'create', profile, '--clone-from', cloneFrom, '--description', description], 2 * 60_000);
    if (!created.success) throw new Error(`Hermes could not create the profile: ${created.output}`);
    const pool = this.data.policy.pools.find((item) => item.id === input.defaultPoolId)!;
    const model = pool.modelIds.map((id) => this.data.policy.models.find((item) => item.id === id)).find((item) => item?.enabled);
    if (model) {
      const providerConfigured = await this.run(['-p', profile, 'config', 'set', 'model.provider', model.provider], 30_000);
      const modelConfigured = await this.run(['-p', profile, 'config', 'set', 'model.default', model.model], 30_000);
      if (!providerConfigured.success || !modelConfigured.success) {
        throw new Error(`Hermes created profile “${profile}”, but its model configuration failed. Open Hermes profiles to finish setup. ${providerConfigured.output} ${modelConfigured.output}`.trim());
      }
    }
    const timestamp = now();
    const bot: HermesBotDefinition = { id: profile, profile, name, description, defaultPoolId: input.defaultPoolId, skills, enabled: true, nativeProfileDetected: true, createdAt: timestamp, updatedAt: timestamp };
    this.data.bots.push(bot);
    this.save();
    return bot;
  }

  private async fetchCatalog(): ReturnType<RouterCatalogFetcher> {
    if (this.injectedCatalogFetcher) return this.injectedCatalogFetcher();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal, headers: { 'User-Agent': 'Hermes-Hub-Smart-Router' } });
      if (!response.ok) throw new Error(`OpenRouter catalog returned HTTP ${response.status}.`);
      const payload = await response.json() as { data?: Array<{ id?: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }> };
      return (payload.data || []).filter((item) => item.id).map((item) => ({ id: item.id!, name: item.name || item.id!, contextLength: Number(item.context_length || 0), promptUsdPerMillion: Number(item.pricing?.prompt || 0) * 1_000_000, completionUsdPerMillion: Number(item.pricing?.completion || 0) * 1_000_000 }));
    } finally { clearTimeout(timer); }
  }

  async refreshCatalog(): Promise<SmartRouterState> {
    try {
      const entries = await this.fetchCatalog();
      const lookup = new Map(entries.map((entry) => [entry.id.toLowerCase(), entry]));
      const checkedAt = now();
      this.data.policy.models = this.data.policy.models.map((model) => {
        if (model.provider !== 'openrouter') return model;
        const entry = lookup.get(model.model.toLowerCase());
        if (!entry) return model;
        const modelClass = entry.promptUsdPerMillion === 0 && entry.completionUsdPerMillion === 0 ? 'free' : 'paid';
        return { ...model, label: entry.name, contextLength: entry.contextLength, promptUsdPerMillion: entry.promptUsdPerMillion, completionUsdPerMillion: entry.completionUsdPerMillion, class: modelClass, approvedForPaidUse: modelClass === 'paid' ? model.approvedForPaidUse : false, catalogCheckedAt: checkedAt };
      });
      this.data.catalog = { state: 'current', checkedAt, message: `${entries.length} live OpenRouter models checked. Configured prices and free status were refreshed.` };
      this.data.policy.updatedAt = checkedAt;
      this.save();
    } catch (error) {
      this.data.catalog = { ...this.data.catalog, state: 'offline', message: error instanceof Error ? error.message : 'The live model catalog is unavailable.' };
      this.save();
    }
    return this.getState();
  }

  async execute(input: RouterExecutionInput): Promise<RouterExecutionRecord> {
    if (input.confirmed !== true) throw new Error('Running a routed Hermes task requires explicit confirmation.');
    const decision = this.simulate(input);
    const bot = this.data.bots.find((item) => item.id === decision.botId);
    if (!bot || !bot.nativeProfileDetected) throw new Error('The selected Hermes bot profile is unavailable.');
    if (decision.blocked || !decision.selectedModel) throw new Error(decision.message);
    const model = decision.selectedModel;
    if (model.class === 'paid' && !model.approvedForPaidUse) throw new Error('The selected paid model is not approved.');
    const usagePath = path.join(path.dirname(this.storageFile), `usage-${crypto.randomUUID()}.json`);
    const args = ['-p', bot.profile, '-z', input.prompt.trim(), '--usage-file', usagePath, '-m', model.model, '--provider', model.provider];
    if (bot.skills.length) args.push('--skills', bot.skills.join(','));
    const result = await this.run(args, 30 * 60_000);
    let usage: Record<string, unknown> = {};
    try { if (fs.existsSync(usagePath)) usage = JSON.parse(fs.readFileSync(usagePath, 'utf8')) as Record<string, unknown>; } catch {}
    try { if (fs.existsSync(usagePath)) fs.unlinkSync(usagePath); } catch {}
    const numberFrom = (...keys: string[]) => keys.map((key) => Number(usage[key])).find((value) => Number.isFinite(value)) || 0;
    const actualCostUsd = numberFrom('estimated_cost_usd', 'cost_usd', 'cost', 'total_cost');
    const record: RouterExecutionRecord = {
      id: crypto.randomUUID(), createdAt: now(), botId: bot.id, profile: bot.profile, promptPreview: input.prompt.trim().slice(0, 240), decision,
      status: result.success ? 'success' : 'failed', actualCostUsd, inputTokens: numberFrom('input_tokens', 'prompt_tokens') || undefined,
      outputTokens: numberFrom('output_tokens', 'completion_tokens') || undefined, output: result.output.slice(0, 30_000),
    };
    this.data.history.unshift(record);
    this.data.history = this.data.history.slice(0, 250);
    this.save();
    return record;
  }
}
