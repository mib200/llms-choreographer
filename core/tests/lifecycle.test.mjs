import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  await assert.doesNotReject(() => handleSessionEnd());
});

test('lifecycle env file records only live session state', async () => {
  const { handleSessionStart, handleSessionEnd } = await import('../runtime/lifecycle.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'choreo-lifecycle-test-'));
  const envFile = join(dir, 'env');
  writeFileSync(envFile, 'EXISTING=1\nCHOREO_BROKER_ENDPOINT=stale\nCHOREO_SESSION_ID=stale\n');
  const result = await handleSessionStart({ envFile });
  try {
    const started = readFileSync(envFile, 'utf8');
    assert.match(started, /EXISTING=1/);
    assert.match(started, /CHOREO_SESSION_ID=/);
    assert.doesNotMatch(started, /CHOREO_BROKER_ENDPOINT=/);
    await handleSessionEnd({ broker: result.broker, envFile });
    const ended = readFileSync(envFile, 'utf8');
    assert.match(ended, /EXISTING=1/);
    assert.doesNotMatch(ended, /CHOREO_SESSION_ID=/);
    assert.doesNotMatch(ended, /CHOREO_BROKER_ENDPOINT=/);
  } finally {
    await result.broker?.shutdown?.();
    rmSync(dir, { recursive: true, force: true });
  }
});
