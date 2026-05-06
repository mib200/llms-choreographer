import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, unlinkSync, existsSync } from 'node:fs';
import { connect } from 'node:net';

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

test('resolveEndpointPath creates a private runtime directory', async (t) => {
  if (process.platform === 'win32') return;
  const { resolveEndpointPath } = await import('../runtime/endpoint.mjs');
  const path = resolveEndpointPath('private-dir');
  const dirMode = statSync(path.replace(/\/[^/]+$/, '')).mode & 0o777;
  assert.equal(dirMode, 0o700);
});

test('createEndpoint chmods socket 0600 and enforces token/method', async () => {
  if (process.platform === 'win32') return;
  const { createEndpoint } = await import('../runtime/endpoint.mjs');
  const { resolveEndpointPath } = await import('../runtime/endpoint.mjs');
  const path = resolveEndpointPath(`endpoint-test-${Date.now()}`);
  const received = [];
  const server = await createEndpoint({
    path,
    token: 'secret-token',
    onMessage(message, respond) {
      received.push(message);
      respond({ id: message.id, result: 'ok' });
    },
  });
  try {
    assert.equal(statSync(path).mode & 0o777, 0o600);
    const replies = await sendMessages(path, [
      { id: 1, method: 'ping' },
      { id: 2, token: 'bad', method: 'ping' },
      { id: 3, token: 'secret-token', method: 'ping' },
    ]);
    assert.deepEqual(replies.map((r) => r.error ?? r.result), ['unauthorized', 'unauthorized', 'ok']);
    assert.equal(received.length, 1);
  } finally {
    server.close();
    if (existsSync(path)) unlinkSync(path);
  }
});

function sendMessages(path, messages) {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    let buffer = '';
    const replies = [];
    socket.on('connect', () => {
      for (const message of messages) socket.write(JSON.stringify(message) + '\n');
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) replies.push(JSON.parse(line));
      }
      if (replies.length === messages.length) {
        socket.end();
        resolve(replies);
      }
    });
    socket.on('error', reject);
  });
}
