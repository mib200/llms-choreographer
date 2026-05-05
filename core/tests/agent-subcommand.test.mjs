import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

let logDir;

beforeEach(() => {
  logDir = mkdtempSync(join(tmpdir(), 'choreo-agent-log-'));
});

afterEach(() => {
  if (logDir && existsSync(logDir)) rmSync(logDir, { recursive: true, force: true });
});

// Helper: read events from the isolated log dir (mirrors core/observability.readEvents but scoped).
async function readEventsAt(dir, dateStr) {
  const { readFileSync } = await import('node:fs');
  const file = join(dir, `${dateStr}.ndjson`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(l => l.trim().length > 0)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

test('agent --name=codex dispatches to Codex alone', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=codex', 'hello codex'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: CODEX/);
    assert.match(stdout, /hello codex/);
  } finally {
    fake.cleanup();
  }
});

test('agent --name=claude dispatches to Claude alone', () => {
  const fake = createFakeAgents(['claude']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=claude', 'hello claude'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: CLAUDE/);
  } finally {
    fake.cleanup();
  }
});

test('agent --name=opencode dispatches to OpenCode alone', () => {
  const fake = createFakeAgents(['opencode']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=opencode', 'hello opencode'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: OPENCODE/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when --name is missing', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', 'some task'], { path: fake.path, logDir });
    assert.equal(code, 1);
    assert.match(stderr, /--name=/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when task is missing', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', '--name=codex'], { path: fake.path, logDir });
    assert.equal(code, 1);
    assert.match(stderr, /--name=/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 for unknown agent name', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', '--name=gemini', 'hello'], { path: fake.path, logDir });
    assert.equal(code, 1);
    assert.match(stderr, /Unknown agent/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when agent binary not installed', () => {
  const fake = createFakeAgents(['claude'], { unavailable: ['codex'] });
  try {
    const { stderr, code } = runCompanion(['agent', '--name=codex', 'hello'], { path: fake.path, logDir });
    assert.equal(code, 1);
    assert.match(stderr, /not installed/);
  } finally {
    fake.cleanup();
  }
});

test('agent emits agent_invocation event to NDJSON', async () => {
  const fake = createFakeAgents(['codex']);
  try {
    runCompanion(['agent', '--name=codex', 'test task'], { path: fake.path, logDir });

    const today = new Date().toISOString().slice(0, 10);
    const events = await readEventsAt(logDir, today);
    const invocation = events.find(e => e.type === 'agent_invocation');
    assert.ok(invocation, 'agent_invocation event found');
    assert.equal(invocation.name, 'codex');
  } finally {
    fake.cleanup();
  }
});

test('agent emits agent_completion event to NDJSON', async () => {
  const fake = createFakeAgents(['codex']);
  try {
    runCompanion(['agent', '--name=codex', 'test task'], { path: fake.path, logDir });

    const today = new Date().toISOString().slice(0, 10);
    const events = await readEventsAt(logDir, today);
    const completion = events.find(e => e.type === 'agent_completion');
    assert.ok(completion, 'agent_completion event found');
    assert.equal(completion.name, 'codex');
    assert.equal(completion.exitCode, 0);
  } finally {
    fake.cleanup();
  }
});

test('agent --json outputs JSON format', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--json', 'hello'], { path: fake.path, logDir });
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.command, 'agent');
    assert.ok(Array.isArray(parsed.results));
    assert.equal(parsed.results[0].name, 'codex');
  } finally {
    fake.cleanup();
  }
});

test('agent passes --model flag to Codex', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--model=gpt-5', 'test'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /--model/);
    assert.match(stdout, /gpt-5/);
  } finally {
    fake.cleanup();
  }
});

test('agent passes --effort flag to Codex', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--effort=high', 'test'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /--effort/);
    assert.match(stdout, /high/);
  } finally {
    fake.cleanup();
  }
});

test('agent propagates non-zero exit code from failed agent', () => {
  // Fake agent that exits 42 on any invocation (still responds to --version).
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "simulated failure" >&2',
      'exit 42',
    ].join('\n'),
  });
  try {
    const { code } = runCompanion(['agent', '--name=codex', 'will fail'], { path: fake.path, logDir });
    assert.equal(code, 42, 'exit code from failing agent propagates to companion');
  } finally {
    fake.cleanup();
  }
});

