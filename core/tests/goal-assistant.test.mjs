import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGoalAssistant, initGoalsFromPlan } from '../goal-assistant.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'goal-test-'));
}

test('runGoalAssistant produces valid goals.json', async () => {
  const rootDir = makeTmpDir();
  try {
    const answers = [];
    const result = await runGoalAssistant({
      rootDir,
      askQuestion: async (q) => { answers.push(q); return 'test answer'; },
    });
    assert.ok(result.goals, 'has goals array');
    assert.ok(result.goals.length > 0, 'at least one goal');
    for (const g of result.goals) {
      assert.ok(g.id, 'goal has id');
      assert.ok(g.description, 'goal has description');
      assert.ok(g.verify, 'goal has verify');
    }
    assert.equal(answers.length, 3, 'asked 3 scope questions');
    assert.ok(existsSync(join(rootDir, '.choreographer', 'goals.json')));
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('initGoalsFromPlan extracts criteria past headings', () => {
  const rootDir = makeTmpDir();
  const planPath = join(rootDir, 'plan.md');
  writeFileSync(planPath, [
    '# Plan',
    '',
    '## Acceptance Criteria',
    '',
    '- Feature A works correctly',
    '- Feature B handles edge cases',
    '',
    '- Feature C is fast',
    '',
    '## Next Section',
    '',
    '- This is not a criterion',
  ].join('\n'));

  try {
    const result = initGoalsFromPlan(rootDir, planPath);
    assert.ok(result.goals.length >= 3, `expected >=3 goals, got ${result.goals.length}`);
    assert.equal(result.source, 'plan');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('initGoalsFromPlan throws for missing plan file', () => {
  const rootDir = makeTmpDir();
  try {
    assert.throws(() => initGoalsFromPlan(rootDir, '/nonexistent/plan.md'), /not found/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('runGoalAssistant with inline goal creates single claim', async () => {
  const rootDir = makeTmpDir();
  try {
    const result = await runGoalAssistant({
      rootDir,
      askQuestion: async () => '(not specified)',
      goal: 'All tests must pass',
    });
    const matchingGoal = result.goals.find(g => g.description.includes('All tests must pass'));
    assert.ok(matchingGoal, 'inline goal present in output');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
