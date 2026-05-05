import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseClaudeStreamJson, parseOpenCodeOutput, parseStructuredOutput } from './parsers.mjs';
import {
  REGISTRY, checkCli, requireAvailable, runAgent, checkAgent,
  printDelimited, printJSON, stripFlags,
} from './runners.mjs';
import { emit } from './observability.mjs';
import { runCouncil } from './council.mjs';

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

    // Use adapter checkAvailability when available
    const availability = entry.adapter
      ? await entry.adapter.checkAvailability()
      : { available: checkCli(entry.binary).status === 'ok' };

    if (!availability.available && !availability.transport) {
      console.error(`Agent "${name}" is not installed. Run: ${entry.setup}`);
      process.exit(1);
    }

    // Build args based on agent type (legacy path when adapter not used)
    let args;
    let parse = s => s;
    switch (name) {
      case 'claude': {
        const claudeArgs = ['--print', '--output-format', 'stream-json', '--verbose', task, '--dangerously-skip-permissions'];
        if (modelEquals) claudeArgs.splice(0, 0, '--model', modelEquals);
        args = claudeArgs;
        parse = parseClaudeStreamJson;
        break;
      }
      case 'codex': {
        const codexArgs = ['exec', task];
        if (effortEquals) codexArgs.splice(0, 0, '--effort', effortEquals);
        if (modelEquals) codexArgs.splice(0, 0, '--model', modelEquals);
        args = codexArgs;
        break;
      }
      case 'opencode': {
        const opencodeArgs = ['run', task, '--dangerously-skip-permissions'];
        if (modelEquals) opencodeArgs.splice(1, 0, '--model', modelEquals);
        args = opencodeArgs;
        parse = parseOpenCodeOutput;
        break;
      }
      default:
        console.error(`Agent "${name}" not supported.`);
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

    // Use adapter only when --transport=acp is explicitly set
    const transportFlag = rest.find((a) => a.startsWith('--transport='))?.split('=')[1];
    const useAdapter = transportFlag === 'acp' && entry.adapter;

    if (useAdapter && availability.transport) {
      const result = await entry.adapter.invoke({
        prompt: task,
        model: modelEquals,
        effort: effortEquals,
        resumeSessionId: resumeEquals,
        mode: modeEquals,
      });

      if (jsonMode) {
        printJSON('agent', [{ name, output: result.output, error: result.error, exitCode: result.exitCode ?? 0 }]);
      } else {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`AGENT: ${result.name ?? name.toUpperCase()}`);
        console.log('═'.repeat(60));
        if (result.exitCode !== 0 && !result.output) {
          console.log(`[error — exit ${result.exitCode}]`);
          if (result.error) console.log(result.error);
        } else {
          console.log(result.output || result.error || '[no output]');
        }
        console.log(`\n${'═'.repeat(60)}`);
      }

      try {
        emit({
          type: 'agent_completion',
          name,
          exitCode: result.exitCode ?? 0,
          hasError: !!result.error,
          transport: result.transport,
        });
      } catch { /* observability must never block agent dispatch */ }

      const exitCode = typeof result.exitCode === 'number' ? result.exitCode : 1;
      await new Promise(resolve => process.stdout.write('', resolve));
      process.exit(exitCode);
    }

    // Legacy path: use runAgent with subprocess
    const result = await runAgent(name, entry.binary, args, parse);

    if (jsonMode) {
      printJSON('agent', [result]);
    } else {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`AGENT: ${result.name.toUpperCase()}`);
      console.log('═'.repeat(60));
      if (result.code !== 0 && !result.output) {
        console.log(`[error — exit ${result.code}]`);
        if (result.error) console.log(result.error);
      } else {
        console.log(result.output || result.error || '[no output]');
      }
      console.log(`\n${'═'.repeat(60)}`);
    }

    try {
      emit({
        type: 'agent_completion',
        name,
        exitCode: result.code,
        hasError: !!result.error,
      });
    } catch { /* observability must never block agent dispatch */ }

    const exitCode = typeof result.code === 'number' ? result.code : 1;
    await new Promise(resolve => process.stdout.write('', resolve));
    process.exit(exitCode);
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

    const agents = [
      {
        name: 'claude', binary: REGISTRY.claude.binary,
        args: ['--print', '--output-format', 'stream-json', '--verbose',
          `Review the following code changes for CORRECTNESS AND SECURITY.\n` +
          `Focus on: bugs, logic errors, security vulnerabilities, unsafe patterns.\n` +
          `Be concise — numbered findings.\n\n${diff}`,
          '--dangerously-skip-permissions'],
        parse: parseClaudeStreamJson
      },
      {
        name: 'codex', binary: REGISTRY.codex.binary,
        args: ['exec',
          `Review the following code changes for SCOPE AND SIMPLICITY.\n` +
          `Focus on: unnecessary complexity, changes that exceed the stated goal, simpler alternatives.\n` +
          `Be concise — numbered findings.\n\n${diff}`]
      },
      {
        name: 'opencode', binary: REGISTRY.opencode.binary,
        args: ['run',
          `Review the following code changes for EDGE CASES AND ROBUSTNESS.\n` +
          `Focus on: unhandled inputs, missing error handling, race conditions, what the author missed.\n` +
          `Be concise — numbered findings.\n\n${diff}`,
          '--dangerously-skip-permissions'],
        parse: parseOpenCodeOutput
      }
    ];

    let available;
    try { available = requireAvailable(agents, 2); } catch (e) { console.error(e.message); process.exit(1); }
    const results = await Promise.all(available.map(a => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON('review', results) : printDelimited(results);
  }

  // ── debug ────────────────────────────────────────────────────────────────────

  if (cmd === 'debug') {
    const jsonMode = rest.includes('--json');
    const symptom = stripFlags(rest).join(' ').trim();
    if (!symptom) { console.error('Usage: companion.mjs debug <symptom>'); process.exit(1); }

    const prompt = (focus) =>
      `A software bug has been reported. Generate a ranked list of hypotheses for the root cause.\n` +
      `Focus area: ${focus}.\n` +
      `Format: numbered list, most likely first, one sentence per hypothesis.\n\n` +
      `Symptom: ${symptom}`;

    const agents = [
      { name: 'claude', binary: REGISTRY.claude.binary,
        args: ['--print', '--output-format', 'stream-json', '--verbose', prompt('application logic, state management, data flow'), '--dangerously-skip-permissions'],
        parse: parseClaudeStreamJson },
      { name: 'codex', binary: REGISTRY.codex.binary,
        args: ['exec', prompt('edge cases in input handling, off-by-one errors, type coercion')] },
      { name: 'opencode', binary: REGISTRY.opencode.binary,
        args: ['run', prompt('infrastructure, concurrency, external dependencies, environment'),
          '--dangerously-skip-permissions'],
        parse: parseOpenCodeOutput }
    ];

    let available;
    try { available = requireAvailable(agents, 2); } catch (e) { console.error(e.message); process.exit(1); }
    const results = await Promise.all(available.map(a => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON('debug', results) : printDelimited(results);
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

    const agentDefs = {
      claude:   { binary: REGISTRY.claude.binary,   run: () => runAgent('claude',   REGISTRY.claude.binary,   ['--print', '--output-format', 'stream-json', '--verbose', prompt, '--dangerously-skip-permissions'], parseClaudeStreamJson) },
      codex:    { binary: REGISTRY.codex.binary,    run: () => runAgent('codex',    REGISTRY.codex.binary,    ['exec', prompt]) },
      opencode: { binary: REGISTRY.opencode.binary, run: () => runAgent('opencode', REGISTRY.opencode.binary, ['run', prompt, '--dangerously-skip-permissions'], parseOpenCodeOutput) },
    };

    if (requestedAgent && !agentDefs[requestedAgent]) {
      console.error(`Unknown agent: "${requestedAgent}". Choose from: ${Object.keys(agentDefs).join(', ')}`);
      process.exit(1);
    }

    const defaultOrder = ['claude', 'codex', 'opencode'];
    let chosenAgent = requestedAgent ?? 'claude';

    if (checkCli(agentDefs[chosenAgent].binary).status !== 'ok') {
      const fallback = (requestedAgent ? Object.keys(agentDefs) : defaultOrder)
        .find(n => n !== chosenAgent && checkCli(agentDefs[n].binary).status === 'ok');

      if (!fallback) {
        console.error(`Agent "${chosenAgent}" not found and no alternatives are available.`);
        console.error(`Install at least one agent: ${Object.keys(agentDefs).map(n => `${REGISTRY[n].setup}`).join(', ')}`);
        process.exit(1);
      }

      console.error(`⚠ Agent "${chosenAgent}" not found — using "${fallback}" instead.`);
      if (requestedAgent) {
        console.error(`  Install ${chosenAgent}: ${REGISTRY[chosenAgent].setup}`);
      }
      chosenAgent = fallback;
    }

    const result = await agentDefs[chosenAgent].run();
    if (jsonMode) {
      printJSON('second-opinion', [result]);
    } else {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`SECOND OPINION: ${result.name.toUpperCase()}`);
      console.log('═'.repeat(60));
      console.log(result.output || result.error || '[no output]');
      console.log(`\n${'═'.repeat(60)}`);
    }
  }

  // ── vote ─────────────────────────────────────────────────────────────────────

  if (cmd === 'vote') {
    const jsonMode = rest.includes('--json');
    const task = stripFlags(rest).join(' ').trim();
    if (!task) { console.error('Usage: companion.mjs vote <proposition>'); process.exit(1); }

    const prompt =
      `Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), ` +
      `followed by one sentence of rationale. No other text.\n\nProposition: ${task}`;

    const agents = [
      { name: 'claude', binary: REGISTRY.claude.binary,
        args: ['--print', '--output-format', 'stream-json', '--verbose', prompt, '--dangerously-skip-permissions'],
        parse: parseClaudeStreamJson },
      { name: 'codex', binary: REGISTRY.codex.binary,
        args: ['exec', prompt] },
      { name: 'opencode', binary: REGISTRY.opencode.binary,
        args: ['run', prompt, '--dangerously-skip-permissions'],
        parse: parseOpenCodeOutput }
    ];

    let available;
    try { available = requireAvailable(agents, 2); } catch (e) { console.error(e.message); process.exit(1); }
    const results = await Promise.all(available.map(a => runAgent(a.name, a.binary, a.args, a.parse)));

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
  }

  const known = ['check-all', 'agent', 'council', 'review', 'debug', 'second-opinion', 'vote', 'verify', 'goals', 'adversarial-review'];

  if (!cmd || !known.includes(cmd)) {
    if (cmd) console.error(`Unknown command: "${cmd}"`);
    console.error('Usage: companion.mjs <check-all|agent|council|review|debug|second-opinion|vote> [args...]');
    process.exit(1);
  }
}
