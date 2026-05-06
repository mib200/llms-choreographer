/**
 * Codex agent adapter — ACP stdio via Zed's codex-acp adapter.
 *
 * Primary: ACP stdio via `codex` binary with ACP stdio transport
 * Fallback: `codex app-server` JSON-RPC over Unix socket
 *
 * Note: No auto-fallback to app-server for schema enforcement.
 * Council mandate: uniform client-side validation for all agents.
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient, parseStructured } from './acp-client.mjs';
import { spawn } from 'node:child_process';
import { buildAgentEnv } from '../env.mjs';

export class CodexAdapter extends AgentAdapter {
  get name() { return 'codex'; }

  get supports() {
    return {
      streaming: true,
      structuredOutput: true,
      sessionResume: true,
      cancellation: true,
      background: false,
      modeSwitching: false,
      mcpInjection: true,
    };
  }

  async checkAvailability() {
    try {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000, env: buildAgentEnv() });
      if (r.status === 0) {
        // Codex supports ACP stdio by default in recent versions
        return { available: true, transport: 'acp' };
      }
      return { available: false, reason: 'codex --version failed', setupCommand: '/choreo:codex' };
    } catch (e) {
      return { available: false, reason: e.message, setupCommand: '/choreo:codex' };
    }
  }

  async invoke({ prompt, model, effort, structuredSchema, timeout, onProgress, sandbox, resumeSessionId, mode }) {
    const availability = await this.checkAvailability();

    if (availability.transport === 'acp') {
      try {
        return await this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId });
      } catch { /* ACP failed — fall through to native */ }
    }

    return this._invokeNative({ prompt, model, effort, structuredSchema, timeout });
  }

  async _invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId }) {
    const client = new AcpClient({
      binary: 'codex',
      acpArgs: [], // codex speaks ACP stdio by default
      interactive: false,
      onUpdate: onProgress,
    });

    try {
      await client.initialize();
      if (resumeSessionId) {
        await client.resumeSession(resumeSessionId);
      } else {
        await client.newSession();
      }

      const result = await client.prompt({ prompt, structuredSchema, timeout });
      return result;
    } finally {
      await client.teardown();
    }
  }

  async _invokeNative({ prompt, model, effort, structuredSchema, timeout }) {
    return new Promise((resolve) => {
      const args = ['exec', prompt];
      if (model) args.splice(0, 0, '--model', model);
      if (effort) args.splice(0, 0, '--effort', effort);

      const proc = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildAgentEnv() });
      const out = [];
      const err = [];

      const timer = timeout ? setTimeout(() => { proc.kill('SIGTERM'); }, timeout) : null;

      proc.stdout.on('data', (d) => out.push(d));
      proc.stderr.on('data', (d) => err.push(d));
      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        const output = Buffer.concat(out).toString().trim();
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