test('agent_invocation event redacts raw task text (hash + preview only)', async () => {
  const fake = createFakeAgents(['codex']);
  const secret = 'sk-super-secret-token-abc123';
  try {
    runCompanion(['agent', '--name=codex', `task mentioning ${secret}`], { path: fake.path, logDir });

    const today = new Date().toISOString().slice(0, 10);
    const events = await readEventsAt(logDir, today);
    const invocation = events.find(e => e.type === 'agent_invocation');
    assert.ok(invocation, 'agent_invocation event present');

    // Raw task must not appear anywhere in the event.
    const serialized = JSON.stringify(invocation);
    assert.ok(!serialized.includes(secret), 'secret does not appear in event payload');
    assert.ok(!('task' in invocation), 'raw `task` field is not persisted');
    assert.ok(typeof invocation.task_hash === 'string' && invocation.task_hash.length > 0, 'task_hash present');
    assert.ok(typeof invocation.task_length === 'number' && invocation.task_length > 0, 'task_length present');
  } finally {
    fake.cleanup();
  }
});

test('claude --name dispatches parses stream-json output before printing', () => {
  // Fake claude emits a single stream-json assistant event. The agent subcommand
  // must run parseClaudeStreamJson, so the final stdout must contain the extracted
  // text, NOT the raw JSON envelope.
  const fake = createFakeAgents(['claude'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "claude-fake 0.0.0"; exit 0; fi',
      'done',
      'printf \'{"type":"assistant","message":{"content":[{"type":"text","text":"PARSED_TEXT_MARKER"}]}}\\n\'',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(['agent', '--name=claude', 'anything'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /PARSED_TEXT_MARKER/, 'parsed text reaches stdout');
    assert.ok(!stdout.includes('"type":"assistant"'), 'raw stream-json envelope is not emitted');
  } finally {
    fake.cleanup();
  }
});

test('runAgent scrubs sensitive env vars from spawned child by default (F6)', () => {
  // Regression guard: parent shell leaks (AWS_*, GITHUB_TOKEN, DATABASE_URL)
  // must NOT reach the child agent binary. runAgent() now applies an env allowlist.
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "AWS_SECRET=${AWS_SECRET_ACCESS_KEY:-MISSING}"',
      'echo "GH_TOK=${GITHUB_TOKEN:-MISSING}"',
      'echo "DB=${DATABASE_URL:-MISSING}"',
      'echo "NPM_TOK=${NPM_TOKEN:-MISSING}"',
      'echo "HOME_OK=${HOME:+present}"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(
      ['agent', '--name=codex', 'probe'],
      {
        path: fake.path, logDir,
        extraEnv: {
          AWS_SECRET_ACCESS_KEY: 'should-not-leak',
          GITHUB_TOKEN: 'ghp_should-not-leak',
          DATABASE_URL: 'postgres://should-not-leak',
          NPM_TOKEN: 'npm_should-not-leak',
        },
      }
    );
    assert.equal(code, 0);
    assert.match(stdout, /AWS_SECRET=MISSING/, 'AWS_SECRET_ACCESS_KEY scrubbed from child env');
    assert.match(stdout, /GH_TOK=MISSING/,     'GITHUB_TOKEN scrubbed');
    assert.match(stdout, /DB=MISSING/,          'DATABASE_URL scrubbed');
    assert.match(stdout, /NPM_TOK=MISSING/,     'NPM_TOKEN scrubbed');
    // System basics still flow so child can run.
    assert.match(stdout, /HOME_OK=present/,     'HOME preserved');
  } finally { fake.cleanup(); }
});

