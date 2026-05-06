import { test } from 'node:test';
import assert from 'node:assert/strict';

test('lifecycle.mjs exports handleSessionStart and handleSessionEnd', async () => {
  const mod = await import('../runtime/lifecycle.mjs');
  assert.equal(typeof mod.handleSessionStart, 'function');
  assert.equal(typeof mod.handleSessionEnd, 'function');
});

test('handleSessionStart returns broker and sessionId', async () => {
  const { handleSessionStart } = await import('../runtime/lifecycle.mjs');
  const result = await handleSessionStart({ rootDir: process.cwd() });
  assert.ok(result.broker, 'returns broker');
  assert.ok(result.sessionId, 'returns sessionId');
  assert.ok(typeof result.sessionId === 'string');
  // Cleanup
  if (result.broker?.shutdown) await result.broker.shutdown();
});

test('handleSessionEnd does not throw on missing broker', async () => {
  const { handleSessionEnd } = await import('../runtime/lifecycle.mjs');
  // Should not throw even with a no-op broker
  await assert.doesNotReject(() => handleSessionEnd({ broker: { shutdown: async () => {} } }));
});
