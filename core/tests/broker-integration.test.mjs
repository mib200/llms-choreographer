import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Broker } from '../runtime/broker.mjs';
import { AgentAdapter } from '../agents/base.mjs';

class FakeAdapter extends AgentAdapter {
  constructor(name, { shouldFail = false, delay = 0, output = 'ok' } = {}) {
    super();
    this._name = name;
    this.shouldFail = shouldFail;
    this.delay = delay;
    this.output = output;
    this.invocations = [];
  }

  get name() { return this._name; }

  async invoke({ prompt, model }) {
    this.invocations.push({ prompt, model });
    if (this.delay) await new Promise((r) => setTimeout(r, this.delay));
    if (this.shouldFail) throw new Error(`${this._name} failed`);
    return { output: this.output, transport: 'native', exitCode: 0 };
  }

  async checkAvailability() {
    return { available: !this.shouldFail, transport: 'native' };
  }
}

test('Broker.invoke: successful invocation records success', async () => {
  const broker = new Broker();
  const adapter = new FakeAdapter('test-agent');
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  const result = await broker.invoke({ agentName: 'test-agent', prompt: 'hello' });
  assert.equal(result.output, 'ok');
  assert.equal(result.transport, 'native');
  assert.equal(broker.getCircuitBreakerState('test-agent'), 'closed');
  assert.equal(adapter.invocations.length, 1);
});

test('Broker.invoke: idempotency key returns cached result', async () => {
  const broker = new Broker();
  const adapter = new FakeAdapter('test-agent');
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  const r1 = await broker.invoke({ agentName: 'test-agent', prompt: 'hello', idempotencyKey: 'k1' });
  const r2 = await broker.invoke({ agentName: 'test-agent', prompt: 'hello', idempotencyKey: 'k1' });

  assert.strictEqual(r1, r2);
  assert.equal(adapter.invocations.length, 1);
});

test('Broker.invoke: different idempotency keys invoke separately', async () => {
  const broker = new Broker();
  const adapter = new FakeAdapter('test-agent');
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  await broker.invoke({ agentName: 'test-agent', prompt: 'a', idempotencyKey: 'k1' });
  await broker.invoke({ agentName: 'test-agent', prompt: 'b', idempotencyKey: 'k2' });

  assert.equal(adapter.invocations.length, 2);
});

test('Broker.invoke: adapter failure records failure and adds to DLQ', async () => {
  const broker = new Broker();
  const adapter = new FakeAdapter('test-agent', { shouldFail: true });
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  await assert.rejects(
    broker.invoke({ agentName: 'test-agent', prompt: 'fail' }),
    /test-agent failed/
  );

  const dlq = broker.getDlq();
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].agentName, 'test-agent');
  assert.equal(dlq[0].reason, 'invocation_failure');
});

test('Broker.invoke: circuit breaker trips after threshold failures', async () => {
  const broker = new Broker();
  const adapter = new FakeAdapter('test-agent', { shouldFail: true });
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  for (let i = 0; i < 5; i++) {
    await assert.rejects(broker.invoke({ agentName: 'test-agent', prompt: 'fail' }));
  }

  assert.equal(broker.getCircuitBreakerState('test-agent'), 'open');

  await assert.rejects(
    broker.invoke({ agentName: 'test-agent', prompt: 'blocked' }),
    /Circuit breaker open/
  );

  // Blocked call also goes to DLQ
  const dlq = broker.getDlq();
  assert.equal(dlq[dlq.length - 1].reason, 'circuit_breaker');
});

test('Broker.invoke: load queue enforces sequential processing', async () => {
  const broker = new Broker();
  const order = [];
  const adapter = new FakeAdapter('test-agent', { delay: 10 });
  adapter.invoke = async ({ prompt }) => {
    order.push(`start-${prompt}`);
    await new Promise((r) => setTimeout(r, 10));
    order.push(`end-${prompt}`);
    return { output: prompt, transport: 'native', exitCode: 0 };
  };
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  await Promise.all([
    broker.invoke({ agentName: 'test-agent', prompt: '1' }),
    broker.invoke({ agentName: 'test-agent', prompt: '2' }),
  ]);

  // Sequential: start-1 must complete before start-2 begins
  assert.equal(order[0], 'start-1');
  assert.equal(order[1], 'end-1');
  assert.equal(order[2], 'start-2');
  assert.equal(order[3], 'end-2');
});

test('Broker.invoke: unknown agent throws', async () => {
  const broker = new Broker();
  await broker.sessionStart('s1');

  await assert.rejects(
    broker.invoke({ agentName: 'nonexistent', prompt: 'hello' }),
    /Unknown agent: nonexistent/
  );
});

test('Broker.invoke: success after circuit breaker recovery', async () => {
  const broker = new Broker();
  let shouldFail = true;
  const adapter = new FakeAdapter('test-agent');
  adapter.invoke = async ({ prompt }) => {
    if (shouldFail) throw new Error('fail');
    return { output: 'recovered', transport: 'native', exitCode: 0 };
  };
  broker.registerAdapter('test-agent', adapter);
  await broker.sessionStart('s1');

  // Trip the breaker (threshold = 5)
  for (let i = 0; i < 5; i++) {
    await assert.rejects(broker.invoke({ agentName: 'test-agent', prompt: 'fail' }));
  }
  assert.equal(broker.getCircuitBreakerState('test-agent'), 'open');

  // Manually set lastFailureTime to past (simulate recovery timeout)
  const breaker = broker.circuitBreakers.get('test-agent');
  breaker.lastFailureTime = Date.now() - 61000;
  shouldFail = false;

  const result = await broker.invoke({ agentName: 'test-agent', prompt: 'probe' });
  assert.equal(result.output, 'recovered');
  assert.equal(broker.getCircuitBreakerState('test-agent'), 'closed');
});
