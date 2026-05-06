/**
 * Claude agent adapter — ACP stdio via @agentclientprotocol/claude-agent-acp.
 *
 * Primary: ACP stdio via `@agentclientprotocol/claude-agent-acp` (wraps Claude CLI)
 * No native CLI fallback: production invocations must stay inside ACP.
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient } from './acp-client.mjs';
import { buildAgentEnv } from '../env.mjs';

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
        env: buildAgentEnv(),
      });
      if (r.status === 0) {
        return { available: true, transport: 'acp' };
      }
    } catch { /* fall through */ }

    return { available: false, reason: 'claude ACP stdio unavailable', setupCommand: '/choreo:claude' };
  }

  async invoke({ prompt, model, effort, structuredSchema, timeout, onProgress, sandbox, resumeSessionId, mode }) {
    const availability = await this.checkAvailability();

    if (availability.transport !== 'acp') {
      return { output: '', error: availability.reason ?? 'claude ACP unavailable', exitCode: 1, structured: null, transport: 'acp' };
    }
    try {
      return await this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode });
    } catch (e) {
      return { output: '', error: `claude ACP invocation failed: ${e.message}`, exitCode: 1, structured: null, transport: 'acp' };
    }
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

}
