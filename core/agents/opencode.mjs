/**
 * OpenCode agent adapter — ACP stdio primary.
 *
 * Primary: `opencode` binary with ACP stdio (native support)
 * Fallback: `opencode serve` HTTP API + SSE (invoked only when ACP stdio unavailable)
 *
 * Availability probe fails loud: "opencode ACP stdio unavailable.
 * Start HTTP fallback with: opencode serve &"
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient, parseStructured } from './acp-client.mjs';
import { spawn } from 'node:child_process';

export class OpenCodeAdapter extends AgentAdapter {
  get name() { return 'opencode'; }

  get supports() {
    return {
      streaming: true,
      structuredOutput: true,
      sessionResume: true,
      cancellation: true,
      background: false,
      modeSwitching: true,
      mcpInjection: true,
    };
  }

  async checkAvailability() {
    try {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('opencode', ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0) {
        return { available: true, transport: 'acp' };
      }
      return {
        available: false,
        reason: 'opencode ACP stdio unavailable. Start HTTP fallback with: opencode serve &',
        setupCommand: '/choreo:opencode',
      };
    } catch (e) {
      return {
        available: false,
        reason: e.message,
        setupCommand: '/choreo:opencode',
      };
    }
  }

  async invoke({ prompt, model, effort, structuredSchema, timeout, onProgress, sandbox, resumeSessionId, mode }) {
    const availability = await this.checkAvailability();

    if (availability.transport === 'acp') {
      return this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode });
    }

    // Native fallback: opencode run
    return this._invokeNative({ prompt, model, structuredSchema, timeout });
  }

  async _invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode }) {
    const client = new AcpClient({
      binary: 'opencode',
      acpArgs: [], // opencode speaks ACP stdio natively
      interactive: false,
      onUpdate: onProgress,
    });

    try {
      await client.initialize();
      if (resumeSessionId) {
        await client.resumeSession(resumeSessionId);
      } else {
        const sessionParams = {};
        if (mode) sessionParams.mode = mode;
        await client.newSession(sessionParams);
      }

      const result = await client.prompt({ prompt, structuredSchema, timeout });
      return result;
    } finally {
      await client.teardown();
    }
  }

  async _invokeNative({ prompt, model, structuredSchema, timeout }) {
    return new Promise((resolve) => {
      const args = ['run', prompt, '--dangerously-skip-permissions'];
      if (model) args.splice(1, 0, '--model', model);

      const proc = spawn('opencode', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const out = [];
      const err = [];

      const timer = timeout ? setTimeout(() => { proc.kill('SIGTERM'); }, timeout) : null;

      proc.stdout.on('data', (d) => out.push(d));
      proc.stderr.on('data', (d) => err.push(d));
      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        const raw = Buffer.concat(out).toString();
        // Strip ANSI codes and progress lines
        const output = raw
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
          .split('\n')
          .filter((l) => l.trim())
          .join('\n')
          .trim();
        let structured = null;
        if (structuredSchema) {
          const { parsed, valid } = parseStructured(output, structuredSchema);
          if (valid) structured = parsed;
        }
        resolve({ output, error: Buffer.concat(err).toString().trim(), exitCode: code ?? 1, structured, transport: 'native' });
      });
      proc.on('error', (e) => {
        if (timer) clearTimeout(timer);
        resolve({ output: '', error: e.message, exitCode: 1, transport: 'native' });
      });
    });
  }
}
