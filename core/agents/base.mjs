/**
 * AgentAdapter — interface contract for all agent adapters.
 *
 * Each adapter implements ACP stdio as primary transport and falls back to
 * its native transport when ACP is unavailable.
 *
 * ACP SDK: @agentclientprotocol/sdk@0.21.0
 * ACP Claude: @agentclientprotocol/claude-agent-acp@0.32.0
 */

/**
 * @typedef {Object} AdapterCapabilities
 * @property {boolean} streaming
 * @property {boolean} structuredOutput
 * @property {boolean} sessionResume
 * @property {boolean} cancellation
 * @property {boolean} background
 * @property {boolean} modeSwitching
 * @property {boolean} mcpInjection
 */

/**
 * @typedef {Object} InvokeOptions
 * @property {string} prompt
 * @property {string} [model]
 * @property {string} [effort]
 * @property {object} [structuredSchema] — JSON schema for structured output
 * @property {number} [timeout] — ms timeout for the prompt turn
 * @property {function} [onProgress] — (update) => void for streaming updates
 * @property {string} [sandbox] — sandbox mode ('read-only' | 'workspace-write' | 'danger-full-access')
 * @property {string} [resumeSessionId] — session ID to resume
 * @property {string} [mode] — agent mode ('ask' | 'architect' | 'code')
 */

/**
 * @typedef {Object} InvokeResult
 * @property {string} output
 * @property {string} [error]
 * @property {number} [exitCode]
 * @property {boolean} [structured] — true if output was parsed as structured JSON
 * @property {string} [sessionId]
 * @property {'acp'|'native'} transport — which transport was actually used
 */

/**
 * @typedef {Object} AvailabilityResult
 * @property {boolean} available
 * @property {'acp'|'native'} [transport]
 * @property {string} [reason]
 * @property {string} [setupCommand]
 */

/**
 * Abstract base class for agent adapters.
 * Subclasses must implement invoke() and checkAvailability().
 */
export class AgentAdapter {
  /** @returns {string} — agent name (claude, codex, opencode, gemini) */
  get name() { throw new Error('not implemented'); }

  /** @returns {AdapterCapabilities} */
  get supports() {
    return {
      streaming: false,
      structuredOutput: false,
      sessionResume: false,
      cancellation: false,
      background: false,
      modeSwitching: false,
      mcpInjection: false,
    };
  }

  /**
   * @param {InvokeOptions} options
   * @returns {Promise<InvokeResult>}
   */
  async invoke(options) { throw new Error('not implemented'); }

  /**
   * @returns {Promise<AvailabilityResult>}
   */
  async checkAvailability() { throw new Error('not implemented'); }
}
