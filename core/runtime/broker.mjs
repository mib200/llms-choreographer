/**
 * Broker daemon — manages ACP connections, resilience, and event routing.
 *
 * Resilience (MANDATORY from day one):
 * - Dead-letter queue for failed messages
 * - Idempotency keys on all requests
 * - Circuit-breaker per adapter
 * - Load queue — sequential processing per agent
 *
 * Two pub/sub surfaces:
 * - broker.agents[name] — per-agent ACP client EventEmitter
 * - broker.events — internal orchestration events (buffered emit)
 *
 * Convention: snake_case for all event names.
 */

import { EventEmitter } from 'node:events';
import { ClaudeAdapter } from '../agents/claude.mjs';
import { CodexAdapter } from '../agents/codex.mjs';
import { OpenCodeAdapter } from '../agents/opencode.mjs';
import { emit } from '../observability.mjs';

// ── Circuit Breaker ──────────────────────────────────────────────────────────

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RECOVERY_TIMEOUT_MS = 60_000;

class CircuitBreaker {
  constructor({ failureThreshold = DEFAULT_FAILURE_THRESHOLD, recoveryTimeoutMs = DEFAULT_RECOVERY_TIMEOUT_MS } = {}) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed'; // closed | open | half-open
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  canExecute() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow one probe
    return true;
  }

  trip() {
    this.state = 'open';
    this.lastFailureTime = Date.now();
  }
}

// ── Dead-Letter Queue ────────────────────────────────────────────────────────

class DeadLetterQueue {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.messages = [];
  }

  enqueue(message) {
    this.messages.push({ ...message, enqueuedAt: Date.now() });
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }

  drain() {
    const msgs = [...this.messages];
    this.messages = [];
    return msgs;
  }

  get size() { return this.messages.length; }
}

// ── Load Queue ───────────────────────────────────────────────────────────────

class LoadQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processNext();
    });
  }

  async _processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.processing = false;
      this._processNext();
    }
  }

  get depth() { return this.queue.length; }
}

// ── Buffered EventEmitter ────────────────────────────────────────────────────

class BufferedEventEmitter extends EventEmitter {
  constructor({ bufferedEvents = new Set() } = {}) {
    super();
    this.bufferedEvents = bufferedEvents;
    this.buffers = new Map();
    this.drained = new Set();

    // Intercept addListener to drain buffers
    const origAddListener = this.addListener.bind(this);
    this.addListener = (event, listener) => {
      if (this.bufferedEvents.has(event) && !this.drained.has(event)) {
        const buffer = this.buffers.get(event) || [];
        for (const args of buffer) {
          listener(...args);
        }
        this.drained.add(event);
        this.buffers.delete(event);
      }
      return origAddListener(event, listener);
    };

    const origOn = this.on.bind(this);
    this.on = this.addListener;
  }

  emit(event, ...args) {
    if (this.bufferedEvents.has(event) && this.listenerCount(event) === 0) {
      if (!this.buffers.has(event)) this.buffers.set(event, []);
      this.buffers.get(event).push(args);
      return true;
    }
    return super.emit(event, ...args);
  }
}

// ── Broker ───────────────────────────────────────────────────────────────────

const BUFFERED_EVENTS = new Set([
  'builder_stop',
  'verifier_dispatch',
  'verifier_report',
  'lifecycle_session_start',
  'lifecycle_session_end',
]);

export class Broker {
  constructor() {
    /** @type {Map<string, EventEmitter>} */
    this.agents = new Map();
    /** @type {BufferedEventEmitter} */
    this.events = new BufferedEventEmitter({ bufferedEvents: BUFFERED_EVENTS });
    /** @type {Map<string, import('../agents/base.mjs').AgentAdapter>} */
    this.adapters = new Map();
    /** @type {Map<string, CircuitBreaker>} */
    this.circuitBreakers = new Map();
    /** @type {Map<string, LoadQueue>} */
    this.loadQueues = new Map();
    this.dlq = new DeadLetterQueue();
    /** @type {Map<string, any>} */
    this.idempotencyCache = new Map();
    this.sessionId = null;
  }

  /**
   * Register an adapter for an agent name.
   *
   * @param {string} name
   * @param {import('../agents/base.mjs').AgentAdapter} adapter
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    this.circuitBreakers.set(name, new CircuitBreaker());
    this.loadQueues.set(name, new LoadQueue());
  }

  /**
   * Initialize the broker for a session.
   * Disposes existing agents and recreates them.
   *
   * @param {string} sessionId
   */
  async sessionStart(sessionId) {
    this.sessionId = sessionId;

    // Dispose existing
    for (const [name] of this.agents) {
      this.agents.delete(name);
    }

    // Create per-agent EventEmitters
    for (const name of this.adapters.keys()) {
      this.agents.set(name, new EventEmitter());
    }

    this.events.emit('lifecycle_session_start', { session_id: sessionId, timestamp: Date.now() });
  }

