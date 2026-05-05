import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOscillation } from '../verifier/loop.mjs';

test('detectOscillation returns true for identical failed claims', () => {
  const prev = ['c1', 'c2'];
  const curr = ['c1', 'c2'];
  assert.ok(detectOscillation(prev, curr));
});

test('detectOscillation returns false for different failed claims', () => {
  const prev = ['c1', 'c2'];
  const curr = ['c1', 'c3'];
  assert.equal(detectOscillation(prev, curr), false);
});

test('detectOscillation ignores order', () => {
  const prev = ['c2', 'c1'];
  const curr = ['c1', 'c2'];
  assert.ok(detectOscillation(prev, curr));
});

test('detectOscillation returns false for null inputs', () => {
  assert.equal(detectOscillation(null, ['c1']), false);
  assert.equal(detectOscillation(['c1'], null), false);
  assert.equal(detectOscillation(null, null), false);
});
