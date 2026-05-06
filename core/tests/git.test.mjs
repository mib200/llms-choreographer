import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReviewTarget, collectReviewContext } from '../git.mjs';

test('resolveReviewTarget: auto scope on clean repo returns branch mode', () => {
  const target = resolveReviewTarget(process.cwd(), {});
  assert.ok(target.mode, 'has mode');
  assert.ok(['working-tree', 'branch'].includes(target.mode));
  assert.ok(target.label, 'has label');
});

test('resolveReviewTarget: explicit working-tree scope', () => {
  const target = resolveReviewTarget(process.cwd(), { scope: 'working-tree' });
  assert.equal(target.mode, 'working-tree');
});

test('resolveReviewTarget: branch scope with base ref', () => {
  const target = resolveReviewTarget(process.cwd(), { base: 'main' });
  assert.equal(target.mode, 'branch');
  assert.equal(target.baseRef, 'main');
  assert.equal(target.explicit, true);
});

test('resolveReviewTarget: rejects invalid scope', () => {
  assert.throws(() => resolveReviewTarget(process.cwd(), { scope: 'invalid-scope' }));
});

test('collectReviewContext: returns content and metadata', () => {
  const target = resolveReviewTarget(process.cwd(), { scope: 'working-tree' });
  const ctx = collectReviewContext(process.cwd(), target);
  assert.ok(typeof ctx.content === 'string');
  assert.ok(typeof ctx.summary === 'string');
  assert.ok(Array.isArray(ctx.changedFiles));
});
