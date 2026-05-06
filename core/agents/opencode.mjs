/**
 * OpenCode agent adapter — ACP stdio primary.
 *
 * Primary: `opencode` binary with ACP stdio (native support)
 * No native/HTTP fallback: production invocations must stay inside ACP.
 *
 * Availability probe fails loud: "opencode ACP stdio unavailable.
 * Start HTTP fallback with: opencode serve &"
 */

import { AgentAdapter } from './base.mjs';
import { AcpClient } from './acp-client.mjs';
import { buildAgentEnv } from '../env.mjs';

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
      const r = spawnSync('opencode', ['--version'], { encoding: 'utf8', timeout: 5000, env: buildAgentEnv() });
      if (r.status === 0) {
        return { available: true, transport: 'acp' };
      }
      return {
        available: false,
        reason: 'opencode ACP stdio unavailable',
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

    if (availability.transport !== 'acp') {
      return { output: '', error: availability.reason ?? 'opencode ACP unavailable', exitCode: 1, structured: null, transport: 'acp' };
    }
    try {
      return await this._invokeAcp({ prompt, model, structuredSchema, timeout, onProgress, resumeSessionId, mode });
    } catch (e) {
      return { output: '', error: `opencode ACP invocation failed: ${e.message}`, exitCode: 1, structured: null, transport: 'acp' };
    }
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

}
