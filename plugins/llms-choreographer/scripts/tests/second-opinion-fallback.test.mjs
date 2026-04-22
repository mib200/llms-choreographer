import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

test('defaults to claude when no --agent flag and claude is present', () => {
  const fake = createFakeAgents(['claude', 'codex', 'opencode']);
  try {
    const { stdout, code } = runCompanion(['second-opinion', 'use postgres'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /SECOND OPINION: CLAUDE/);
  } finally {
    fake.cleanup();
  }
});

test('falls back from claude to codex when claude unavailable (no --agent)', () => {
  const fake = createFakeAgents(['codex', 'opencode'], { unavailable: ['claude'] });
  try {
    const { stdout, stderr, code } = runCompanion(['second-opinion', 'use postgres'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stderr, /⚠ Agent "claude" not found — using "codex" instead\./);
    assert.match(stdout, /SECOND OPINION: CODEX/);
  } finally {
    fake.cleanup();
  }
});

test('falls back from requested absent agent to first available', () => {
  const fake = createFakeAgents(['opencode'], { unavailable: ['claude', 'codex'] });
  try {
    const { stdout, stderr, code } = runCompanion(['second-opinion', '--agent', 'codex', 'use postgres'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stderr, /⚠ Agent "codex" not found — using "opencode" instead\./);
    assert.match(stdout, /SECOND OPINION: OPENCODE/);
  } finally {
    fake.cleanup();
  }
});

test('exits non-zero with install hint when no agents are present', () => {
  const fake = createFakeAgents([], { unavailable: ['claude', 'codex', 'opencode'] });
  try {
    const { stderr, code } = runCompanion(['second-opinion', 'use postgres'], { path: fake.path });
    assert.notEqual(code, 0);
    assert.match(stderr, /not found and no alternatives are available/);
    assert.match(stderr, /Install at least one agent/);
  } finally {
    fake.cleanup();
  }
});
