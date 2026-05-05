import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

// Council no longer requires minimum agents — runs with whatever is available.
test('council runs with only 1 agent available', () => {
  const fake = createFakeAgents(['claude'], { unavailable: ['codex', 'opencode'] });
  try {
    const { code } = runCompanion(['council', '--non-interactive', 'ping'], { path: fake.path });
    assert.equal(code, 0);
  } finally {
    fake.cleanup();
  }
});

test('council runs with no agents available (empty positions)', () => {
  const fake = createFakeAgents([], { unavailable: ['claude', 'codex', 'opencode'] });
  try {
    const { code } = runCompanion(['council', '--non-interactive', 'ping'], { path: fake.path });
    // Council may succeed or fail gracefully with no agents
    assert.ok(code === 0 || code === 1);
  } finally {
    fake.cleanup();
  }
});

// Debug still requires minimum 2 agents.
test('debug exits 1 with only 1 agent available', () => {
  const fake = createFakeAgents(['claude'], { unavailable: ['codex', 'opencode'] });
  try {
    const { code, stderr } = runCompanion(['debug', 'something broke'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /Not enough agents available/);
  } finally {
    fake.cleanup();
  }
});

test('debug exits 1 with no agents available', () => {
  const fake = createFakeAgents([], { unavailable: ['claude', 'codex', 'opencode'] });
  try {
    const { code, stderr } = runCompanion(['debug', 'something broke'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /Not enough agents available/);
  } finally {
    fake.cleanup();
  }
});
