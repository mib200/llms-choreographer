/**
 * Codex agent adapter — ACP stdio via Zed's codex-acp adapter.
 *
 * Primary: ACP stdio via `codex` binary with ACP stdio transport
 * No native/app-server fallback: production invocations must stay inside ACP.
 * Council mandate: uniform client-side validation for all agents.
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient } from './acp-client.mjs';
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

    if (availability.transport !== 'acp') {
      return { output: '', error: availability.reason ?? 'codex ACP unavailable', exitCode: 1, structured: null, transport: 'acp' };
    }
    try {
      return await this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId });
    } catch (e) {
      return { output: '', error: `codex ACP invocation failed: ${e.message}`, exitCode: 1, structured: null, transport: 'acp' };
    }
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

}
