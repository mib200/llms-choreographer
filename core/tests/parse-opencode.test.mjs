import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenCodeOutput } from '../companion.mjs';

test('returns plain text unchanged', () => {
  assert.equal(parseOpenCodeOutput('Hello from OpenCode'), 'Hello from OpenCode');
});

test('strips ANSI escape codes', () => {
  assert.equal(parseOpenCodeOutput('\x1b[32mgreen text\x1b[0m'), 'green text');
});

test('trims surrounding whitespace', () => {
  assert.equal(parseOpenCodeOutput('  raw fallback output  '), 'raw fallback output');
});

test('filters empty lines', () => {
  const raw = 'line one\n\n\nline two';
  assert.equal(parseOpenCodeOutput(raw), 'line one\nline two');
});

test('handles empty input gracefully', () => {
  assert.equal(parseOpenCodeOutput(''), '');
});
