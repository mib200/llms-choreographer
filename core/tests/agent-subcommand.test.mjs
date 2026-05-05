import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';
import { readEvents } from '../../core/observability.mjs';

test('agent --name=codex dispatches to Codex alone', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=codex', 'hello codex'], { path: fake.path });
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
    const { stdout, code } = runCompanion(['agent', '--name=claude', 'hello claude'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: CLAUDE/);
  } finally {
    fake.cleanup();
  }
});

test('agent --name=opencode dispatches to OpenCode alone', () => {
  const fake = createFakeAgents(['opencode']);
  try {
    const { stdout, code } = runCompanion(['agent', '--name=opencode', 'hello opencode'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /AGENT: OPENCODE/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when --name is missing', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', 'some task'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /--name=/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when task is missing', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', '--name=codex'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /--name=/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 for unknown agent name', () => {
  const fake = createFakeAgents(['codex']);
  try {
    const { stderr, code } = runCompanion(['agent', '--name=gemini', 'hello'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /Unknown agent/);
  } finally {
    fake.cleanup();
  }
});

test('agent exits 1 when agent binary not installed', () => {
  const fake = createFakeAgents(
    ['claude'],
    { unavailable: ['codex'] }
  );
  try {
    const { stderr, code } = runCompanion(['agent', '--name=codex', 'hello'], { path: fake.path });
    assert.equal(code, 1);
    assert.match(stderr, /not installed/);
  } finally {
    fake.cleanup();
  }
});

test('agent emits agent_invocation event to NDJSON', () => {
  const fake = createFakeAgents(['codex']);
  try {
    runCompanion(['agent', '--name=codex', 'test task'], { path: fake.path });

    const today = new Date().toISOString().slice(0, 10);
    const events = readEvents(today);
    const invocation = events.find(e => e.type === 'agent_invocation');
    assert.ok(invocation, 'agent_invocation event found');
    assert.equal(invocation.name, 'codex');
  } finally {
    fake.cleanup();
  }
});

test('agent emits agent_completion event to NDJSON', () => {
  const fake = createFakeAgents(['codex']);
  try {
    runCompanion(['agent', '--name=codex', 'test task'], { path: fake.path });

    const today = new Date().toISOString().slice(0, 10);
    const events = readEvents(today);
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
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--json', 'hello'], { path: fake.path });
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
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--model=gpt-5', 'test'], { path: fake.path });
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
    const { stdout, code } = runCompanion(['agent', '--name=codex', '--effort=high', 'test'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /--effort/);
    assert.match(stdout, /high/);
  } finally {
    fake.cleanup();
  }
});
