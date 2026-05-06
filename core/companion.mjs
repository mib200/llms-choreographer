import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseClaudeStreamJson, parseOpenCodeOutput, parseStructuredOutput } from './parsers.mjs';
import {
  REGISTRY, checkCli, requireAvailable, runAgent, checkAgent,
  printDelimited, printJSON, stripFlags,
} from './runners.mjs';
import { emit } from './observability.mjs';
import { createBroker } from './runtime/broker.mjs';
import { runCouncil } from './council.mjs';
import { runGoalAssistant, initGoalsFromPlan } from './goal-assistant.mjs';
import { loadVerifierConfig, runVerifierLoop, checkPendingFeedback } from './verifier/loop.mjs';
import { resolveReviewTarget, collectReviewContext } from './git.mjs';
import { renderReviewResult } from './review-render.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Build a privacy-preserving description of the user's task for structured logs.
// NDJSON is written to `~/.choreo/logs/` with 7-day retention — raw prompts can
// contain secrets/PII, so persist only a hash + length. Use the hash to correlate
// invocations across events (same task ⇒ same hash) without leaking content.
function describeTask(task) {
  return {
    task_hash: createHash('sha256').update(task, 'utf8').digest('hex').slice(0, 16),
    task_length: task.length,
  };
}

export { filterAvailable, printMissingWarning } from './runners.mjs';
export {
  REGISTRY, checkCli, requireAvailable, runAgent, checkAgent,
  printDelimited, printJSON, stripFlags,
  parseClaudeStreamJson, parseOpenCodeOutput, parseStructuredOutput,
};

