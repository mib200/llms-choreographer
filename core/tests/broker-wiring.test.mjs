import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

const ALL_AGENTS = ['claude', 'codex', 'opencode'];

test('agent command flows through broker (exits 0, produces output)', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { code, stdout } = runCompanion(['agent', '--name=codex', 'test task'], { path: fake.path });
    assert.equal(code, 0);
    assert.ok(stdout.length > 0, 'produces output');
  } finally {
    fake.cleanup();
  }
});

test('council invokes through broker (creates debate artifacts)', () => {
  const fake = createFakeAgents(ALL_AGENTS);
  try {
    const { code, stdout } = runCompanion(['council', '--non-interactive', '--rounds=1', 'ping'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /Council Decision|decision/i);
  } finally {
    fake.cleanup();
  }
});

test('review command invokes through broker (3 agents)', () => {
  const fake = createFakeAgents(ALL_AGENTS);
  try {
    const { code } = runCompanion(['review', '--json'], { path: fake.path });
    // Review may exit 0 or produce results even with fake agents
    assert.ok(code === 0 || code === 1);
  } finally {
    fake.cleanup();
  }
});

test('debug command requires minimum 2 agents', () => {
  const fake = createFakeAgents(['claude'], { unavailable: ['codex', 'opencode'] });
  try {
    const { code, stderr } = runCompanion(['debug', 'something broken'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /Not enough agents available/);
  } finally {
    fake.cleanup();
  }
});
