import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── agent registry ────────────────────────────────────────────────────────────

export const REGISTRY = {
  claude:    { binary: 'claude',   setup: '/claude:setup'    },
  codex:     { binary: 'codex',    setup: '/codex:setup'     },
  opencode:  { binary: 'opencode', setup: '/opencode:setup'  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns { status: 'ok' | 'not-installed' | 'unavailable', version: string }. */
export function checkCli(binary) {
  const r = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') return { status: 'not-installed', version: '' };
  if (r.error || r.status !== 0) return { status: 'unavailable', version: '' };
  return { status: 'ok', version: r.stdout.trim() };
}

/** Split an agent list into {available, missing}. missing entries carry a `reason` field. */
export function filterAvailable(agents) {
  const available = [];
  const missing = [];
  for (const a of agents) {
    const { status } = checkCli(a.binary);
    status === 'ok' ? available.push(a) : missing.push({ ...a, reason: status });
  }
  return { available, missing };
}

/** Print a warning block for skipped agents. Always goes to stderr so JSON stdout stays clean. */
export function printMissingWarning(missing) {
  if (missing.length === 0) return;
  console.error(`\n⚠ Skipped agents:`);
  for (const a of missing) {
    if (a.reason === 'not-installed') {
      console.error(`  ✗ ${a.name} — not installed. Run: ${REGISTRY[a.name]?.setup ?? `/${a.name}:setup`}`);
    } else {
      console.error(`  ✗ ${a.name} — unavailable (failed --version check). Check your installation.`);
    }
  }
}

export function stripFlags(args) {
  const result = [];
  let skipNext = false;
  for (const a of args) {
    if (skipNext) { skipNext = false; continue; }
    if (a === '--background' || a === '--wait' || a === '--json') continue;
    if (a === '--agent') { skipNext = true; continue; }
    if (a.startsWith('--agent=')) continue;
    result.push(a);
  }
  return result;
}

/** Parse claude --output-format stream-json --verbose output, extract assistant text. */
export function parseClaudeStreamJson(raw) {
  const text = raw.split('\n')
    .filter(l => l.trim())
    .flatMap(l => {
      try {
        const d = JSON.parse(l);
        if (d.type !== 'assistant') return [];
        return (d.message?.content ?? [])
          .filter(c => c.type === 'text')
          .map(c => c.text);
      } catch { return []; }
    })
    .join('');
  return text.trim() || raw.trim();
}

/** Strip ANSI escape codes and OpenCode progress lines, return clean text. */
export function parseOpenCodeOutput(raw) {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .split('\n')
    .filter(l => l.trim())
    .join('\n')
    .trim() || raw.trim();
}

export function runAgent(name, binary, args, parse = s => s) {
  return new Promise(resolve => {
    const out = [];
    const err = [];
    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', d => out.push(d));
    proc.stderr.on('data', d => err.push(d));
    proc.on('close', (code, signal) => resolve({
      name,
      output: parse(Buffer.concat(out).toString()).trim(),
      error:  Buffer.concat(err).toString().trim(),
      code:   code ?? (signal ? 1 : 0)
    }));
    proc.on('error', e => resolve({ name, output: '', error: e.message, code: 1 }));
  });
}

export function printDelimited(results) {
  for (const r of results) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`AGENT: ${r.name.toUpperCase()}`);
    console.log('═'.repeat(60));
    if (r.code !== 0 && !r.output) {
      console.log(`[error — exit ${r.code}]`);
      if (r.error) console.log(r.error);
    } else {
      console.log(r.output || r.error || '[no output]');
    }
  }
  console.log(`\n${'═'.repeat(60)}`);
}

export function printJSON(command, results) {
  console.log(JSON.stringify({
    command,
    results: results.map(r => ({ name: r.name, output: r.output, error: r.error, exitCode: r.code }))
  }));
}

/** Check availability, warn about missing, abort if fewer than `min` available. */
export function requireAvailable(agents, min = 2) {
  const { available, missing } = filterAvailable(agents);
  printMissingWarning(missing);
  if (available.length < min) {
    console.error(
      `\n✗ Not enough agents available (need at least ${min}, got ${available.length}).` +
      (missing.length ? `\n  Install the missing agents listed above.` : '')
    );
    process.exit(1);
  }
  return available;
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// Guard lets tests import helpers above without triggering the CLI dispatcher.

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [,, cmd, ...rest] = process.argv;

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

  // ── council ─────────────────────────────────────────────────────────────────

  if (cmd === 'council') {
    const jsonMode = rest.includes('--json');
    const task = stripFlags(rest).join(' ').trim();
    if (!task) { console.error('Usage: companion.mjs council <task>'); process.exit(1); }

    const agents = [
      {
        name: 'claude', binary: REGISTRY.claude.binary,
        args: ['--print', '--output-format', 'stream-json', '--verbose',
          `You are the CORRECTNESS reviewer in an LLM council.\n` +
          `Focus on: logic errors, type safety, off-by-one bugs, unhandled edge cases, security issues.\n` +
          `Be concise — bullet points preferred.\n\nTask: ${task}`,
          '--dangerously-skip-permissions'],
        parse: parseClaudeStreamJson
      },
      {
        name: 'codex', binary: REGISTRY.codex.binary,
        args: ['exec',
          `You are the SCOPE reviewer in an LLM council.\n` +
          `Focus on: unnecessary complexity, premature abstractions, whether the smallest solution was chosen.\n` +
          `Be concise — bullet points preferred.\n\nTask: ${task}`]
      },
      {
        name: 'opencode', binary: REGISTRY.opencode.binary,
        args: ['run',
          `You are the INTEGRATION reviewer in an LLM council.\n` +
          `Focus on: how this fits with existing codebase patterns, dependency implications, integration risks.\n` +
          `Be concise — bullet points preferred.\n\nTask: ${task}`,
          '--dangerously-skip-permissions'],
        parse: parseOpenCodeOutput
      }
    ];

    const available = requireAvailable(agents, 2);
    const results = await Promise.all(available.map(a => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON('council', results) : printDelimited(results);
  }

  // ── review ───────────────────────────────────────────────────────────────────

  if (cmd === 'review') {
    const jsonMode = rest.includes('--json');
    const gitResult = spawnSync('git', ['diff', 'HEAD'], { encoding: 'utf8' });
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

    const available = requireAvailable(agents, 2);
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

    const available = requireAvailable(agents, 2);
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

    const available = requireAvailable(agents, 2);
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

  const known = ['check-all', 'council', 'review', 'debug', 'second-opinion', 'vote'];

  if (!cmd || !known.includes(cmd)) {
    if (cmd) console.error(`Unknown command: "${cmd}"`);
    console.error('Usage: companion.mjs <check-all|council|review|debug|second-opinion|vote> [args...]');
    process.exit(1);
  }
}
