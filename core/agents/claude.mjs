/**
 * Claude agent adapter — ACP stdio via @agentclientprotocol/claude-agent-acp.
 *
 * Primary: ACP stdio via `@agentclientprotocol/claude-agent-acp` (wraps Claude CLI)
 * Fallback A: `@anthropic-ai/claude-agent-sdk` programmatic API
 * Fallback B: CLI subprocess `claude --print --output-format stream-json`
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient, parseStructured } from './acp-client.mjs';
import { spawn } from 'node:child_process';
import { parseClaudeStreamJson } from '../parsers.mjs';

export class ClaudeAdapter extends AgentAdapter {
  get name() { return 'claude'; }

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
    // Try ACP stdio first
    try {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('npx', ['@agentclientprotocol/claude-agent-acp', '--version'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      if (r.status === 0) {
        return { available: true, transport: 'acp' };
      }
    } catch { /* fall through */ }

    // Fallback: check if claude CLI is available
    try {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0) {
        return { available: true, transport: 'native', reason: 'ACP stdio unavailable, using CLI fallback' };
      }
      return { available: false, reason: 'claude CLI not found', setupCommand: '/choreo:claude' };
    } catch (e) {
      return { available: false, reason: e.message, setupCommand: '/choreo:claude' };
    }
  }

  async invoke({ prompt, model, effort, structuredSchema, timeout, onProgress, sandbox, resumeSessionId, mode }) {
    const availability = await this.checkAvailability();

    if (availability.transport === 'acp') {
      return this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode });
    }

    // Native fallback: CLI subprocess
    return this._invokeNative({ prompt, model, effort, structuredSchema, timeout });
  }

  async _invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode }) {
    const client = new AcpClient({
      binary: 'npx',
      acpArgs: ['@agentclientprotocol/claude-agent-acp'],
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

  async _invokeNative({ prompt, model, effort, structuredSchema, timeout }) {
    return new Promise((resolve) => {
      const args = ['--print', '--output-format', 'stream-json', '--verbose', prompt, '--dangerously-skip-permissions'];
      if (model) args.splice(0, 0, '--model', model);

      const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const out = [];
      const err = [];

      const timer = timeout ? setTimeout(() => { proc.kill('SIGTERM'); }, timeout) : null;

      proc.stdout.on('data', (d) => out.push(d));
      proc.stderr.on('data', (d) => err.push(d));
      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        const raw = Buffer.concat(out).toString();
        const output = parseClaudeStreamJson(raw);
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