// ── CLI entry point ───────────────────────────────────────────────────────────

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [,, cmd, ...rest] = process.argv;

  process.on('unhandledRejection', (err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });

  // ── check-all ───────────────────────────────────────────────────────────────

  if (cmd === 'check-all') {
    let ok = true;
    for (const [name, { binary, setup }] of Object.entries(REGISTRY)) {
      const { status, version } = checkCli(binary);
      if (status === 'ok') {
        console.log(`✓ ${name}: ${version}`);
      } else if (status === 'not-installed') {
        console.error(`✗ ${name} not installed. Run ${setup}`);
        ok = false;
      } else {
        console.error(`✗ ${name} unavailable (failed --version check). Check your installation.`);
        ok = false;
      }
    }
    process.exit(ok ? 0 : 1);
  }

  // ── agent ───────────────────────────────────────────────────────────────────

  if (cmd === 'agent') {
    // Known-flag allowlist parser. Only strip tokens the subcommand actually owns
    // (--json, --name=, --model=, --effort=, --resume=, --mode=). Any other `--*`
    // token is preserved as part of the task text, so user prompts like "explain
    // --force and --no-verify" survive verbatim. `--` is an explicit delimiter:
    // every token after it is task, regardless of leading dashes.
    let jsonMode = false;
    let nameEquals, modelEquals, effortEquals, resumeEquals, modeEquals, transportEquals;
    const taskTokens = [];
    let afterDashDash = false;
    for (const a of rest) {
      if (afterDashDash) { taskTokens.push(a); continue; }
      if (a === '--') { afterDashDash = true; continue; }
      if (a === '--json') { jsonMode = true; continue; }
      if (a.startsWith('--name='))    { nameEquals    = a.slice('--name='.length);    continue; }
      if (a.startsWith('--model='))   { modelEquals   = a.slice('--model='.length);   continue; }
      if (a.startsWith('--effort='))  { effortEquals  = a.slice('--effort='.length);  continue; }
      if (a.startsWith('--resume='))  { resumeEquals  = a.slice('--resume='.length);  continue; }
      if (a.startsWith('--mode='))    { modeEquals    = a.slice('--mode='.length);    continue; }
      if (a.startsWith('--transport=')) { transportEquals = a.slice('--transport='.length); continue; }
      taskTokens.push(a);
    }
    const task = taskTokens.join(' ').trim();

    if (!nameEquals) {
      console.error('Usage: companion.mjs agent --name=<claude|codex|opencode> [--model=...] [--effort=...] [--resume=...] [--mode=...] [--transport=acp|native] <task>');
      process.exit(1);
    }
    if (!task) {
      console.error('Usage: companion.mjs agent --name=<claude|codex|opencode> [--model=...] [--effort=...] [--resume=...] [--mode=...] [--transport=acp|native] <task>');
      process.exit(1);
    }

    const name = nameEquals;
    const entry = REGISTRY[name];
    if (!entry) {
      console.error(`Unknown agent: "${name}". Choose from: ${Object.keys(REGISTRY).join(', ')}`);
      process.exit(1);
    }

    const availability = entry.adapter
      ? await entry.adapter.checkAvailability()
      : { available: checkCli(entry.binary).status === 'ok' };
    if (!availability.available && !availability.transport) {
      console.error(`Agent "${name}" is not installed. Run: ${entry.setup}`);
      process.exit(1);
    }

    try {
      emit({
        type: 'agent_invocation',
        name,
        model: modelEquals,
        effort: effortEquals,
        mode: modeEquals,
        resume_session: resumeEquals,
        ...describeTask(task),
      });
    } catch { /* observability must never block agent dispatch */ }

    const broker = createBroker();
    await broker.sessionStart(`agent-${Date.now()}`);
    try {
      const result = await broker.invoke({
        agentName: name,
        prompt: task,
        model: modelEquals,
        effort: effortEquals,
        timeout: 5 * 60_000,
        idempotencyKey: `agent:${name}:${Date.now()}`,
        mode: modeEquals,
        resumeSessionId: resumeEquals,
      });

      const output = result.output || '';
      const exitCode = typeof result.exitCode === 'number' ? result.exitCode : 0;

      if (jsonMode) {
        printJSON('agent', [{ name, output, error: result.error || '', code: exitCode }]);
      } else {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`AGENT: ${name.toUpperCase()}`);
        console.log('═'.repeat(60));
        if (exitCode !== 0 && !output) {
          console.log(`[error — exit ${exitCode}]`);
          if (result.error) console.log(result.error);
        } else {
          console.log(output || result.error || '[no output]');
        }
        console.log(`\n${'═'.repeat(60)}`);
      }

      try {
        emit({ type: 'agent_completion', name, exitCode, hasError: !!result.error, transport: result.transport });
      } catch { /* observability must never block */ }

      await new Promise(resolve => process.stdout.write('', resolve));
      process.exit(exitCode);
    } catch (err) {
      console.error(`Agent "${name}" failed: ${err.message}`);
      process.exit(1);
    } finally {
      await broker.shutdown();
    }
  }

  // ── council ─────────────────────────────────────────────────────────────────

  if (cmd === 'council') {
    // Parse flags
    const jsonMode = rest.includes('--json');
    const nonInteractive = rest.includes('--non-interactive');
    const skipPreflight = rest.includes('--skip-preflight');

    const membersFlag = rest.find((a) => a.startsWith('--members='))?.split('=')[1];
    const members = membersFlag ? membersFlag.split(',').map((m) => m.trim()) : ['claude', 'codex'];

    // Parse --model=member:model,...
    const models = {};
    const modelFlag = rest.find((a) => a.startsWith('--model='))?.split('=')[1];
    if (modelFlag) {
      for (const entry of modelFlag.split(',')) {
        const [key, value] = entry.split(':');
        if (key && value) models[key.trim()] = value.trim();
      }
    }

    // Cross-validation: model keys must be in members
    const orphanKeys = Object.keys(models).filter((k) => !members.includes(k));
    if (orphanKeys.length > 0) {
      console.error(`[council] ERROR: --model keys not in --members: ${orphanKeys.join(', ')}`);
      process.exit(1);
    }

    const claudeRoleFlag = rest.find((a) => a.startsWith('--claude-role='))?.split('=')[1];
    const claudeRole = claudeRoleFlag === 'moderator' ? 'moderator' : 'debater';

    const roundsFlag = rest.find((a) => a.startsWith('--rounds='))?.split('=')[1];
    const rounds = roundsFlag ? Math.min(5, Math.max(1, parseInt(roundsFlag, 10) || 3)) : 3;

    // Task is everything after flags
    const flagPrefixes = ['--members=', '--model=', '--claude-role=', '--rounds=', '--skip-preflight', '--non-interactive', '--json'];
    const taskTokens = rest.filter((a) => !flagPrefixes.some((p) => a === p || a.startsWith(p)));
    const task = taskTokens.join(' ').trim();

    if (!task) {
      console.error('Usage: companion.mjs council [--members=...] [--model=...] [--rounds=N] [--skip-preflight] [--non-interactive] <task>');
      process.exit(1);
    }

    // Ensure claude is present unless moderator role
    if (!members.includes('claude') && claudeRole !== 'moderator') {
      members.unshift('claude');
    }

    // Phase 0.25: Confirm launch plan (skip in non-interactive)
    if (!nonInteractive) {
      console.log(`[council] Launch plan`);
      console.log(`  Topic : ${task.slice(0, 60)}`);
      console.log(`  Members: ${members.join(', ')}`);
      console.log(`  Rounds: ${rounds}`);
      console.log(`  Claude role: ${claudeRole}`);
      console.log(`  Skip preflight: ${skipPreflight}`);
      console.log(`\nLaunching council...`);
    }

    try {
      const result = await runCouncil({
        task,
        members,
        models,
        claudeRole,
        rounds,
        skipPreflight,
        nonInteractive,
        jsonMode,
      });

      if (jsonMode) {
        console.log(JSON.stringify({ command: 'council', slug: result.slug, confidence: result.confidence, rounds: result.rounds, decision: result.decision }));
      } else {
        console.log(result.decision);
      }
      process.exit(0);
    } catch (err) {
      console.error(`[council] Error: ${err.message}`);
      process.exit(1);
    }
  }

  // ── review ───────────────────────────────────────────────────────────────────

  if (cmd === 'review') {
    const jsonMode = rest.includes('--json');
    const gitResult = spawnSync('git', ['diff', 'HEAD'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (gitResult.error || gitResult.status !== 0) {
      const msg = gitResult.stderr?.trim() || gitResult.error?.message || `exit ${gitResult.status}`;
      console.error(`Failed to get git diff: ${msg}`);
      process.exit(1);
    }
    const diff = gitResult.stdout?.trim() || 'No uncommitted changes found.';

    const prompts = [
      { name: 'claude', prompt: `Review the following code changes for CORRECTNESS AND SECURITY.\nFocus on: bugs, logic errors, security vulnerabilities, unsafe patterns.\nBe concise — numbered findings.\n\n${diff}` },
      { name: 'codex', prompt: `Review the following code changes for SCOPE AND SIMPLICITY.\nFocus on: unnecessary complexity, changes that exceed the stated goal, simpler alternatives.\nBe concise — numbered findings.\n\n${diff}` },
      { name: 'opencode', prompt: `Review the following code changes for EDGE CASES AND ROBUSTNESS.\nFocus on: unhandled inputs, missing error handling, race conditions, what the author missed.\nBe concise — numbered findings.\n\n${diff}` },
    ];

    const broker = createBroker();
    await broker.sessionStart(`review-${Date.now()}`);
    let exitCode = 0;
    try {
      const results = await Promise.all(prompts.map(async (p) => {
        try {
          const r = await broker.invoke({ agentName: p.name, prompt: p.prompt, timeout: 5 * 60_000 });
          return { name: p.name, output: r.output || '', error: r.error || '', code: r.exitCode ?? 0 };
        } catch (err) {
          return { name: p.name, output: '', error: err.message, code: 1 };
        }
      }));
      exitCode = results.some(r => r.code !== 0) ? 1 : 0;
      jsonMode ? printJSON('review', results) : printDelimited(results);
    } finally {
      await broker.shutdown();
    }
    process.exit(exitCode);
  }

  // ── debug ────────────────────────────────────────────────────────────────────

  if (cmd === 'debug') {
    const jsonMode = rest.includes('--json');
    const symptom = stripFlags(rest).join(' ').trim();
    if (!symptom) { console.error('Usage: companion.mjs debug <symptom>'); process.exit(1); }

    const availableAgents = Object.entries(REGISTRY).filter(([, e]) => checkCli(e.binary).status === 'ok').map(([n]) => n);
    if (availableAgents.length < 2) {
      console.error('Not enough agents available (need at least 2 for debug). Install: /choreo:claude, /choreo:codex, /choreo:opencode');
      process.exit(1);
    }

    const makePrompt = (focus) =>
      `A software bug has been reported. Generate a ranked list of hypotheses for the root cause.\n` +
      `Focus area: ${focus}.\n` +
      `Format: numbered list, most likely first, one sentence per hypothesis.\n\n` +
      `Symptom: ${symptom}`;

    const focusByAgent = {
      claude: 'application logic, state management, data flow',
      codex: 'edge cases in input handling, off-by-one errors, type coercion',
      opencode: 'infrastructure, concurrency, external dependencies, environment',
    };
    const prompts = availableAgents.map(name => ({ name, prompt: makePrompt(focusByAgent[name] ?? 'general debugging') }));

    const broker = createBroker();
    await broker.sessionStart(`debug-${Date.now()}`);
    let exitCode = 0;
    try {
      const results = await Promise.all(prompts.map(async (p) => {
        try {
          const r = await broker.invoke({ agentName: p.name, prompt: p.prompt, timeout: 5 * 60_000 });
          return { name: p.name, output: r.output || '', error: r.error || '', code: r.exitCode ?? 0 };
        } catch (err) {
          return { name: p.name, output: '', error: err.message, code: 1 };
        }
      }));
      exitCode = results.some(r => r.code !== 0) ? 1 : 0;
      jsonMode ? printJSON('debug', results) : printDelimited(results);
    } finally {
      await broker.shutdown();
    }
    process.exit(exitCode);
  }

  // ── second-opinion ───────────────────────────────────────────────────────────

  if (cmd === 'second-opinion') {
    const jsonMode = rest.includes('--json');
    const agentEqualsFlag = rest.find(a => a.startsWith('--agent='))?.split('=')[1];
    const agentIndex = rest.indexOf('--agent');
    const agentNextValue = agentIndex !== -1 && rest[agentIndex + 1] && !rest[agentIndex + 1].startsWith('--')
      ? rest[agentIndex + 1] : undefined;
    const requestedAgent = agentEqualsFlag || agentNextValue || undefined;

    const task = stripFlags(rest).join(' ').trim();
    if (!task) {
      console.error('Usage: companion.mjs second-opinion [--agent claude|codex|opencode] <decision or approach>');
      process.exit(1);
    }

    const prompt =
      `Give a concise second opinion on the following decision or approach.\n` +
      `Be direct: state what you agree with, what concerns you, and your overall verdict (approve / approve-with-caveats / reject).\n\n` +
      `${task}`;

    const validAgents = Object.keys(REGISTRY);
    let chosenAgent = requestedAgent ?? 'claude';
    if (requestedAgent && !validAgents.includes(requestedAgent)) {
      console.error(`Unknown agent: "${requestedAgent}". Choose from: ${validAgents.join(', ')}`);
      process.exit(1);
    }

    if (checkCli(REGISTRY[chosenAgent].binary).status !== 'ok') {
      const fallback = validAgents.find(n => n !== chosenAgent && checkCli(REGISTRY[n].binary).status === 'ok');
      if (!fallback) {
        console.error(`Agent "${chosenAgent}" not found and no alternatives are available.`);
        console.error(`Install at least one agent: ${Object.keys(REGISTRY).map(n => `${REGISTRY[n].setup}`).join(', ')}`);
        process.exit(1);
      }
      console.error(`⚠ Agent "${chosenAgent}" not found — using "${fallback}" instead.`);
      chosenAgent = fallback;
    }

    const broker = createBroker();
    await broker.sessionStart(`second-opinion-${Date.now()}`);
    let exitCode = 0;
    try {
      const r = await broker.invoke({ agentName: chosenAgent, prompt, timeout: 5 * 60_000 });
      const result = { name: chosenAgent, output: r.output || '', error: r.error || '', code: r.exitCode ?? 0 };
      exitCode = result.code;
      if (jsonMode) {
        printJSON('second-opinion', [result]);
      } else {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`SECOND OPINION: ${chosenAgent.toUpperCase()}`);
        console.log('═'.repeat(60));
        console.log(result.output || result.error || '[no output]');
        console.log(`\n${'═'.repeat(60)}`);
      }
    } catch (err) {
      console.error(`Second opinion failed: ${err.message}`);
      process.exit(1);
    } finally {
      await broker.shutdown();
    }
    process.exit(exitCode);
  }

  // ── vote ─────────────────────────────────────────────────────────────────────

  if (cmd === 'vote') {
    const jsonMode = rest.includes('--json');
    const task = stripFlags(rest).join(' ').trim();
    if (!task) { console.error('Usage: companion.mjs vote <proposition>'); process.exit(1); }

    const prompt =
      `Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), ` +
      `followed by one sentence of rationale. No other text.\n\nProposition: ${task}`;

    const agentNames = ['claude', 'codex', 'opencode'];
    const broker = createBroker();
    await broker.sessionStart(`vote-${Date.now()}`);
    try {
      const results = await Promise.all(agentNames.map(async (name) => {
        try {
          const r = await broker.invoke({ agentName: name, prompt, timeout: 5 * 60_000 });
          return { name, output: r.output || '', error: r.error || '', code: r.exitCode ?? 0 };
        } catch (err) {
          return { name, output: '', error: err.message, code: 1 };
        }
      }));

      function parseVote(text) {
        const line = (text || '').split('\n').find(l => l.trim().length > 0) || '';
        const clean = line.replace(/[*_`]/g, '').trim().toUpperCase();
        if (/^YES\b/.test(clean)) return { vote: 'YES', rationale: line.replace(/^yes[^a-z]*/i, '').trim() };
        if (/^NO\b/.test(clean))  return { vote: 'NO',  rationale: line.replace(/^no[^a-z]*/i,  '').trim() };
        if (/^ABSTAIN\b/.test(clean)) return { vote: 'ABSTAIN', rationale: line.replace(/^abstain[^a-z]*/i, '').trim() };
        return { vote: 'INVALID', rationale: line };
      }

      const tally = { yes: 0, no: 0, abstain: 0, invalid: 0 };
      const parsed = results.map(r => {
        const { vote, rationale } = parseVote(r.output);
        tally[vote.toLowerCase()]++;
        return { name: r.name, vote, rationale, output: r.output, error: r.error, exitCode: r.code };
      });

      if (tally.invalid === parsed.length) {
        const msg = 'All agent votes were INVALID — no valid tally produced.';
        if (jsonMode) { console.log(JSON.stringify({ command: 'vote', error: msg, tally, results: parsed })); }
        else { console.error(msg); }
        process.exit(1);
      }

      if (jsonMode) {
        console.log(JSON.stringify({ command: 'vote', tally, results: parsed }));
      } else {
        const tallyLines = [
          `| Vote    | Count |`,
          `|---------|-------|`,
          `| YES     | ${tally.yes}     |`,
          `| NO      | ${tally.no}     |`,
          `| ABSTAIN | ${tally.abstain}     |`,
          tally.invalid > 0 ? `| INVALID | ${tally.invalid}     |` : null,
        ].filter(Boolean).join('\n');

        console.log('\n## Vote Tally\n');
        console.log(tallyLines);
        console.log('\n## Per-Agent Rationale\n');
        for (const r of parsed) {
          console.log(`\n${'═'.repeat(60)}`);
          console.log(`${r.name.toUpperCase()}: ${r.vote}`);
          console.log('═'.repeat(60));
          console.log(r.rationale || r.output || '[no output]');
        }
        console.log(`\n${'═'.repeat(60)}`);
      }
    } finally {
      await broker.shutdown();
    }
    process.exit(0);
  }

  // ── goals ────────────────────────────────────────────────────────────────────

  if (cmd === 'goals') {
    const initFlag = rest.includes('--init');
    const verifierFlag = rest.find((a) => a.startsWith('--verifier='))?.split('=')[1];
    const goalFlag = rest.find((a) => a.startsWith('--goal='))?.split('=')[1];
    const planFlag = rest.find((a) => a.startsWith('--plan='))?.split('=')[1];

    if (initFlag) {
      if (!planFlag) {
        console.error('Usage: companion.mjs goals --init --plan=<path-to-plan.md>');
        process.exit(1);
      }
      const goalsJson = initGoalsFromPlan(process.cwd(), planFlag);
      console.log(`Goals initialized from plan: ${planFlag}`);
      console.log(JSON.stringify(goalsJson, null, 2));
      process.exit(0);
    }

    // Interactive mode
    const askQuestion = async (question) => {
      console.log(`[goals] ${question}`);
      // In non-interactive mode, use default
      return '(not specified)';
    };

    try {
      const goalsJson = await runGoalAssistant({
        rootDir: process.cwd(),
        askQuestion,
        goal: goalFlag,
        planFile: planFlag,
      });
      console.log('Goals written to .choreographer/goals.json');
      console.log(JSON.stringify(goalsJson, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(`[goals] Error: ${err.message}`);
      process.exit(1);
    }
  }

  // ── verify ───────────────────────────────────────────────────────────────────

  if (cmd === 'verify') {
    const jsonMode = rest.includes('--json');
    const autonomous = rest.includes('--autonomous');
    const maxRoundsFlag = rest.find((a) => a.startsWith('--rounds='))?.split('=')[1];
    const maxRounds = maxRoundsFlag ? parseInt(maxRoundsFlag, 10) : 3;

    const verifiers = loadVerifierConfig(process.cwd());
    if (verifiers.length === 0) {
      console.error('[verify] No verifiers configured. Create .choreographer/verifiers.yaml');
      process.exit(1);
    }

    // Check for pending feedback
    const pending = checkPendingFeedback(process.cwd());
    if (pending.length > 0 && !jsonMode) {
      console.log(`[verify] Found ${pending.length} pending verifier feedback file(s):`);
      for (const p of pending) {
        console.log(`  - ${p.verifier_id} (round ${p.round})`);
      }
    }

    const { randomUUID } = await import('node:crypto');
    const broker = createBroker();
    await broker.sessionStart(`verify-${Date.now()}`);
    try {
      const result = await runVerifierLoop({
        rootDir: process.cwd(),
        builderRunId: randomUUID(),
        verifiers,
        maxRounds,
        autonomous,
        runVerifier: async (verifierDef, builderRunId, round) => {
          const agentName = verifierDef.model?.split('/')[0] || 'codex';
          const systemPromptPath = join(process.cwd(), '.choreographer', 'verifier', verifierDef.id, 'system-prompt.md');
          let systemPrompt = `Verify claims for builder run ${builderRunId}, round ${round}. Verifier: ${verifierDef.id}.`;
          try { systemPrompt = readFileSync(systemPromptPath, 'utf8'); } catch { /* use default */ }

          const r = await broker.invoke({
            agentName,
            prompt: systemPrompt,
            model: verifierDef.model?.split('/')[1],
            timeout: 5 * 60_000,
          });
          if (r.structured) return r.structured;
          try { return JSON.parse(r.output); } catch { return { verifier_id: verifierDef.id, builder_run_id: builderRunId, round, status: 'error', confidence: 0, verified_claims: [], failed_claims: [], couldnt_verify: [{ id: 'parse', claim: 'output parsing', reason: 'verifier output not valid JSON' }], feedback_given: null, improvement_needed: null }; }
        },
        onEscalation: (type, details) => {
          console.error(`[verify] Escalation: ${type}`, JSON.stringify(details));
        },
        onRoundComplete: (round, composite) => {
          if (!jsonMode) console.log(`[verify] Round ${round}: ${composite.status} (${composite.failed_claims.length} failed)`);
        },
      });

      if (jsonMode) {
        console.log(JSON.stringify({ command: 'verify', converged: result.converged, rounds: result.rounds, composite: result.composite }));
      } else {
        console.log(`[verify] ${result.converged ? 'Converged' : 'Not converged'} after ${result.rounds} round(s)`);
        if (result.composite?.failed_claims?.length > 0) {
          console.log(`[verify] Failed claims: ${result.composite.failed_claims.map(c => c.id).join(', ')}`);
        }
        if (result.escalated) console.log(`[verify] Escalated: ${result.escalated}`);
      }
      process.exit(result.converged ? 0 : 1);
    } catch (err) {
      console.error(`[verify] Error: ${err.message}`);
      process.exit(1);
    } finally {
      await broker.shutdown();
    }
  }

  // ── adversarial-review ───────────────────────────────────────────────────────

  if (cmd === 'adversarial-review') {
    const jsonMode = rest.includes('--json');
    const scopeFlag = rest.find((a) => a.startsWith('--scope='))?.split('=')[1];
    const baseFlag = rest.find((a) => a.startsWith('--base='))?.split('=')[1];
    const focusTokens = rest.filter((a) => !a.startsWith('--') && !['--json'].includes(a));
    const userFocus = focusTokens.join(' ') || 'general code review';

    const options = { scope: scopeFlag, base: baseFlag };
    const target = resolveReviewTarget(process.cwd(), options);
    const context = collectReviewContext(process.cwd(), target, {
      maxInlineFiles: 2,
      maxInlineDiffBytes: 256 * 1024,
    });

    // Load adversarial review prompt template
    const promptTemplate = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'prompts', 'adversarial-review.md'),
      'utf8'
    );

    // Load review output schema
    const reviewSchema = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'schemas', 'review-output.schema.json'),
        'utf8'
      )
    );

    // Interpolate prompt template
    const prompt = promptTemplate
      .replace('{{TARGET_LABEL}}', context.summary)
      .replace('{{USER_FOCUS}}', userFocus)
      .replace('{{REVIEW_COLLECTION_GUIDANCE}}', context.collectionGuidance)
      .replace('{{REVIEW_INPUT}}', context.content);

    // Dispatch to Codex adapter with structured output
    const codexEntry = REGISTRY.codex;
    if (!codexEntry) {
      console.error('[adversarial-review] Codex agent not available.');
      process.exit(1);
    }

    try {
      emit({
        type: 'adversarial_review',
        target: context.summary,
        scope: target.mode,
        file_count: context.fileCount,
        diff_bytes: context.diffBytes,
      });
    } catch { /* observability must never block */ }

    const broker = createBroker();
    await broker.sessionStart(`adversarial-review-${Date.now()}`);
    let result;
    try {
      const r = await broker.invoke({ agentName: 'codex', prompt, timeout: 5 * 60_000, structuredSchema: reviewSchema });
      result = { name: 'codex', output: r.output || '', error: r.error || '', code: r.exitCode ?? 0 };
    } catch (err) {
      result = { name: 'codex', output: '', error: err.message, code: 1 };
    } finally {
      await broker.shutdown();
    }

    let parsed = null;
    try {
      parsed = result.output ? parseStructuredOutput(result.output, reviewSchema) : null;
    } catch { /* graceful degradation — raw output still available */ }

    const rendered = renderReviewResult({ ...result, parsed, rawOutput: result.output }, {
      targetLabel: context.summary,
      reviewLabel: 'Adversarial Review',
    });

    if (jsonMode) {
      console.log(JSON.stringify({ command: 'adversarial-review', target: context.summary, verdict: parsed?.verdict, findings: parsed?.findings || [] }));
    } else {
      console.log(rendered);
    }
    process.exit(0);
  }

  const known = ['check-all', 'agent', 'council', 'review', 'debug', 'second-opinion', 'vote', 'verify', 'goals', 'adversarial-review'];

  if (!cmd || !known.includes(cmd)) {
    if (cmd) console.error(`Unknown command: "${cmd}"`);
    console.error('Usage: companion.mjs <check-all|agent|council|review|debug|second-opinion|vote> [args...]');
    process.exit(1);
  }
}
