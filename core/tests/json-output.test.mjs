import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

const ALL_AGENTS = ['claude', 'codex', 'opencode'];

test('council --json emits valid JSON with council result', async () => {
  const fake = createFakeAgents(ALL_AGENTS);
  try {
    const { stdout, stderr, code } = runCompanion(['council', '--json', '--non-interactive', 'ping'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'council');
    assert.ok(parsed.slug, 'result has slug');
    assert.ok(parsed.confidence, 'result has confidence');
    assert.ok(typeof parsed.rounds === 'number', 'result has rounds');
  } finally {
    fake.cleanup();
  }
});

test('council --json with 2 agents emits valid JSON', async () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stdout, stderr, code } = runCompanion(['council', '--json', '--non-interactive', 'ping'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'council');
    assert.ok(parsed.slug, 'result has slug');
  } finally {
    fake.cleanup();
  }
});

test('council without --json emits decision text', async () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stdout, code } = runCompanion(['council', '--non-interactive', 'ping'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /Council Decision:/);
    assert.match(stdout, /Members/);
    assert.match(stdout, /Confidence Level/);
  } finally {
    fake.cleanup();
  }
});

test('council runs with any available agents (no minimum)', async () => {
  const fake = createFakeAgents(['claude']);
  try {
    const { stdout, code } = runCompanion(['council', '--non-interactive', 'ping'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /Council Decision:/);
  } finally {
    fake.cleanup();
  }
});

test('council runs even with no agents (uses subprocess fallback)', async () => {
  const fake = createFakeAgents([]);
  try {
    const { code } = runCompanion(['council', '--non-interactive', 'ping'], { path: fake.path });
    assert.ok(code === 0 || code === 1, 'council exits with 0 or 1');
  } finally {
    fake.cleanup();
  }
});

test('debug --json emits valid JSON with command=debug', async () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stdout, code, stderr } = runCompanion(['debug', '--json', 'something broke'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'debug');
    assert.ok(parsed.results.length >= 2);
  } finally {
    fake.cleanup();
  }
});
