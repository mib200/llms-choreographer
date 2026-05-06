import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFeedback, containsInstructions } from '../verifier/sanitizer.mjs';

test('sanitizeFeedback strips instruction-like lines', () => {
  const raw = 'claim c1 failed: missing index\nplease add an index on email column\nexpected: single query';
  const result = sanitizeFeedback(raw);
  assert.equal(result, 'claim c1 failed: missing index\nexpected: single query');
});

test('sanitizeFeedback caps at 2K characters', () => {
  const raw = 'x'.repeat(3000);
  const result = sanitizeFeedback(raw);
  assert.ok(result.length <= 2048);
  assert.ok(result.endsWith('...'));
});

test('sanitizeFeedback returns null for empty input', () => {
  assert.equal(sanitizeFeedback(''), null);
  assert.equal(sanitizeFeedback(null), null);
  assert.equal(sanitizeFeedback(undefined), null);
});

test('sanitizeFeedback trims whitespace', () => {
  const result = sanitizeFeedback('  claim verified  ');
  assert.equal(result, 'claim verified');
});

test('containsInstructions detects imperative patterns', () => {
  assert.ok(containsInstructions('please fix the bug'));
  assert.ok(containsInstructions('you should add validation'));
  assert.ok(containsInstructions('make sure to handle errors'));
  assert.ok(containsInstructions('fix the function at line 12'));
});

test('containsInstructions returns false for data-only text', () => {
  assert.equal(containsInstructions('claim c1 failed: missing index'), false);
  assert.equal(containsInstructions('expected: single query, actual: 3 queries'), false);
  assert.equal(containsInstructions('file: routes/list.mjs:12'), false);
});
