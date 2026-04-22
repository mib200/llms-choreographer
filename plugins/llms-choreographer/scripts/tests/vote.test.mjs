import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAgents, runCompanion } from './helpers/fake-agents.mjs';

const ALL_AGENTS = ['claude', 'codex', 'opencode'];

test('vote --json emits valid JSON with tally and 3 results', () => {
  // Fake agents echo "YES — rationale" so parseVote extracts YES
  const fake = createFakeAgents(ALL_AGENTS, {
    script: (name) => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then',
      `    echo "${name}-fake 0.0.0"`,
      '    exit 0',
      '  fi',
      'done',
      'echo "YES — fake rationale from ' + name + '"',
    ].join('\n'),
  });
  try {
    const { stdout, stderr, code } = runCompanion(['vote', '--json', 'adopt TypeScript?'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.command, 'vote');
    assert.ok(typeof parsed.tally === 'object', 'has tally');
    assert.ok(typeof parsed.tally.yes === 'number', 'tally.yes is number');
    assert.equal(parsed.tally.yes, 3, 'all 3 agents voted YES');
    assert.equal(parsed.results.length, 3);
    for (const r of parsed.results) {
      assert.equal(r.vote, 'YES');
      assert.ok(r.name, 'has name');
    }
  } finally {
    fake.cleanup();
  }
});

test('vote --json correctly tallies mixed votes', () => {
  const votes = { claude: 'YES', codex: 'NO', opencode: 'ABSTAIN' };
  const fake = createFakeAgents(ALL_AGENTS, {
    script: (name) => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then',
      `    echo "${name}-fake 0.0.0"`,
      '    exit 0',
      '  fi',
      'done',
      `echo "${votes[name]} — rationale from ${name}"`,
    ].join('\n'),
  });
  try {
    const { stdout, code, stderr } = runCompanion(['vote', '--json', 'add Redis?'], { path: fake.path });
    assert.equal(code, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.tally.yes, 1);
    assert.equal(parsed.tally.no, 1);
    assert.equal(parsed.tally.abstain, 1);
    assert.equal(parsed.tally.invalid, 0);
  } finally {
    fake.cleanup();
  }
});

test('vote text mode contains tally table header', () => {
  const fake = createFakeAgents(ALL_AGENTS, {
    script: (name) => [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--version" ]; then',
      `    echo "${name}-fake 0.0.0"`,
      '    exit 0',
      '  fi',
      'done',
      'echo "YES — looks good"',
    ].join('\n'),
  });
  try {
    const { stdout, code } = runCompanion(['vote', 'adopt TypeScript?'], { path: fake.path });
    assert.equal(code, 0);
    assert.match(stdout, /## Vote Tally/);
    assert.match(stdout, /YES/);
  } finally {
    fake.cleanup();
  }
});
