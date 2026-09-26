import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import type { HermesBoosterActionResult, HermesBoosterStatus, HermesPluginInfo } from '@hermes-hub/types';
import type { HermesService } from '@hermes-hub/agent';
import { redactSecrets } from '@hermes-hub/shared';

export type HermesCommandResult = { success: boolean; output: string };
export type HermesCommandRunner = (args: string[], timeout: number) => Promise<HermesCommandResult>;

export class HermesBoosterService {
  constructor(private readonly hermesService: HermesService, private readonly runner?: HermesCommandRunner) {}

  private async command(): Promise<{ file: string; prefixArgs: string[] }> {
    const installation = await this.hermesService.detect();
    if (!installation) throw new Error('Hermes is not installed or its home folder is not configured.');
    const launcher = installation.executablePath;
    if (launcher && fs.existsSync(launcher)) {
      if (path.extname(launcher).toLowerCase() === '.cmd') {
        return { file: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', prefixArgs: ['/d', '/s', '/c', launcher] };
      }
      if (path.extname(launcher).toLowerCase() === '.exe') return { file: launcher, prefixArgs: [] };
    }

    const installsRoot = path.join(installation.homePath, 'installs');
    if (fs.existsSync(installsRoot)) {
      for (const installId of fs.readdirSync(installsRoot)) {
        const environments = path.join(installsRoot, installId, 'environments');
        if (!fs.existsSync(environments)) continue;
        for (const environmentId of fs.readdirSync(environments)) {
          const candidate = path.join(environments, environmentId, 'venv', 'Scripts', 'hermes.exe');
          if (fs.existsSync(candidate)) return { file: candidate, prefixArgs: [] };
        }
      }
    }
    throw new Error('Hermes was detected, but a safe executable could not be located.');
  }

  private async run(args: string[], timeout = 60_000): Promise<HermesCommandResult> {
    if (this.runner) {
      const result = await this.runner([...args], timeout);
      return { ...result, output: redactSecrets(result.output) };
    }
    const command = await this.command();
    return new Promise((resolve) => {
      execFile(command.file, [...command.prefixArgs, ...args], { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        const raw = [stdout, stderr].filter(Boolean).join('\n').trim();
        resolve({ success: !error, output: redactSecrets(raw || error?.message || 'No output returned.') });
      });
    });
  }

  private parsePlugins(output: string): HermesPluginInfo[] {
    try {
      const parsed = JSON.parse(output) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((plugin): HermesPluginInfo => ({
        name: String(plugin.name || ''),
        status: String(plugin.status || '').toLowerCase() === 'enabled' ? 'enabled' : 'disabled',
        version: String(plugin.version || 'unknown'),
        description: String(plugin.description || ''),
        source: String(plugin.source || 'unknown'),
      })).filter((plugin) => plugin.name);
    } catch {
      return [];
    }
  }

  private parseMcpNames(output: string): string[] {
    return output.split(/\r?\n/)
      .map((line) => line.match(/^\s{2}([a-z0-9._-]+)\s{2,}/i)?.[1])
      .filter((name): name is string => Boolean(name) && name !== 'Name');
  }

  async getStatus(): Promise<HermesBoosterStatus> {
    const status = await this.hermesService.getStatus();
    if (!status.isInstalled) {
      return {
        checkedAt: new Date().toISOString(), available: false,
        health: { state: 'unavailable', passed: 0, warnings: 0, errors: 1, summary: 'Hermes is not installed.', report: '' },
        extensions: { skillsSummary: '', skillUpdates: '', plugins: [], pluginUpdates: '', mcpSummary: '', mcpServers: 0, mcpNames: [], toolsSummary: '', enabledTools: 0, disabledTools: 0, skillSync: '' },
        update: { currentVersion: 'unknown', available: false, checkSucceeded: false, summary: 'Hermes is unavailable.', plan: '' },
        insights: '',
      };
    }

    const [doctor, plugins, pluginUpdates, mcp, tools, skills, skillUpdates, skillSync, update, plan, insights, version] = await Promise.all([
      this.run(['doctor']),
      this.run(['plugins', 'list', '--json']),
      this.run(['plugins', 'check-updates', '--json']),
      this.run(['mcp', 'list']),
      this.run(['tools', 'list']),
      this.run(['skills', 'list']),
      this.run(['skills', 'check']),
      this.run(['sync', 'status']),
      this.run(['update', '--check']),
      this.run(['update', '--plan']),
      this.run(['insights', '--days', '30']),
      this.run(['--version']),
    ]);
    const passed = (doctor.output.match(/✓/g) || []).length;
    const warnings = (doctor.output.match(/⚠/g) || []).length;
    const errors = (doctor.output.match(/(?:✗|ERROR|FAILED)/gi) || []).length;
    const doctorCompleted = /Hermes Doctor|Found \d+ issue\(s\)/i.test(doctor.output);
    const updateText = `${version.output}\n${update.output}\n${plan.output}`;
    const updateAvailable = /update available|commits? behind|behind .*upstream/i.test(updateText) && !/up to date|already current/i.test(updateText);
    const detectedVersion = version.output.match(/Hermes Agent v([^\s]+)/i)?.[1] || status.version;

    return {
      checkedAt: new Date().toISOString(), available: true,
      health: {
        state: !doctorCompleted || errors ? 'error' : warnings || !doctor.success ? 'warning' : 'healthy',
        passed, warnings, errors,
        summary: !doctorCompleted ? 'Hermes Doctor could not complete.' : `${passed} checks passed, ${warnings} warnings, ${errors} errors.`,
        report: doctor.output,
      },
      extensions: {
        skillsSummary: skills.output,
        skillUpdates: skillUpdates.output,
        plugins: this.parsePlugins(plugins.output),
        pluginUpdates: pluginUpdates.output,
        mcpSummary: mcp.output,
        mcpServers: (mcp.output.match(/✓\s+enabled/g) || []).length,
        mcpNames: this.parseMcpNames(mcp.output),
        toolsSummary: tools.output,
        enabledTools: (tools.output.match(/✓\s+enabled/g) || []).length,
        disabledTools: (tools.output.match(/✗\s+disabled/g) || []).length,
        skillSync: skillSync.output,
      },
      update: { currentVersion: detectedVersion, available: updateAvailable, checkSucceeded: update.success, summary: `${version.output}\n\n${update.output}`, plan: plan.output },
      insights: insights.output,
    };
  }

  async runDoctor(): Promise<HermesBoosterActionResult> {
    const result = await this.run(['doctor']);
    const completed = /Hermes Doctor|Found \d+ issue\(s\)/i.test(result.output);
    return { success: completed, message: completed ? (result.success ? 'Hermes Doctor completed.' : 'Hermes Doctor completed with items requiring attention.') : 'Hermes Doctor could not complete.', output: result.output };
  }

  async updateHermes(): Promise<HermesBoosterActionResult> {
    const result = await this.run(['update', '--yes', '--backup', '--keep-stash'], 20 * 60_000);
    this.hermesService.invalidateDetectionCache();
    return { success: result.success, message: result.success ? 'Hermes updated successfully.' : 'Hermes update did not complete. Review the output for blockers.', output: result.output };
  }

  async updateSkills(): Promise<HermesBoosterActionResult> {
    const result = await this.run(['skills', 'update'], 10 * 60_000);
    return { success: result.success, message: result.success ? 'Hermes skills were checked and updated.' : 'Skill updates did not complete.', output: result.output };
  }

  async syncSkills(): Promise<HermesBoosterActionResult> {
    const result = await this.run(['sync', 'now'], 10 * 60_000);
    return { success: result.success, message: result.success ? 'Hermes skill sync completed.' : 'Hermes skill sync did not complete.', output: result.output };
  }

  async setPluginEnabled(name: string, enabled: boolean): Promise<HermesBoosterActionResult> {
    const plugin = this.parsePlugins((await this.run(['plugins', 'list', '--json'])).output).find((item) => item.name === name);
    if (!plugin) throw new Error('The selected plugin is not installed in Hermes.');
    const result = await this.run(['plugins', enabled ? 'enable' : 'disable', name]);
    return { success: result.success, message: result.success ? `${name} ${enabled ? 'enabled' : 'disabled'}.` : `${name} could not be changed.`, output: result.output };
  }

  async updatePlugin(name: string): Promise<HermesBoosterActionResult> {
    const plugin = this.parsePlugins((await this.run(['plugins', 'list', '--json'])).output).find((item) => item.name === name);
    if (!plugin) throw new Error('The selected plugin is not installed in Hermes.');
    const result = await this.run(['plugins', 'update', name], 10 * 60_000);
    return { success: result.success, message: result.success ? `${name} updated.` : `${name} could not be updated.`, output: result.output };
  }

  async testMcp(name: string): Promise<HermesBoosterActionResult> {
    const mcpNames = this.parseMcpNames((await this.run(['mcp', 'list'])).output);
    if (!mcpNames.includes(name)) throw new Error('The selected MCP server is not configured in Hermes.');
    const result = await this.run(['mcp', 'test', name], 2 * 60_000);
    return { success: result.success, message: result.success ? `${name} MCP connection passed.` : `${name} MCP connection failed.`, output: result.output };
  }

  async openHermesApp(): Promise<boolean> {
    const command = await this.command();
    const child = spawn(command.file, [...command.prefixArgs, 'desktop'], { detached: true, windowsHide: false, stdio: 'ignore' });
    child.unref();
    return true;
  }
}
