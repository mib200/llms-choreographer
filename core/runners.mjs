import { spawn, spawnSync } from 'node:child_process';
import { ClaudeAdapter } from './agents/claude.mjs';
import { CodexAdapter } from './agents/codex.mjs';
import { OpenCodeAdapter } from './agents/opencode.mjs';

export const REGISTRY = {
  claude:   { binary: 'claude',   setup: '/choreo:claude',   adapter: new ClaudeAdapter() },
  codex:    { binary: 'codex',    setup: '/choreo:codex',    adapter: new CodexAdapter() },
  opencode: { binary: 'opencode', setup: '/choreo:opencode', adapter: new OpenCodeAdapter() },
};

const CLI_CHECK_TIMEOUT_MS = 5_000;
const AGENT_TIMEOUT_MS = 5 * 60_000;

// Env allowlist for spawned agent processes. Default policy: forward only what
// child tools need (system basics + known agent-auth vars). Blocks secrets from
// the parent shell (AWS_*, GITHUB_TOKEN, NPM_TOKEN, DB creds, etc.) that have no
// reason to reach a child agent binary.
// Opt-out: set CHOREO_AGENT_ENV_PASSTHROUGH=1 to forward the full parent env
// (needed e.g. for AWS Bedrock-backed Claude where AWS_* must reach the child).
const ENV_ALLOW_EXACT = new Set([
  // Locale + shell basics.
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'TZ', 'TMPDIR',
  'LANG', 'PWD', 'NO_COLOR', 'FORCE_COLOR',
  // Node runtime knobs that affect tool behavior predictably.
  'NODE_OPTIONS', 'NODE_ENV',
  // Anthropic / Claude CLI direct-API keys (read by `claude`).
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
  // OpenAI / Codex CLI direct-API keys.
  'OPENAI_API_KEY', 'OPENAI_BASE_URL',
  // Choreo configuration so tests + ops signals flow to the child.
  'CHOREO_LOG_DIR', 'CHOREO_LOG_MAX_BYTES', 'CHOREO_AGENT_ENV_PASSTHROUGH',
]);
// Prefix allowlist covers vendor-namespaced vars without enumerating every one.
const ENV_ALLOW_PREFIXES = [
  'LC_', 'XDG_',
  'ANTHROPIC_', 'CLAUDE_', 'OPENCODE_', 'CODEX_',
];

export function buildAgentEnv(src = process.env) {
  if (src.CHOREO_AGENT_ENV_PASSTHROUGH === '1') return { ...src };
  const out = Object.create(null);
  for (const [key, value] of Object.entries(src)) {
    if (ENV_ALLOW_EXACT.has(key) || ENV_ALLOW_PREFIXES.some(p => key.startsWith(p))) {
      out[key] = value;
    }
  }
  return out;
}

/** Returns { status: 'ok' | 'not-installed' | 'unavailable', version: string }. */
export function checkCli(binary) {
  const r = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: CLI_CHECK_TIMEOUT_MS });
  if (r.error?.code === 'ENOENT') return { status: 'not-installed', version: '' };
  if (r.error || r.status !== 0) return { status: 'unavailable', version: '' };
  return { status: 'ok', version: r.stdout.trim() };
}

/** Check availability using adapter when available, falling back to CLI check. */
export async function checkAgent(name) {
  const entry = REGISTRY[name];
  if (!entry) return { available: false, reason: 'unknown agent' };
  if (entry.adapter) {
    return entry.adapter.checkAvailability();
  }
  const { status } = checkCli(entry.binary);
  return { available: status === 'ok', transport: status === 'ok' ? 'native' : undefined, reason: status !== 'ok' ? status : undefined };
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
    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildAgentEnv() });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ name, output: '', error: `agent timed out after ${AGENT_TIMEOUT_MS / 1000}s`, code: 1 });
    }, AGENT_TIMEOUT_MS);

    proc.stdout.on('data', d => out.push(d));
    proc.stderr.on('data', d => err.push(d));
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        name,
        output: parse(Buffer.concat(out).toString()).trim(),
        error:  Buffer.concat(err).toString().trim(),
        code:   code ?? (signal ? 1 : 0)
      });
    });
    proc.on('error', e => { clearTimeout(timer); resolve({ name, output: '', error: e.message, code: 1 }); });
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

/** Check availability, warn about missing, throw if fewer than `min` available. */
export function requireAvailable(agents, min = 2) {
  const { available, missing } = filterAvailable(agents);
  printMissingWarning(missing);
  if (available.length < min) {
    throw new Error(
      `Not enough agents available (need at least ${min}, got ${available.length}).` +
      (missing.length ? ` Install the missing agents listed above.` : '')
    );
  }
  return available;
}
