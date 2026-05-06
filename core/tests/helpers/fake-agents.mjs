import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPANION = fileURLToPath(new URL('../../companion.mjs', import.meta.url));

const BINARY_MAP = {
  claude:   'claude',
  codex:    'codex',
  opencode: 'opencode',
};

/**
 * Create a temp directory with fake agent binaries.
 *
 * Agents in `names` respond normally (--version exits 0, other args speak ACP).
 * Agents in `unavailable` are created as stubs that exit 1 on --version — this
 * shadows the real binary on PATH and makes checkCli() report them as 'unavailable'.
 */
export function createFakeAgents(names, { unavailable = [], script, tmpBase, envEchoKeys = [], response } = {}) {
  const dir = mkdtempSync(join(tmpBase ?? process.cwd(), '.tmp-choreo-fake-'));

  for (const agentName of names) {
    const binary = BINARY_MAP[agentName] ?? agentName;
    const src = script
      ? script(agentName)
      : acpAgentScript(agentName, binary, { envEchoKeys, responseText: resolveResponse(response, agentName) });

    const path = join(dir, binary);
    writeFileSync(path, src, 'utf8');
    chmodSync(path, 0o755);

    if (agentName === 'claude') {
      const npxPath = join(dir, 'npx');
      writeFileSync(npxPath, acpAgentScript(agentName, 'npx', { envEchoKeys, packageArg: '@agentclientprotocol/claude-agent-acp', responseText: resolveResponse(response, agentName) }), 'utf8');
      chmodSync(npxPath, 0o755);
    }
  }

  for (const agentName of unavailable) {
    const binary = BINARY_MAP[agentName] ?? agentName;
    const src = '#!/bin/sh\nexit 1\n';
    const path = join(dir, binary);
    writeFileSync(path, src, 'utf8');
    chmodSync(path, 0o755);
    if (agentName === 'claude') {
      const npxPath = join(dir, 'npx');
      writeFileSync(npxPath, src, 'utf8');
      chmodSync(npxPath, 0o755);
    }
  }

  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function resolveResponse(response, agentName) {
  if (typeof response === 'function') return response(agentName);
  if (response && typeof response === 'object') return response[agentName];
  if (typeof response === 'string') return response;
  return undefined;
}

export function acpAgentScript(agentName, binary = agentName, { envEchoKeys = [], packageArg, responseText } = {}) {
  return `#!/usr/bin/env node
import { AgentSideConnection, PROTOCOL_VERSION, ndJsonStream } from '@agentclientprotocol/sdk';

const args = process.argv.slice(2).filter((arg) => arg !== ${JSON.stringify(packageArg ?? '')});
if (args.includes('--version')) {
  console.log(${JSON.stringify(binary)} + '-fake 0.0.0');
  process.exit(0);
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
    return { protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION, agentCapabilities: { loadSession: true }, authMethods: [] };
  }

  async newSession() {
    return { sessionId: 'fake-${agentName}-session' };
  }

  async loadSession() {
    return {};
  }

  async prompt(params) {
    const promptText = (params.prompt ?? []).map((block) => block.text ?? '').join('');
    const envLines = ${JSON.stringify(envEchoKeys)}.map((key) => key + '=' + (process.env[key] || 'MISSING'));
    const output = ${responseText === undefined ? "['AGENT: " + agentName.toUpperCase() + "', 'PROMPT: ' + promptText, ...envLines].join('\\n')" : JSON.stringify(responseText)};
    await connection.sessionUpdate({
      sessionId: params.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: output } },
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

/**
 * Spawn companion.mjs with a given set of args, injecting a fake PATH first
 * and an optional CHOREO_LOG_DIR for test isolation. `extraEnv` lets env-
 * allowlist tests inject both secrets (should be scrubbed) and opt-in vars.
 */
export function runCompanion(args, { path, logDir, extraEnv } = {}) {
  const env = { ...process.env, PATH: `${path}:${process.env.PATH}`, CHOREO_TEST_MODE: '1' };
  if (logDir) env.CHOREO_LOG_DIR = logDir;
  if (extraEnv) Object.assign(env, extraEnv);
  const result = spawnSync(
    process.execPath,
    [COMPANION, ...args],
    { encoding: 'utf8', env }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? 1,
  };
}
