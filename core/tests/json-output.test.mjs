import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

/**
 * Integration tests for companion.mjs command output formats.
 *
 * These tests verify that commands produce the expected output shape.
 * They do NOT test council deliberation quality — that belongs in unit
 * tests for individual phases, not end-to-end subprocess tests.
 *
 * To keep tests fast, each test fakes ONLY the agents it needs and
 * passes explicit --members to avoid spawning real binaries.
 */

test('debug --json emits valid JSON with command=debug', async () => {
  const fake = createFakeAgents(['claude', 'codex'], { unavailable: ['opencode'] });
  try {
    const { stdout, code, stderr } = runCompanion(
      ['debug', '--json', 'something broke'],
      { path: fake.path }
    );
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'debug');
    assert.ok(Array.isArray(parsed.results));
    assert.ok(parsed.results.length >= 2);
  } finally {
    fake.cleanup();
  }
});

test('council --json with explicit members emits valid JSON', async () => {
  // Use only claude with 1 round + skip preflight for speed
  const fake = createFakeAgents(['claude']);
  try {
    const { stdout, code, stderr } = runCompanion(
      ['council', '--json', '--non-interactive', '--members=claude', '--rounds=1', '--skip-preflight', 'ping'],
      { path: fake.path }
    );
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

test('council with unknown member warns and skips', async () => {
  const fake = createFakeAgents(['claude']);
  try {
    const { stdout, code, stderr } = runCompanion(
      ['council', '--json', '--non-interactive', '--members=claude,unknown-agent', '--rounds=1', '--skip-preflight', 'ping'],
      { path: fake.path }
    );
    assert.equal(code, 0, `stderr: ${stderr}`);
    assert.match(stderr, /Unknown member.*unknown-agent/i);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'council');
  } finally {
    fake.cleanup();
  }
});

test('council with empty members throws validation error', async () => {
  // Test the validation logic directly — CLI parsing of --members= is ambiguous
  const { runCouncil } = await import('../council.mjs');
  await assert.rejects(
    runCouncil({ task: 'test', members: [], nonInteractive: true }),
    /No valid council members/
  );
});
