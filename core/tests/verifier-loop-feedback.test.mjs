import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPendingFeedback, loadVerifierConfig, detectOscillation } from '../verifier/loop.mjs';

test('checkPendingFeedback: numeric sort handles round 10+', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const verifierDir = join(rootDir, '.choreographer', 'verifier', 'test-v');
    mkdirSync(verifierDir, { recursive: true });

    // Create files with rounds 1, 2, 10 (lexicographic sort would put 10 before 2)
    writeFileSync(join(verifierDir, 'feedback-round-1.json'), JSON.stringify({ round: 1, status: 'pass' }));
    writeFileSync(join(verifierDir, 'feedback-round-2.json'), JSON.stringify({ round: 2, status: 'pass' }));
    writeFileSync(join(verifierDir, 'feedback-round-10.json'), JSON.stringify({ round: 10, status: 'fail' }));

    const results = checkPendingFeedback(rootDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].verifier_id, 'test-v');
    assert.equal(results[0].round, 10, 'should pick round 10 as latest, not round 2');
    assert.equal(results[0].report.status, 'fail');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('checkPendingFeedback: handles single feedback file', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const verifierDir = join(rootDir, '.choreographer', 'verifier', 'single');
    mkdirSync(verifierDir, { recursive: true });
    writeFileSync(join(verifierDir, 'feedback-round-5.json'), JSON.stringify({ round: 5 }));

    const results = checkPendingFeedback(rootDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].round, 5);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('checkPendingFeedback: returns empty array when no feedback', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const results = checkPendingFeedback(rootDir);
    assert.deepEqual(results, []);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('checkPendingFeedback: ignores corrupted filenames gracefully', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const verifierDir = join(rootDir, '.choreographer', 'verifier', 'corrupt');
    mkdirSync(verifierDir, { recursive: true });
    writeFileSync(join(verifierDir, 'feedback-round-abc.json'), JSON.stringify({}));
    writeFileSync(join(verifierDir, 'feedback-round-3.json'), JSON.stringify({ round: 3 }));

    const results = checkPendingFeedback(rootDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].round, 3);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('loadVerifierConfig: parses YAML with colons in values', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const configDir = join(rootDir, '.choreographer');
    mkdirSync(configDir, { recursive: true });
    const yaml = [
      '- id: sql-schema',
      '  description: Validates schema against goals.json',
      '  allowed_script: scripts/verify-schema.sh',
      '  model: codex/gpt-5.5',
      '  depends_on: []',
      '  max_rounds: 5',
      '  triggers: [builder_stop]',
    ].join('\n');
    writeFileSync(join(configDir, 'verifiers.yaml'), yaml);

    const verifiers = loadVerifierConfig(rootDir);
    assert.equal(verifiers.length, 1);
    assert.equal(verifiers[0].id, 'sql-schema');
    assert.equal(verifiers[0].description, 'Validates schema against goals.json');
    assert.equal(verifiers[0].allowed_script, 'scripts/verify-schema.sh');
    assert.equal(verifiers[0].model, 'codex/gpt-5.5');
    assert.equal(verifiers[0].max_rounds, 5);
    assert.deepEqual(verifiers[0].depends_on, []);
    assert.deepEqual(verifiers[0].triggers, ['builder_stop']);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('loadVerifierConfig: returns empty array when file missing', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const verifiers = loadVerifierConfig(rootDir);
    assert.deepEqual(verifiers, []);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('loadVerifierConfig: rejects unknown depends_on', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'choreo-verify-test-'));
  try {
    const configDir = join(rootDir, '.choreographer');
    mkdirSync(configDir, { recursive: true });
    const yaml = [
      '- id: a',
      '  depends_on: [b]',
    ].join('\n');
    writeFileSync(join(configDir, 'verifiers.yaml'), yaml);

    assert.throws(() => loadVerifierConfig(rootDir), /depends on unknown verifier "b"/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('detectOscillation: true for identical claims', () => {
  const prev = ['c1', 'c2'];
  const curr = ['c2', 'c1'];
  assert.equal(detectOscillation(prev, curr), true);
});

test('detectOscillation: false for different claims', () => {
  const prev = ['c1'];
  const curr = ['c2'];
  assert.equal(detectOscillation(prev, curr), false);
});

test('detectOscillation: false for null inputs', () => {
  assert.equal(detectOscillation(null, ['c1']), false);
  assert.equal(detectOscillation(['c1'], null), false);
});