test('runAgent allows known agent-auth env vars through by default (ANTHROPIC_API_KEY)', () => {
  // Counterpoint to the scrub test: legitimate agent-auth env MUST still flow.
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "ANT=${ANTHROPIC_API_KEY:-MISSING}"',
      'echo "OAI=${OPENAI_API_KEY:-MISSING}"',
      'echo "CODEX=${CODEX_EXAMPLE:-MISSING}"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(
      ['agent', '--name=codex', 'probe'],
      {
        path: fake.path, logDir,
        extraEnv: {
          ANTHROPIC_API_KEY: 'sk-ant-keep',
          OPENAI_API_KEY: 'sk-openai-keep',
          CODEX_EXAMPLE: 'codex-prefix-keep',
        },
      }
    );
    assert.equal(code, 0);
    assert.match(stdout, /ANT=sk-ant-keep/,       'ANTHROPIC_API_KEY forwarded');
    assert.match(stdout, /OAI=sk-openai-keep/,    'OPENAI_API_KEY forwarded');
    assert.match(stdout, /CODEX=codex-prefix-keep/, 'CODEX_* prefix allowed');
  } finally { fake.cleanup(); }
});

test('runAgent opt-in forwards full env when CHOREO_AGENT_ENV_PASSTHROUGH=1 (F6 escape hatch)', () => {
  // Users running Claude via Bedrock need AWS_* to reach the child. The opt-in
  // env var bypasses the allowlist so those workflows still function.
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "AWS=${AWS_SECRET_ACCESS_KEY:-MISSING}"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(
      ['agent', '--name=codex', 'probe'],
      {
        path: fake.path, logDir,
        extraEnv: {
          CHOREO_AGENT_ENV_PASSTHROUGH: '1',
          AWS_SECRET_ACCESS_KEY: 'explicit-opt-in',
        },
      }
    );
    assert.equal(code, 0);
    assert.match(stdout, /AWS=explicit-opt-in/, 'opt-in forwards full env including AWS_*');
  } finally { fake.cleanup(); }
});

test('agent parser preserves unknown --flag tokens in task text (F8)', () => {
  // Pre-Phase-D the parser stripped ANY token starting with `--`, corrupting
  // user tasks like "explain --force and --no-verify". Now only known flags
  // (--json, --name=, --model=, --effort=) are consumed.
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "ARGS:$*"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(
      ['agent', '--name=codex', 'explain', '--force', 'and', '--no-verify'],
      { path: fake.path, logDir }
    );
    assert.equal(code, 0);
    assert.match(stdout, /--force/,     '--force preserved in task');
    assert.match(stdout, /--no-verify/, '--no-verify preserved in task');
    assert.match(stdout, /explain/,     'non-flag token preserved');
  } finally { fake.cleanup(); }
});

test('agent parser respects `--` delimiter — everything after is task text (F8)', () => {
  // `--` is the standard POSIX end-of-options marker. After it, even tokens
  // that would normally be consumed (e.g. --json) are treated as task text.
  const fake = createFakeAgents(['codex'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "codex-fake 0.0.0"; exit 0; fi',
      'done',
      'echo "ARGS:$*"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(
      ['agent', '--name=codex', '--', 'print', '--json', 'format'],
      { path: fake.path, logDir }
    );
    assert.equal(code, 0);
    assert.match(stdout, /--json/, '--json after `--` preserved as task text');
    // jsonMode NOT enabled: output is the human delimiter format, not JSON.
    assert.match(stdout, /AGENT: CODEX/, 'stdout is human-format — --json after `--` did not flip jsonMode');
  } finally { fake.cleanup(); }
});

test('opencode --name dispatches parses output (ANSI stripped)', () => {
  // Fake opencode emits text with an ANSI color code. parseOpenCodeOutput
  // strips ANSI — the sentinel "CLEAN_TEXT" must remain.
  const fake = createFakeAgents(['opencode'], {
    script: () => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then echo "opencode-fake 0.0.0"; exit 0; fi',
      'done',
      // \x1b[31m is red ANSI; \x1b[0m resets. printf emits the real bytes.
      'printf \'\\033[31mCLEAN_TEXT\\033[0m\\n\'',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(['agent', '--name=opencode', 'anything'], { path: fake.path, logDir });
    assert.equal(code, 0);
    assert.match(stdout, /CLEAN_TEXT/);
    // No ANSI escape bytes in output
    // eslint-disable-next-line no-control-regex
    assert.ok(!/\[[0-9;]*[a-zA-Z]/.test(stdout), 'ANSI escapes stripped');
  } finally {
    fake.cleanup();
  }
});
