import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

test('check-all exits 0 when all 3 agents are present', () => {
  const fake = createFakeAgents(['claude', 'codex', 'opencode']);
  try {
    const { stdout, code } = runCompanion(['check-all'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /✓ claude:/);
    assert.match(stdout, /✓ codex:/);
    assert.match(stdout, /✓ opencode:/);
  } finally {
    fake.cleanup();
  }
});

test('check-all exits 1 when opencode is unavailable', () => {
  const fake = createFakeAgents(
    ['claude', 'codex'],
    { unavailable: ['opencode'] }
  );
  try {
    const { stderr, code } = runCompanion(['check-all'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /✗ opencode/);
  } finally {
    fake.cleanup();
  }
});

test('check-all exits 1 when multiple agents are unavailable', () => {
  const fake = createFakeAgents(
    ['claude'],
    { unavailable: ['codex', 'opencode'] }
  );
  try {
    const { stderr, code } = runCompanion(['check-all'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /✗ codex/);
    assert.match(stderr, /✗ opencode/);
  } finally {
    fake.cleanup();
  }
});
