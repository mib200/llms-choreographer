import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeVerifiers } from '../verifier/composer.mjs';

test('composeVerifiers runs parallel verifiers', async () => {
  const { reports, composite, conflicts } = await composeVerifiers({
    verifiers: [
      { id: 'v1', run: async () => ({ verified_claims: [{ id: 'c1', claim: 'test', method: 'deterministic', evidence: 'ok' }], failed_claims: [], couldnt_verify: [], confidence: 0.9 }) },
      { id: 'v2', run: async () => ({ verified_claims: [{ id: 'c2', claim: 'test2', method: 'llm', evidence: 'ok' }], failed_claims: [], couldnt_verify: [], confidence: 0.8 }) },
    ],
    builderRunId: 'test-run',
    round: 1,
  });

  assert.equal(reports.length, 2);
  assert.equal(composite.verified_claims.length, 2);
  assert.equal(composite.failed_claims.length, 0);
  assert.equal(conflicts.length, 0);
  assert.equal(composite.status, 'pass');
});

test('composeVerifiers detects conflicts on same claim ID', async () => {
  const { reports, composite, conflicts } = await composeVerifiers({
    verifiers: [
      { id: 'v1', run: async () => ({ verified_claims: [{ id: 'c1', claim: 'test', method: 'deterministic', evidence: 'ok' }], failed_claims: [], couldnt_verify: [], confidence: 0.9 }) },
      { id: 'v2', run: async () => ({ verified_claims: [], failed_claims: [{ id: 'c1', claim: 'test', method: 'llm', expected: 'ok', actual: 'fail' }], couldnt_verify: [], confidence: 0.8 }) },
    ],
    builderRunId: 'test-run',
    round: 1,
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].claim_id, 'c1');
  assert.ok(composite.couldnt_verify.some((c) => c.reason === 'conflict'));
});

test('composeVerifiers runs sequential verifiers via depends_on', async () => {
  const order = [];
  const { reports } = await composeVerifiers({
    verifiers: [
      { id: 'v1', depends_on: [], run: async () => { order.push('v1'); return { verified_claims: [], failed_claims: [], couldnt_verify: [], confidence: 0.9 } } },
      { id: 'v2', depends_on: ['v1'], run: async () => { order.push('v2'); return { verified_claims: [], failed_claims: [], couldnt_verify: [], confidence: 0.8 } } },
    ],
    builderRunId: 'test-run',
    round: 1,
  });

  assert.deepEqual(order, ['v1', 'v2']);
});

test('composeVerifiers sets status to fail when claims fail', async () => {
  const { composite } = await composeVerifiers({
    verifiers: [
      { id: 'v1', run: async () => ({ verified_claims: [], failed_claims: [{ id: 'c1', claim: 'fail', method: 'deterministic', expected: 'ok', actual: 'fail' }], couldnt_verify: [], confidence: 0.9 }) },
    ],
    builderRunId: 'test-run',
    round: 1,
  });

  assert.equal(composite.status, 'fail');
});

test('composeVerifiers computes composite confidence as average', async () => {
  const { composite } = await composeVerifiers({
    verifiers: [
      { id: 'v1', run: async () => ({ verified_claims: [], failed_claims: [], couldnt_verify: [], confidence: 0.9 }) },
      { id: 'v2', run: async () => ({ verified_claims: [], failed_claims: [], couldnt_verify: [], confidence: 0.7 }) },
    ],
    builderRunId: 'test-run',
    round: 1,
  });

  assert.equal(composite.confidence, 0.8);
});
