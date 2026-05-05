/**
 * Shared ACP client using @agentclientprotocol/sdk@0.21.0.
 *
 * Handles:
 * - Agent subprocess spawn with stdio transport
 * - initialize / authenticate handshake
 * - session/new / session/load / session/resume / session/close
 * - session/prompt with session/update streaming
 * - session/cancel
 * - Structured output parsing (client-side JSON validation against schema)
 * - Permission request handling: auto-deny in non-interactive contexts
 *
 * ACP SDK: @agentclientprotocol/sdk@0.21.0
 * ACP Claude: @agentclientprotocol/claude-agent-acp@0.32.0
 */

import { spawn } from 'node:child_process';
import { ClientSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';

/**
 * Build a Client handler that auto-denies permissions in non-interactive mode.
 *
 * @param {object} opts
 * @param {boolean} opts.interactive
 * @param {Set<string>} [opts.permissionAllowlist]
 * @param {function} [opts.onUpdate] — (notification) => void
 * @returns {function(agent): import('@agentclientprotocol/sdk').Client}
 */
function makeClientHandler({ interactive = false, permissionAllowlist = new Set(), onUpdate } = {}) {
  return (agent) => ({
    /**
     * Permission request handler.
     * Auto-deny in non-interactive contexts unless the tool is on the allowlist.
     */
    async requestPermission(params) {
      const toolName = params.tool_name ?? params.tool ?? 'unknown';
      if (interactive) {
        // In interactive mode, we'd prompt the user. For now, allow.
        return { outcome: 'allow' };
      }
      if (permissionAllowlist.has(toolName)) {
        return { outcome: 'allow' };
      }
      // Auto-deny: security posture for non-interactive contexts.
      return { outcome: 'deny' };
    },

    /** File system reads — return empty content (agent has its own cwd). */
    async readTextFile() {
      return { content: '' };
    },

    /** File system writes — no-op from client side. */
    async writeTextFile() {
      return {};
    },

    /** Terminal creation — not supported from client side. */
    async createTerminal() {
      throw new Error('terminal creation not supported from client');
    },

    /** Receive session updates from the agent. */
    async sessionUpdate(notification) {
      onUpdate?.(notification);
    },
  });
}

/**
 * Spawn an agent subprocess and return its stdio streams as ACP Stream.
 *
 * @param {string} binary
 * @param {string[]} args
 * @param {object} [env]
 * @returns {{proc: import('node:child_process').ChildProcess, stream: import('@agentclientprotocol/sdk').Stream}}
 */
function spawnAcpSubprocess(binary, args, env = process.env) {
  const proc = spawn(binary, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });

  // Node.js ReadableStream from subprocess stdout
  const stdoutStream = new ReadableStream({
    start(controller) {
      proc.stdout.on('data', (chunk) => controller.enqueue(chunk));
      proc.stdout.on('end', () => controller.close());
      proc.stdout.on('error', (err) => controller.error(err));
    },
  });

  // Node.js WritableStream to subprocess stdin
  const stdinStream = new WritableStream({
    write(chunk) {
      proc.stdin.write(chunk);
    },
    close() {
      proc.stdin.end();
    },
  });

  const stream = ndJsonStream(stdinStream, stdoutStream);
  return { proc, stream };
}

/**
 * Parse and validate structured output against a JSON schema.
 * Falls back to raw output if parsing fails (graceful degradation).
 *
 * @param {string} raw
 * @param {object} [schema]
 * @returns {{parsed: object|null, raw: string, valid: boolean}}
 */
export function parseStructured(raw, schema) {
  if (!schema) return { parsed: null, raw, valid: false };
  try {
    const parsed = JSON.parse(raw);
    // Basic schema validation: check required top-level keys
    if (schema.required && Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in parsed)) {
          return { parsed: null, raw, valid: false };
        }
      }
    }
    return { parsed, raw, valid: true };
  } catch {
    return { parsed: null, raw, valid: false };
  }
}

/**
 * AcpClient — manages a single ACP connection to an agent.
 */
