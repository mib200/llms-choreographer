import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runVerifierLoop } from '../verifier/loop.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'verifier-test-'));
}

function makeReport({ verifier_id, round, status = 'pass', failed = [], verified = [] }) {
  return {
    verifier_id,
    builder_run_id: 'test-run',
    round,
    status,
    confidence: status === 'pass' ? 1 : 0.5,
    verified_claims: verified.map(id => ({ id, claim: `claim ${id}`, method: 'deterministic', evidence: 'ok' })),
    failed_claims: failed.map(id => ({ id, claim: `claim ${id}`, method: 'deterministic', expected: 'x', actual: 'y' })),
    couldnt_verify: [],
    feedback_given: null,
    improvement_needed: failed.length > 0 ? 'fix claims' : null,
  };
}

test('runVerifierLoop: converges on round 1 when all pass', async () => {
  const rootDir = makeTmpDir();
  try {
    const result = await runVerifierLoop({
      rootDir,
      builderRunId: 'test-run',
      verifiers: [{ id: 'v1', depends_on: [] }],
      runVerifier: (v, _rid, round) => makeReport({ verifier_id: v.id, round, status: 'pass', verified: ['c1'] }),
      maxRounds: 3,
    });
    assert.equal(result.converged, true);
    assert.equal(result.rounds, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runVerifierLoop: fail round 1, pass round 2', async () => {
  const rootDir = makeTmpDir();
  let callCount = 0;
  try {
    const result = await runVerifierLoop({
      rootDir,
      builderRunId: 'test-run',
      verifiers: [{ id: 'v1', depends_on: [] }],
      runVerifier: (v, _rid, round) => {
        callCount++;
        if (round === 1) return makeReport({ verifier_id: v.id, round, status: 'fail', failed: ['c1'] });
        return makeReport({ verifier_id: v.id, round, status: 'pass', verified: ['c1'] });
      },
      maxRounds: 3,
    });
    assert.equal(result.converged, true);
    assert.equal(result.rounds, 2);
    assert.equal(callCount, 2);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runVerifierLoop: hits round cap without convergence', async () => {
  const rootDir = makeTmpDir();
  let round = 0;
  try {
    const result = await runVerifierLoop({
      rootDir,
      builderRunId: 'test-run',
      verifiers: [{ id: 'v1', depends_on: [] }],
      runVerifier: (v, _rid, r) => {
        round++;
        // Different failed claims each round to avoid oscillation detection
        return makeReport({ verifier_id: v.id, round: r, status: 'fail', failed: [`c${round}`] });
      },
      maxRounds: 3,
    });
    assert.equal(result.converged, false);
    assert.equal(result.rounds, 3);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runVerifierLoop: detects oscillation', async () => {
  const rootDir = makeTmpDir();
  try {
    const result = await runVerifierLoop({
      rootDir,
      builderRunId: 'test-run',
      verifiers: [{ id: 'v1', depends_on: [] }],
      runVerifier: (v, _rid, round) => makeReport({ verifier_id: v.id, round, status: 'fail', failed: ['c1', 'c2'] }),
      maxRounds: 5,
    });
    assert.equal(result.converged, false);
    assert.equal(result.escalated, 'oscillation');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runVerifierLoop: depends_on ordering enforced', async () => {
  const rootDir = makeTmpDir();
  const order = [];
  try {
    await runVerifierLoop({
      rootDir,
      builderRunId: 'test-run',
      verifiers: [
        { id: 'v1', depends_on: [] },
        { id: 'v2', depends_on: ['v1'] },
      ],
      runVerifier: (v, _rid, round) => {
        order.push(v.id);
        return makeReport({ verifier_id: v.id, round, status: 'pass', verified: ['c1'] });
      },
      maxRounds: 1,
    });
    assert.equal(order[0], 'v1');
    assert.equal(order[1], 'v2');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runVerifierLoop: empty verifiers returns converged immediately', async () => {
  const result = await runVerifierLoop({
    rootDir: makeTmpDir(),
    builderRunId: 'test-run',
    verifiers: [],
    runVerifier: () => { throw new Error('should not be called'); },
  });
  assert.equal(result.converged, true);
  assert.equal(result.rounds, 0);
});
