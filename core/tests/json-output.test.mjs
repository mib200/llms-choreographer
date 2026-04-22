import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

const ALL_AGENTS = ['claude', 'codex', 'opencode'];

test('council --json emits valid JSON with 3 results when all agents present', () => {
  const fake = createFakeAgents(ALL_AGENTS);
  try {
    const { stdout, stderr, code } = runCompanion(['council', '--json', 'ping'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'council');
    assert.equal(parsed.results.length, 3);
    for (const r of parsed.results) {
      assert.ok(r.name, 'result has name');
      assert.ok(typeof r.output === 'string', 'result has output');
    }
  } finally {
    fake.cleanup();
  }
});

test('council --json with 2 agents emits 2 results and skipped warning on stderr', () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stdout, stderr, code } = runCompanion(['council', '--json', 'ping'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.results.length, 2);
    assert.match(stderr, /⚠ Skipped agents:/);
  } finally {
    fake.cleanup();
  }
});

test('council without --json emits delimited text with AGENT banners', () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stdout, code } = runCompanion(['council', 'ping'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: CLAUDE/);
    assert.match(stdout, /AGENT: CODEX/);
  } finally {
    fake.cleanup();
  }
});

test('debug --json emits valid JSON with command=debug', () => {
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
