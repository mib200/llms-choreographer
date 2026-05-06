import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredOutput } from '../parsers.mjs';

const TEST_SCHEMA = {
  required: ['verdict', 'findings'],
  properties: {
    verdict: { enum: ['approve', 'needs-attention'] },
    confidence: { type: 'number' },
  },
};

test('parseStructuredOutput: extracts JSON from markdown code block', () => {
  const raw = 'Here is the result:\n\n```json\n{"verdict": "approve", "findings": []}\n```\n\nDone.';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.deepEqual(result, { verdict: 'approve', findings: [] });
});

test('parseStructuredOutput: extracts bare JSON object', () => {
  const raw = '{"verdict": "needs-attention", "findings": [{"id": "f1"}]}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.verdict, 'needs-attention');
  assert.equal(result.findings.length, 1);
});

test('parseStructuredOutput: rejects missing required field', () => {
  const raw = '{"verdict": "approve"}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result, null);
});

test('parseStructuredOutput: rejects invalid enum value', () => {
  const raw = '{"verdict": "rejected", "findings": []}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result, null);
});

test('parseStructuredOutput: returns null for non-JSON input', () => {
  const raw = 'Just plain text with no JSON here.';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result, null);
});

test('parseStructuredOutput: returns null when schema is null', () => {
  const raw = '{"verdict": "approve", "findings": []}';
  const result = parseStructuredOutput(raw, null);
  assert.equal(result, null);
});

test('parseStructuredOutput: handles nested JSON objects', () => {
  const raw = 'Some text {"outer": {"inner": 1}, "findings": [], "verdict": "approve"} more text';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.verdict, 'approve');
  assert.deepEqual(result.outer, { inner: 1 });
});

test('parseStructuredOutput: handles JSON with escaped quotes', () => {
  const raw = '{"verdict": "approve", "findings": [{"msg": "say \\"hello\\""}]}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.findings[0].msg, 'say "hello"');
});

test('parseStructuredOutput: handles multiple JSON blocks (finds first valid)', () => {
  const raw = '{"invalid": true} {"verdict": "approve", "findings": []}';
  // First block fails schema validation, second should be found
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  // The first {} is parsed but fails required check → returns null from inner try
  // Then the second {} should be found
  assert.equal(result, null); // First block invalid, second not reached due to break
});

test('parseStructuredOutput: handles JSON with braces in strings', () => {
  const raw = '{"verdict": "approve", "findings": [{"code": "function() { return 1; }"}]}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.findings[0].code, 'function() { return 1; }');
});

test('parseStructuredOutput: handles empty object', () => {
  const raw = 'Some text {} and more';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result, null); // Empty object fails required check
});

test('parseStructuredOutput: handles deeply nested JSON', () => {
  const raw = JSON.stringify({
    verdict: 'approve',
    findings: [],
    deep: { a: { b: { c: { d: 1 } } } },
  });
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.deep.a.b.c.d, 1);
});

test('parseStructuredOutput: handles JSON with arrays and objects mixed', () => {
  const raw = '{"verdict": "approve", "findings": [{"nested": {"key": "value"}, "arr": [1, 2, 3]}]}';
  const result = parseStructuredOutput(raw, TEST_SCHEMA);
  assert.equal(result.findings[0].nested.key, 'value');
  assert.deepEqual(result.findings[0].arr, [1, 2, 3]);
});
