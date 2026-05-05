/**
 * Goal-definition assistant — 3-phase interview for Verifier Loop goals.
 *
 * Phase 1: Scope — what the builder produces, what "done" means, what failure looks like.
 * Phase 2: Claim extraction — converts answers into candidate atomic claims grouped by verifier type.
 * Phase 3: Output — writes .choreographer/goals.json + per-verifier system prompts.
 *
 * Invocable via companion.mjs goals [--init | --verifier=<id>].
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStructuredOutput } from './parsers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOALS_SCHEMA = JSON.parse(
  readFileSync(join(__dirname, 'schemas/goals.schema.json'), 'utf8')
);

const GOALS_DIR = '.choreographer';
const VERIFIER_DIR = join(GOALS_DIR, 'verifier');

/**
 * Run the goal-definition interview.
 *
 * @param {object} opts
 * @param {string} opts.rootDir - Project root directory
 * @param {Function} opts.askQuestion - Function to ask user a question: (question) => Promise<string>
 * @param {string} [opts.goal] - Inline goal string (--goal="...")
 * @param {string} [opts.planFile] - Path to plan file to extract goals from
 * @returns {Promise<object>} goals.json content
 */
export async function runGoalAssistant({ rootDir, askQuestion, goal, planFile }) {
  const answers = { scope: {}, claims: {} };

  // Phase 1: Scope
  const scopeQuestions = [
    { key: 'produces', question: 'What should the builder produce? (e.g., "a React component", "a database migration")' },
    { key: 'done', question: 'What does "done" look like? (e.g., "all tests pass", "image renders correctly")' },
    { key: 'failure', question: 'What does failure look like? (e.g., "missing error handling", "schema mismatch")' },
  ];

  for (const q of scopeQuestions) {
    const answer = await askQuestion(q.question);
    answers.scope[q.key] = answer || '(not specified)';
  }

  // Phase 2: Claim extraction
  const claims = extractClaims(answers.scope, goal);
  answers.claims = claims;

  // Phase 3: Output
  const goalsJson = buildGoalsJson(claims);

  // Validate against schema
  const validated = parseStructuredOutput(JSON.stringify(goalsJson), GOALS_SCHEMA);

  // Write files
  writeGoalsFiles(rootDir, validated, claims);

  return validated;
}

/**
 * Extract atomic claims from scope answers.
 *
 * @param {object} scope
 * @param {string} [inlineGoal]
 * @returns {Array}
 */
function extractClaims(scope, inlineGoal) {
  const claims = [];
  let id = 1;

  // Claims from "done" criteria
  if (scope.done && scope.done !== '(not specified)') {
    claims.push({
      id: `c${id++}`,
      claim: `Builder output satisfies: "${scope.done}"`,
      verify: 'llm',
      confidence_threshold: 0.85,
    });
  }

  // Claims from "failure" criteria
  if (scope.failure && scope.failure !== '(not specified)') {
    claims.push({
      id: `c${id++}`,
      claim: `Builder output does NOT exhibit: "${scope.failure}"`,
      verify: 'llm',
      confidence_threshold: 0.85,
    });
  }

  // Inline goal
  if (inlineGoal) {
    claims.push({
      id: `c${id++}`,
      claim: inlineGoal,
      verify: 'llm',
      confidence_threshold: 0.85,
    });
  }

  return claims;
}

/**
 * Build goals.json content from claims.
 *
 * @param {Array} claims
 * @returns {object}
 */
function buildGoalsJson(claims) {
  return {
    goals: claims.map((c) => ({
      id: c.id,
      description: c.claim,
      verify: c.verify,
      confidence_threshold: c.confidence_threshold,
    })),
    confidence: 0.7,
    source: 'interview',
  };
}

/**
 * Write goals.json and per-verifier system prompts.
 *
 * @param {string} rootDir
 * @param {object} goalsJson
 * @param {Array} claims
 */
function writeGoalsFiles(rootDir, goalsJson, claims) {
  // Write goals.json
  const goalsPath = join(rootDir, GOALS_DIR, 'goals.json');
  mkdirSync(join(rootDir, GOALS_DIR), { recursive: true });
  writeFileSync(goalsPath, JSON.stringify(goalsJson, null, 2), 'utf8');

  // Write per-verifier system prompts
  const verifierTypes = new Set(claims.map((c) => c.verify));
  for (const type of verifierTypes) {
    const dir = join(rootDir, VERIFIER_DIR, type);
    mkdirSync(dir, { recursive: true });

    const typeClaims = claims.filter((c) => c.verify === type);
    const prompt = buildSystemPrompt(type, typeClaims);
    writeFileSync(join(dir, 'system-prompt.md'), prompt, 'utf8');
  }
}

/**
 * Build a system prompt for a verifier type.
 *
 * @param {string} type
 * @param {Array} claims
 * @returns {string}
 */
function buildSystemPrompt(type, claims) {
  return `# Verifier: ${type}

You are a verifier in the Choreographer Verifier Loop.

## Your Role
Verify the following claims about the builder's output:

${claims.map((c) => `- [${c.id}] ${c.claim}`).join('\n')}

## Rules
- After review, STOP. Do not fix the issues yourself.
- Report your findings using the verifier report schema.
- Be specific: cite file paths and line numbers where possible.
- If you cannot verify a claim, explain what you would need.
`;
}

/**
 * Initialize goals from a plan file.
 *
 * @param {string} rootDir
 * @param {string} planPath
 * @returns {object}
 */
export function initGoalsFromPlan(rootDir, planPath) {
  if (!existsSync(planPath)) {
    throw new Error(`Plan file not found: ${planPath}`);
  }

  const content = readFileSync(planPath, 'utf8');
  // Extract acceptance criteria from plan (simple heuristic: lines with "Acceptance" or "Criteria")
  const lines = content.split('\n');
  const criteria = [];
  let inCriteria = false;

  for (const line of lines) {
    if (/acceptance.?criteria/i.test(line)) {
      inCriteria = true;
      continue;
    }
    if (inCriteria && line.trim().startsWith('-')) {
      criteria.push(line.trim().slice(1).trim());
    }
    if (inCriteria && line.trim() === '') {
      inCriteria = false;
    }
  }

  const claims = criteria.map((c, i) => ({
    id: `c${i + 1}`,
    claim: c,
    verify: 'llm',
    confidence_threshold: 0.85,
  }));

  const goalsJson = buildGoalsJson(claims);
  goalsJson.source = 'plan';
  goalsJson.confidence = 0.8;

  writeGoalsFiles(rootDir, goalsJson, claims);

  return goalsJson;
}
