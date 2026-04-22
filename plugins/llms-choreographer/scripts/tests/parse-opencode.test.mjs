import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenCodeNdJson } from '../companion.mjs';

const ASSISTANT_EVENT = (text) => JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
});

test('extracts text from a single assistant event', () => {
  const raw = ASSISTANT_EVENT('Hello from OpenCode');
  assert.equal(parseOpenCodeNdJson(raw), 'Hello from OpenCode');
});

test('concatenates multiple assistant text blocks', () => {
  const raw = [
    ASSISTANT_EVENT('First part.'),
    ASSISTANT_EVENT('Second part.'),
  ].join('\n');
  assert.equal(parseOpenCodeNdJson(raw), 'First part.\nSecond part.');
});

test('skips non-assistant event types', () => {
  const raw = [
    JSON.stringify({ type: 'tool_use', id: 'x' }),
    ASSISTANT_EVENT('Only this'),
    JSON.stringify({ type: 'tool_result', content: 'ignored' }),
  ].join('\n');
  assert.equal(parseOpenCodeNdJson(raw), 'Only this');
});

test('skips non-JSON progress lines', () => {
  const raw = [
    'Connecting to OpenCode...',
    ASSISTANT_EVENT('Real answer'),
    '[progress] done',
  ].join('\n');
  assert.equal(parseOpenCodeNdJson(raw), 'Real answer');
});

test('falls back to raw trimmed output when no assistant events found', () => {
  const raw = '  raw fallback output  ';
  assert.equal(parseOpenCodeNdJson(raw), 'raw fallback output');
});

test('handles empty input gracefully', () => {
  assert.equal(parseOpenCodeNdJson(''), '');
});
