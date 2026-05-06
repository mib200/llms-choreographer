import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AcpClient } from '../agents/acp-client.mjs';

test('AcpClient speaks installed ACP SDK request shapes', async () => {
  const dir = mkdtempSync(join(process.cwd(), '.tmp-acp-client-'));
  const logPath = join(dir, 'requests.ndjson');
  const fakeAgentPath = join(dir, 'fake-agent.mjs');
  writeFileSync(fakeAgentPath, fakeAgentSource(logPath));

  const client = new AcpClient({
    binary: process.execPath,
    acpArgs: [fakeAgentPath],
    env: { ...process.env, ACP_TEST_LOG: logPath },
  });

  try {
    await client.initialize();
    await client.newSession();
    const result = await client.prompt({
      prompt: 'hello',
      structuredSchema: { required: ['status'] },
    });

    assert.equal(result.transport, 'acp');
    assert.equal(result.output, '{"status":"ok"}');
    assert.deepEqual(result.structured, { status: 'ok' });

    const requests = readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(requests[0].method, 'initialize');
    assert.equal(typeof requests[0].params.protocolVersion, 'number');
    assert.ok(requests[0].params.clientCapabilities);
    assert.ok(!('capabilities' in requests[0].params));

    assert.equal(requests[1].method, 'newSession');
    assert.deepEqual(requests[1].params.mcpServers, []);

    assert.equal(requests[2].method, 'prompt');
    assert.deepEqual(requests[2].params.prompt, [{ type: 'text', text: 'hello' }]);
    assert.ok(!('messages' in requests[2].params));
  } finally {
    await client.teardown();
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakeAgentSource(logPath) {
  return `
import { AgentSideConnection, PROTOCOL_VERSION, ndJsonStream } from '@agentclientprotocol/sdk';
import { appendFileSync } from 'node:fs';

function log(method, params) {
  appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ method, params }) + '\\n');
}

const stdinStream = new ReadableStream({
  start(controller) {
    process.stdin.on('data', (chunk) => controller.enqueue(chunk));
    process.stdin.on('end', () => controller.close());
    process.stdin.on('error', (err) => controller.error(err));
  },
});

const stdoutStream = new WritableStream({
  write(chunk) {
    process.stdout.write(chunk);
  },
});

let connection;

class FakeAgent {
  async initialize(params) {
    log('initialize', params);
    return { protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true }, authMethods: [] };
  }

  async newSession(params) {
    log('newSession', params);
    return { sessionId: 's1' };
  }

  async loadSession(params) {
    log('loadSession', params);
    return {};
  }

  async prompt(params) {
    log('prompt', params);
    await connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: '{"status":"ok"}' },
      },
    });
    return { stopReason: 'end_turn' };
  }

  async cancel() {}
  async closeSession() { return {}; }
  async authenticate() { return {}; }
}

connection = new AgentSideConnection(
  () => new FakeAgent(),
  ndJsonStream(stdoutStream, stdinStream),
);
`;
}
