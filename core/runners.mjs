import { spawn, spawnSync } from 'node:child_process';

export const REGISTRY = {
  claude:   { binary: 'claude',   setup: '/choreo:claude'   },
  codex:    { binary: 'codex',    setup: '/choreo:codex'    },
  opencode: { binary: 'opencode', setup: '/choreo:opencode' },
};

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
