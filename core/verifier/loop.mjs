/**
 * Verifier loop — phase machine for the Verifier Loop capability.
 *
 * Trigger detection → atomic-claim decomposition → broker event handling →
 * re-prompt emission → round cap enforcement → oscillation detection → escalation.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseStructuredOutput } from '../parsers.mjs';
import { composeVerifiers } from './composer.mjs';
import { sanitizeFeedback } from './sanitizer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFIER_REPORT_SCHEMA = JSON.parse(
  readFileSync(join(__dirname, '../schemas/verifier-report.schema.json'), 'utf8')
);

const DEFAULT_MAX_ROUNDS = 3;
const VERIFIER_DIR = '.choreographer/verifier';

/** Extract value after first colon in a YAML line (handles colons in values). */
function yamlValue(line) {
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : '';
}

/**
 * Load verifier configuration from .choreographer/verifiers.yaml.
 *
 * @param {string} rootDir
 * @returns {Array}
 */
export function loadVerifierConfig(rootDir) {
  const configPath = join(rootDir, '.choreographer', 'verifiers.yaml');
  if (!existsSync(configPath)) return [];

  // Simple YAML parser for the verifier config shape
  const content = readFileSync(configPath, 'utf8');
  const verifiers = [];
  let current = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- id:')) {
      if (current) verifiers.push(current);
      current = { id: yamlValue(trimmed), depends_on: [], sandbox: {} };
    } else if (current && trimmed.startsWith('depends_on:')) {
      const val = yamlValue(trimmed);
      current.depends_on = val === '[]' ? [] : (val || '').replace(/[\[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (current && trimmed.startsWith('max_rounds:')) {
      current.max_rounds = parseInt(yamlValue(trimmed), 10) || DEFAULT_MAX_ROUNDS;
    } else if (current && trimmed.startsWith('description:')) {
      current.description = yamlValue(trimmed).replace(/^["']|["']$/g, '');
    } else if (current && trimmed.startsWith('allowed_script:')) {
      current.allowed_script = yamlValue(trimmed);
    } else if (current && trimmed.startsWith('triggers:')) {
      const val = yamlValue(trimmed);
      current.triggers = val === '[]' ? [] : (val || '').replace(/[\[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  if (current) verifiers.push(current);

  // Validate
  for (const v of verifiers) {
    if (!v.id) throw new Error('Verifier config missing id');
    for (const dep of v.depends_on || []) {
      if (!verifiers.find((vv) => vv.id === dep)) {
        throw new Error(`Verifier "${v.id}" depends on unknown verifier "${dep}"`);
      }
    }
  }

  return verifiers;
}

/**
 * Run the verifier loop for a builder run.
 *
 * @param {object} opts
 * @param {string} opts.rootDir - Project root directory
 * @param {string} opts.builderRunId - UUID of the builder run
 * @param {Array} opts.verifiers - Verifier definitions from config
 * @param {Function} opts.runVerifier - Function to run a single verifier: (verifierDef, builderRunId, round) => report
 * @param {number} [opts.maxRounds] - Maximum rounds (default: 3)
 * @param {boolean} [opts.autonomous] - Autonomous mode
 * @param {Function} [opts.onEscalation] - Callback for escalation: (type, details) => void
 * @param {Function} [opts.onRoundComplete] - Callback per round: (round, composite) => void
 * @returns {Promise<{converged: boolean, rounds: number, composite: object}>}
 */
export async function runVerifierLoop({
  rootDir,
  builderRunId,
  verifiers,
  runVerifier,
  maxRounds = DEFAULT_MAX_ROUNDS,
  autonomous = false,
  onEscalation,
  onRoundComplete,
}) {
  if (!verifiers || verifiers.length === 0) {
    return { converged: true, rounds: 0, composite: null };
  }

  let previousFailedClaims = null;
  let composite = null;

  for (let round = 1; round <= maxRounds; round++) {
    // Build verifier run functions
    const verifierRuns = verifiers.map((v) => ({
      id: v.id,
      depends_on: v.depends_on || [],
      run: () => runVerifier(v, builderRunId, round),
    }));

    // Compose and run
    const { reports, composite: roundComposite, conflicts } = await composeVerifiers({
      verifiers: verifierRuns,
      builderRunId,
      round,
    });

    composite = roundComposite;

    // Write feedback files for builder
    for (const report of reports) {
      writeFeedbackFile(rootDir, report.verifier_id, round, report);
    }

    if (onRoundComplete) {
      onRoundComplete(round, composite);
    }

    // Check convergence
    const converged = composite.failed_claims.length === 0 && !composite.improvement_needed;
    if (converged) {
      return { converged: true, rounds: round, composite };
    }

    // Oscillation detection: identical failed_claims set across 2 consecutive rounds
    const currentFailedSet = JSON.stringify(composite.failed_claims.map((c) => c.id).sort());
    if (previousFailedClaims !== null && currentFailedSet === previousFailedClaims) {
      if (onEscalation) {
        onEscalation('oscillation', { round, failed_claims: composite.failed_claims });
      }
      if (autonomous) {
        // In autonomous mode, escalate as critical fork
        return { converged: false, rounds: round, composite, escalated: 'oscillation' };
      }
      // Non-autonomous: stop and let user decide
      return { converged: false, rounds: round, composite, escalated: 'oscillation' };
    }
    previousFailedClaims = currentFailedSet;

    // Handle conflicts in autonomous mode
    if (conflicts.length > 0 && autonomous) {
      if (onEscalation) {
        onEscalation('critical-fork', { round, conflicts });
      }
      return { converged: false, rounds: round, composite, escalated: 'critical-fork' };
    }
  }

  // Round cap hit
  if (onEscalation) {
    onEscalation('round-cap', { rounds: maxRounds, composite });
  }

  return { converged: false, rounds: maxRounds, composite, escalated: 'round-cap' };
}

/**
 * Write a feedback file for the builder to read.
 *
 * @param {string} rootDir
 * @param {string} verifierId
 * @param {number} round
 * @param {object} report
 */
function writeFeedbackFile(rootDir, verifierId, round, report) {
  const dir = join(rootDir, VERIFIER_DIR, verifierId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `feedback-round-${round}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
}

/**
 * Check for pending feedback files from verifiers.
 *
 * @param {string} rootDir
 * @returns {Array<{verifier_id: string, round: number, report: object}>}
 */
export function checkPendingFeedback(rootDir) {
  const results = [];
  const verifierRoot = join(rootDir, VERIFIER_DIR);

  if (!existsSync(verifierRoot)) return results;

  for (const verifierId of readdirSync(verifierRoot)) {
    const dir = join(verifierRoot, verifierId);
    const files = readdirSync(dir).filter((f) => f.startsWith('feedback-round-') && f.endsWith('.json'));
    if (files.length === 0) continue;

    // Get the latest round
    const parsed = files
      .map((f) => ({ file: f, round: parseInt(f.replace('feedback-round-', '').replace('.json', ''), 10) }))
      .filter((x) => !isNaN(x.round))
      .sort((a, b) => a.round - b.round)
      .pop();
    if (!parsed) continue;
    const latest = parsed.file;
    const round = parsed.round;
    const content = readFileSync(join(dir, latest), 'utf8');
    const report = JSON.parse(content);

    results.push({ verifier_id: verifierId, round, report });
  }

  return results;
}

/**
 * Detect oscillation in verifier reports.
 *
 * @param {Array} previousFailedClaims - Claim IDs from previous round
 * @param {Array} currentFailedClaims - Claim IDs from current round
 * @returns {boolean}
 */
export function detectOscillation(previousFailedClaims, currentFailedClaims) {
  if (!previousFailedClaims || !currentFailedClaims) return false;
  const prevSet = JSON.stringify([...previousFailedClaims].sort());
  const currSet = JSON.stringify([...currentFailedClaims].sort());
  return prevSet === currSet;
}