  /**
   * Tear down the broker for a session.
   */
  async sessionEnd() {
    this.events.emit('lifecycle_session_end', { session_id: this.sessionId, timestamp: Date.now() });
    this.sessionId = null;
  }

  /**
   * Invoke an agent through the broker with resilience.
   *
   * @param {object} opts
   * @param {string} opts.agentName
   * @param {string} opts.prompt
   * @param {string} [opts.idempotencyKey]
   * @param {string} [opts.model]
   * @param {string} [opts.effort]
   * @param {object} [opts.structuredSchema]
   * @param {number} [opts.timeout]
   * @param {function} [opts.onProgress]
   * @param {string} [opts.resumeSessionId]
   * @param {string} [opts.mode]
   * @returns {Promise<import('../agents/base.mjs').InvokeResult>}
   */
  async invoke({ agentName, prompt, idempotencyKey, model, effort, structuredSchema, timeout, onProgress, resumeSessionId, mode }) {
    // Idempotency check
    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      return this.idempotencyCache.get(idempotencyKey);
    }

    const adapter = this.adapters.get(agentName);
    if (!adapter) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    // Circuit breaker check
    const breaker = this.circuitBreakers.get(agentName);
    if (!breaker.canExecute()) {
      const error = `Circuit breaker open for ${agentName}`;
      this.dlq.enqueue({ agentName, prompt, error, reason: 'circuit_breaker' });
      this._emitAgent(agentName, 'adapter_degraded', { agent_name: agentName, reason: 'circuit_breaker' });
      throw new Error(error);
    }

    // Load queue — sequential processing per agent
    const queue = this.loadQueues.get(agentName);
    const result = await queue.enqueue(async () => {
      try {
        const invokeResult = await adapter.invoke({
          prompt, model, effort, structuredSchema, timeout, onProgress, resumeSessionId, mode,
        });

        breaker.recordSuccess();
        this._emitAgent(agentName, 'session_update', { agent_name: agentName, type: 'completion', result: invokeResult });

        // Cache for idempotency
        if (idempotencyKey) {
          this.idempotencyCache.set(idempotencyKey, invokeResult);
        }

        // Observability
        try {
          emit({
            type: 'broker_invocation',
            agent_name: agentName,
            transport: invokeResult.transport,
            queue_depth: queue.depth,
            circuit_breaker_state: breaker.state,
          });
        } catch { /* observability must never block */ }

        return invokeResult;
      } catch (err) {
        breaker.recordFailure();
        this.dlq.enqueue({ agentName, prompt, error: err.message, reason: 'invocation_failure' });
        this._emitAgent(agentName, 'agent_error', { agent_name: agentName, error: err.message });

        if (breaker.state === 'open') {
          this._emitAgent(agentName, 'circuit_breaker_trip', { agent_name: agentName, failures: breaker.failures });
        }

        throw err;
      }
    });

    return result;
  }

  /**
   * Check availability of all registered adapters.
   *
   * @returns {Promise<Map<string, import('../agents/base.mjs').AvailabilityResult>>}
   */
  async checkAllAvailability() {
    const results = new Map();
    for (const [name, adapter] of this.adapters) {
      results.set(name, await adapter.checkAvailability());
    }
    return results;
  }

  /**
   * Get the adapter for an agent name.
   *
   * @param {string} name
   * @returns {import('../agents/base.mjs').AgentAdapter|undefined}
   */
  getAdapter(name) {
    return this.adapters.get(name);
  }

  /**
   * Emit an event on a per-agent channel.
   *
   * @param {string} agentName
   * @param {string} event
   * @param {object} payload
   */
  _emitAgent(agentName, event, payload) {
    const agentEmitter = this.agents.get(agentName);
    if (agentEmitter) {
      agentEmitter.emit(event, payload);
    }
  }

  /**
   * Get DLQ contents.
   */
  getDlq() {
    return this.dlq.drain();
  }

  /**
   * Get circuit breaker state for an agent.
   *
   * @param {string} name
   * @returns {string|undefined}
   */
  getCircuitBreakerState(name) {
    const breaker = this.circuitBreakers.get(name);
    return breaker?.state;
  }

  /**
   * Get load queue depth for an agent.
   *
   * @param {string} name
   * @returns {number}
   */
  getLoadQueueDepth(name) {
    const queue = this.loadQueues.get(name);
    return queue?.depth ?? 0;
  }

  /**
   * Shutdown the broker.
   */
  async shutdown() {
    await this.sessionEnd();
    this.adapters.clear();
    this.circuitBreakers.clear();
    this.loadQueues.clear();
    this.agents.clear();
    this.idempotencyCache.clear();
  }
}

/**
 * Create a broker with default adapters registered.
 *
 * @returns {Broker}
 */
export function createBroker() {
  const broker = new Broker();
  broker.registerAdapter('claude', new ClaudeAdapter());
  broker.registerAdapter('codex', new CodexAdapter());
  broker.registerAdapter('opencode', new OpenCodeAdapter());
  return broker;
}