export class AcpClient {
  /**
   * @param {object} opts
   * @param {string} opts.binary — agent binary path
   * @param {string[]} opts.acpArgs — args to spawn agent in ACP stdio mode
   * @param {object} [opts.env] — environment for subprocess
   * @param {boolean} [opts.interactive] — whether to prompt for permissions
   * @param {Set<string>} [opts.permissionAllowlist] — tools to auto-allow
   * @param {function} [opts.onUpdate] — (notification) => void for streaming
   */
  constructor({ binary, acpArgs, env, interactive = false, permissionAllowlist, onUpdate }) {
    this.binary = binary;
    this.acpArgs = acpArgs;
    this.env = env;
    this.interactive = interactive;
    this.permissionAllowlist = permissionAllowlist ?? new Set();
    this.onUpdate = onUpdate;
    this.connection = null;
    this.proc = null;
    this.sessionId = null;
  }

  /**
   * Spawn agent, initialize connection, and optionally authenticate.
   *
   * @param {object} [opts]
   * @param {object} [opts.capabilities] — client capabilities to advertise
   * @returns {Promise<import('@agentclientprotocol/sdk').schema.InitializeResponse>}
   */
  async initialize(opts = {}) {
    const { proc, stream } = spawnAcpSubprocess(this.binary, this.acpArgs, this.env);
    this.proc = proc;

    this.connection = new ClientSideConnection(
      makeClientHandler({
        interactive: this.interactive,
        permissionAllowlist: this.permissionAllowlist,
        onUpdate: this.onUpdate,
      }),
      stream,
    );

    const initResponse = await this.connection.initialize({
      protocolVersion: '2025-06-12',
      clientInfo: { name: 'choreographer', version: '1.0.0' },
      capabilities: opts.capabilities ?? {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: false,
      },
    });

    // Authenticate if required
    if (initResponse.authMethods && initResponse.authMethods.length > 0) {
      await this.connection.authenticate({
        methodId: initResponse.authMethods[0].id,
      });
    }

    return initResponse;
  }

  /**
   * Create a new session.
   *
   * @param {object} [params]
   * @returns {Promise<string>} sessionId
   */
  async newSession(params = {}) {
    const response = await this.connection.newSession({
      cwd: process.cwd(),
      ...params,
    });
    this.sessionId = response.sessionId;
    return response.sessionId;
  }

  /**
   * Resume an existing session.
   *
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async resumeSession(sessionId) {
    await this.connection.resumeSession({ sessionId });
    this.sessionId = sessionId;
  }

  /**
   * Send a prompt and wait for the response.
   *
   * @param {object} opts
   * @param {string} opts.prompt
   * @param {object} [opts.structuredSchema]
   * @param {number} [opts.timeout]
   * @returns {Promise<{output: string, structured?: object, sessionId: string, transport: 'acp'}>}
   */
  async prompt({ prompt, structuredSchema, timeout }) {
    if (!this.connection) throw new Error('not initialized');
    if (!this.sessionId) throw new Error('no active session');

    const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];

    const response = await this.connection.prompt({
      sessionId: this.sessionId,
      messages,
    });

    // Extract text from the response
    let output = '';
    if (response.output) {
      for (const block of response.output) {
        if (block.type === 'text') {
          output += block.text;
        }
      }
    }

    const result = { output: output.trim(), sessionId: this.sessionId, transport: 'acp' };

    if (structuredSchema) {
      const { parsed, valid } = parseStructured(output, structuredSchema);
      if (valid) {
        result.structured = parsed;
      }
    }

    return result;
  }

  /**
   * Cancel the current prompt turn.
   */
  async cancel() {
    if (this.connection && this.sessionId) {
      await this.connection.cancel({ sessionId: this.sessionId });
    }
  }

  /**
   * Close the current session.
   */
  async closeSession() {
    if (this.connection && this.sessionId) {
      try {
        await this.connection.closeSession({ sessionId: this.sessionId });
      } catch {
        // Session may already be closed — ignore.
      }
      this.sessionId = null;
    }
  }

  /**
   * Tear down the connection and kill the subprocess.
   */
  async teardown() {
    await this.closeSession();
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
    this.connection = null;
  }
}
