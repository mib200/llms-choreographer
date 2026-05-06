import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, LoadQueue, DeadLetterQueue } from '../runtime/broker.mjs';

test('CircuitBreaker: closed allows execution', () => {
  const cb = new CircuitBreaker();
  assert.equal(cb.state, 'closed');
  assert.equal(cb.canExecute(), true);
});

test('CircuitBreaker: trips to open after threshold failures', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.state, 'closed');
  cb.recordFailure();
  assert.equal(cb.state, 'open');
  assert.equal(cb.canExecute(), false);
});

test('CircuitBreaker: half-open probe failure returns to open', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 0 });
  // Trip to open
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.state, 'open');

  // Recovery timeout passes → half-open
  assert.equal(cb.canExecute(), true);
  assert.equal(cb.state, 'half-open');

  // Probe fails → back to open
  cb.recordFailure();
  assert.equal(cb.state, 'open');
});

test('CircuitBreaker: half-open probe success closes breaker', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 0 });
  cb.recordFailure();
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.canExecute(), true); // transitions to half-open
  assert.equal(cb.state, 'half-open');

  cb.recordSuccess();
  assert.equal(cb.state, 'closed');
  assert.equal(cb.failures, 0);
});

test('CircuitBreaker: manual trip', () => {
  const cb = new CircuitBreaker();
  cb.trip();
  assert.equal(cb.state, 'open');
  assert.equal(cb.canExecute(), false);
});

test('CircuitBreaker: recovery after timeout', () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 10 });
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.state, 'open');
  assert.equal(cb.canExecute(), false);

  // Wait for recovery
  const start = Date.now();
  while (Date.now() - start < 50) {
    if (cb.canExecute()) break;
  }
  assert.equal(cb.canExecute(), true);
  assert.equal(cb.state, 'half-open');
});

test('CircuitBreaker: success resets failure count in closed state', () => {
  const cb = new CircuitBreaker({ failureThreshold: 5 });
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.failures, 2);
  cb.recordSuccess();
  assert.equal(cb.failures, 0);
  assert.equal(cb.state, 'closed');
});

// ── LoadQueue tests ──────────────────────────────────────────────────────────

test('LoadQueue: processes items sequentially', async () => {
  const q = new LoadQueue();
  const results = [];
  const p1 = q.enqueue(async () => { results.push(1); return 1; });
  const p2 = q.enqueue(async () => { results.push(2); return 2; });
  const p3 = q.enqueue(async () => { results.push(3); return 3; });

  await Promise.all([p1, p2, p3]);
  assert.deepEqual(results, [1, 2, 3]);
});

test('LoadQueue: reports depth correctly', async () => {
  const q = new LoadQueue();
  let resolveFirst;
  const first = new Promise((r) => { resolveFirst = r; });

  const p1 = q.enqueue(async () => { await first; return 1; });
  const p2 = q.enqueue(async () => 2);
  const p3 = q.enqueue(async () => 3);

  assert.equal(q.depth, 2); // p2, p3 queued behind p1
  resolveFirst();
  await Promise.all([p1, p2, p3]);
  assert.equal(q.depth, 0);
});

test('LoadQueue: propagates errors without blocking queue', async () => {
  const q = new LoadQueue();
  const p1 = q.enqueue(async () => { throw new Error('fail'); });
  const p2 = q.enqueue(async () => 'ok');

  await assert.rejects(p1, /fail/);
  assert.equal(await p2, 'ok');
});

// ── DeadLetterQueue tests ────────────────────────────────────────────────────

test('DLQ: enqueues and drains messages', () => {
  const dlq = new DeadLetterQueue();
  dlq.enqueue({ error: 'e1' });
  dlq.enqueue({ error: 'e2' });
  assert.equal(dlq.size, 2);

  const drained = dlq.drain();
  assert.equal(drained.length, 2);
  assert.equal(dlq.size, 0);
});

test('DLQ: drops oldest when over maxSize', () => {
  const dlq = new DeadLetterQueue(2);
  dlq.enqueue({ error: 'e1' });
  dlq.enqueue({ error: 'e2' });
  dlq.enqueue({ error: 'e3' });
  assert.equal(dlq.size, 2);

  const drained = dlq.drain();
  assert.equal(drained[0].error, 'e2');
  assert.equal(drained[1].error, 'e3');
});
