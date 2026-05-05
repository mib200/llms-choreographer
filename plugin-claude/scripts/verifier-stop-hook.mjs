#!/usr/bin/env node
/**
 * Verifier Stop Hook — emits BLOCK envelopes when verifier feedback is pending.
 *
 * Ported from the external plugin's stop-review-gate-hook.mjs, adapted for
 * structured verifier report inputs (not just first-line parse).
 *
 * Called by Claude Code on builder stop. Checks for pending feedback files
 * from the Verifier Loop. If present, emits a JSON BLOCK envelope.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const VERIFIER_DIR = '.choreographer/verifier';

/**
 * Main entry point.
 *
 * @returns {Promise<object|null>} BLOCK envelope or null
 */
export async function runStopHook() {
  const rootDir = process.cwd();
  const verifierRoot = join(rootDir, VERIFIER_DIR);

  if (!existsSync(verifierRoot)) {
    return null;
  }

  const feedbackFiles = [];
  for (const verifierId of readdirSync(verifierRoot)) {
    const dir = join(verifierRoot, verifierId);
    const files = readdirSync(dir).filter((f) => f.startsWith('feedback-round-') && f.endsWith('.json'));
    if (files.length === 0) continue;

    const latest = files.sort().pop();
    const content = readFileSync(join(dir, latest), 'utf8');
    const report = JSON.parse(content);
    feedbackFiles.push({ verifier_id: verifierId, report });
  }

  if (feedbackFiles.length === 0) {
    return null;
  }

  // Build BLOCK reason from pending feedback
  const reasons = [];
  for (const { verifier_id, report } of feedbackFiles) {
    if (report.failed_claims && report.failed_claims.length > 0) {
      reasons.push(`[${verifier_id}] ${report.failed_claims.length} failed claim(s)`);
    }
    if (report.improvement_needed) {
      reasons.push(`[${verifier_id}] improvement needed: ${report.improvement_needed.slice(0, 100)}`);
    }
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    decision: 'block',
    reason: reasons.join('\n'),
    feedback_files: feedbackFiles.map((f) => f.verifier_id),
  };
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('verifier-stop-hook.mjs')) {
  runStopHook().then((result) => {
    if (result) {
      console.log(JSON.stringify(result));
    }
    process.exit(0);
  }).catch((err) => {
    console.error(`Stop hook error: ${err.message}`);
    process.exit(1);
  });
}
