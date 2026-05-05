/**
 * Verifier composer — parallel/sequential composition with conflict detection.
 *
 * Runs verifiers in parallel by default. Sequential chains via depends_on.
 * Detects conflicts when parallel verifiers disagree on the same claim ID.
 */

import { sanitizeFeedback } from './sanitizer.mjs';

/**
 * Compose verifier reports from multiple verifiers.
 *
 * @param {object} opts
 * @param {Array<{id: string, run: Function, depends_on?: string[]}>} opts.verifiers
 * @param {string} opts.builderRunId
 * @param {number} opts.round
 * @returns {Promise<{reports: Array, composite: object, conflicts: Array}>}
 */
export async function composeVerifiers({ verifiers, builderRunId, round }) {
  const reports = [];
  const conflicts = [];

  // Build dependency graph
  const resolved = new Set();
  const running = new Map();

  async function runVerifier(verifierDef) {
    if (resolved.has(verifierDef.id)) return;
    if (running.has(verifierDef.id)) return running.get(verifierDef.id);

    // Mark as running immediately to prevent double-execution
    const promise = (async () => {
      // Wait for dependencies
      const deps = verifierDef.depends_on || [];
      await Promise.all(deps.map((depId) => {
        const dep = verifiers.find((v) => v.id === depId);
        if (!dep) throw new Error(`Unknown dependency: ${depId}`);
        return runVerifier(dep);
      }));

      const result = await verifierDef.run();
      resolved.add(verifierDef.id);
      reports.push({ verifier_id: verifierDef.id, ...result });
      return result;
    })();

    running.set(verifierDef.id, promise);
    return promise;
  }

  // Run all verifiers (parallel for independent, sequential for depends_on)
  await Promise.all(verifiers.map((v) => runVerifier(v)));

  // Detect conflicts: same claim ID with different verdicts
  const claimVerdicts = new Map();
  for (const report of reports) {
    for (const claim of report.verified_claims || []) {
      if (!claimVerdicts.has(claim.id)) claimVerdicts.set(claim.id, []);
      claimVerdicts.get(claim.id).push({ verifier_id: report.verifier_id, verdict: 'verified' });
    }
    for (const claim of report.failed_claims || []) {
      if (!claimVerdicts.has(claim.id)) claimVerdicts.set(claim.id, []);
      claimVerdicts.get(claim.id).push({ verifier_id: report.verifier_id, verdict: 'failed' });
    }
  }

  for (const [claimId, verdicts] of claimVerdicts) {
    const uniqueVerdicts = new Set(verdicts.map((v) => v.verdict));
    if (uniqueVerdicts.size > 1) {
      conflicts.push({
        claim_id: claimId,
        verdicts,
        reason: 'conflict',
      });
    }
  }

  // Build composite report
  const composite = buildComposite(reports, conflicts, builderRunId, round);

  return { reports, composite, conflicts };
}

/**
 * Build a composite report from individual verifier reports.
 *
 * @param {Array} reports
 * @param {Array} conflicts
 * @param {string} builderRunId
 * @param {number} round
 * @returns {object}
 */
function buildComposite(reports, conflicts, builderRunId, round) {
  const allVerified = [];
  const allFailed = [];
  const allCouldntVerify = [];
  const allScriptOutputs = [];
  let anyImprovementNeeded = null;
  let anyFeedback = null;
  let hasError = false;
  let hasFailure = false;

  for (const report of reports) {
    allVerified.push(...(report.verified_claims || []));
    allFailed.push(...(report.failed_claims || []));
    allCouldntVerify.push(...(report.couldnt_verify || []));
    allScriptOutputs.push(...(report.script_outputs || []));

    if (report.improvement_needed && !anyImprovementNeeded) {
      anyImprovementNeeded = report.improvement_needed;
    }
    if (report.feedback_given && !anyFeedback) {
      anyFeedback = report.feedback_given;
    }
    if (report.status === 'error') hasError = true;
    if (report.status === 'fail') hasFailure = true;
  }

  // Add conflicts to couldnt_verify
  for (const conflict of conflicts) {
    allCouldntVerify.push({
      id: conflict.claim_id,
      claim: `Conflict on claim ${conflict.claim_id}`,
      reason: 'conflict',
      needed: 'user resolution',
    });
  }

  let status = 'pass';
  if (hasError) status = 'error';
  else if (hasFailure || allFailed.length > 0) status = 'fail';
  else if (anyImprovementNeeded) status = 'feedback';

  return {
    verifier_id: 'composite',
    builder_run_id: builderRunId,
    round,
    status,
    confidence: computeCompositeConfidence(reports),
    verified_claims: allVerified,
    failed_claims: allFailed,
    couldnt_verify: allCouldntVerify,
    feedback_given: sanitizeFeedback(anyFeedback),
    improvement_needed: anyImprovementNeeded,
    script_outputs: allScriptOutputs,
    verifier_count: reports.length,
    conflicts,
  };
}

/**
 * Compute composite confidence from individual verifier confidences.
 *
 * @param {Array} reports
 * @returns {number}
 */
function computeCompositeConfidence(reports) {
  if (reports.length === 0) return 0;
  const sum = reports.reduce((acc, r) => acc + (r.confidence || 0), 0);
  return Math.round((sum / reports.length) * 100) / 100;
}
