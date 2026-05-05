import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPANION = fileURLToPath(new URL('../../companion.mjs', import.meta.url));

const BINARY_MAP = {
  claude:   'claude',
  codex:    'codex',
  opencode: 'opencode',
};

/**
 * Create a temp directory with fake agent binaries.
 *
 * Agents in `names` respond normally (--version exits 0, other args echo output).
 * Agents in `unavailable` are created as stubs that exit 1 on --version — this
 * shadows the real binary on PATH and makes checkCli() report them as 'unavailable'.
 */
export function createFakeAgents(names, { unavailable = [], script, tmpBase } = {}) {
  const dir = mkdtempSync(join(tmpBase ?? tmpdir(), 'choreo-fake-'));

  for (const agentName of names) {
    const binary = BINARY_MAP[agentName] ?? agentName;
    const src = script
      ? script(agentName)
      : [
          '#!/bin/sh',
          'for arg in "$@"; do',
          '  if [ "$arg" = "--version" ]; then',
          `    echo "${binary}-fake 0.0.0"`,
          '    exit 0',
          '  fi',
          'done',
          `echo "AGENT:${agentName}::ARGS:$*"`,
        ].join('\n');

    const path = join(dir, binary);
    writeFileSync(path, src, 'utf8');
    chmodSync(path, 0o755);
  }

  for (const agentName of unavailable) {
    const binary = BINARY_MAP[agentName] ?? agentName;
    const src = '#!/bin/sh\nexit 1\n';
    const path = join(dir, binary);
    writeFileSync(path, src, 'utf8');
    chmodSync(path, 0o755);
  }

  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Spawn companion.mjs with a given set of args, injecting a fake PATH first
 * and an optional CHOREO_LOG_DIR for test isolation. `extraEnv` lets env-
 * allowlist tests inject both secrets (should be scrubbed) and opt-in vars.
 */
export function runCompanion(args, { path, logDir, extraEnv } = {}) {
  const env = { ...process.env, PATH: `${path}:${process.env.PATH}` };
  if (logDir) env.CHOREO_LOG_DIR = logDir;
  if (extraEnv) Object.assign(env, extraEnv);
  const result = spawnSync(
    process.execPath,
    [COMPANION, ...args],
    { encoding: 'utf8', env }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? 1,
  };
}
