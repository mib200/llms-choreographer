import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('endpoint.mjs exports createEndpoint and resolveEndpointPath', async () => {
  const mod = await import('../runtime/endpoint.mjs');
  assert.equal(typeof mod.createEndpoint, 'function');
  assert.equal(typeof mod.resolveEndpointPath, 'function');
});

test('resolveEndpointPath returns platform-appropriate path', async () => {
  const { resolveEndpointPath } = await import('../runtime/endpoint.mjs');
  const path = resolveEndpointPath('test-session');
  assert.ok(typeof path === 'string');
  assert.ok(path.length > 0);
  assert.match(path, /test-session/);
});

test('resolveEndpointPath includes tmp directory', async () => {
  const { resolveEndpointPath } = await import('../runtime/endpoint.mjs');
  const path = resolveEndpointPath('abc123');
  // Should be in a temp-like directory
  assert.ok(path.includes('tmp') || path.includes('TMPDIR') || path.includes('choreo'));
});
