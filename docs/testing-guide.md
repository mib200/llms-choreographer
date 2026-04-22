# Testing Guide — Choreographer

> See also: [Codebase Summary](./codebase-summary.md) · [System Architecture](./system-architecture.md) · [Deployment Guide](./deployment-guide.md)

## Overview

Tests live in `core/tests/` and use the Node.js built-in `node:test` framework — no external test runner required. All 32 assertions must pass before merging.

---

## How to Run

```bash
# Run all tests (via npm script)
npm test

# Run directly
node --test 'core/tests/*.test.mjs'

# Run a single file
node --test core/tests/vote.test.mjs

# Run with verbose output
node --test --reporter=spec 'core/tests/*.test.mjs'
```

**Expected output:** 32 passing, 0 failing.

---

## Test Strategy

Tests cover the `core/` library only — not the bundled plugin outputs or installer scripts. The strategy is:

1. **Unit-level helpers** — `stripFlags`, `parseOpenCodeOutput`, `parseClaudeStreamJson` are tested with direct input/output assertions.
2. **Integration via fake agents** — `council`, `vote`, `second-opinion`, and `check-all` commands are tested by injecting fake CLI binaries into `PATH` and running `companion.mjs` as a subprocess.
3. **Fallback/error paths** — `second-opinion-fallback` and `min-agents` tests verify graceful degradation when agents are unavailable.

---

## Test File Reference

| File | What it covers |
|------|----------------|
| `check-all.test.mjs` | `checkCli()` and `filterAvailable()` — availability detection, status codes (`ok`, `not-installed`, `unavailable`) |
| `json-output.test.mjs` | `printJSON()` output shape — `{ command, results[] }` envelope, field presence |
| `min-agents.test.mjs` | `requireAvailable()` — exits with non-zero code when fewer than `min` agents are available |
| `parse-opencode.test.mjs` | `parseOpenCodeOutput()` — ANSI escape stripping, empty line filtering, passthrough of clean input |
| `second-opinion-fallback.test.mjs` | `second-opinion` subcommand — uses fallback agent when preferred is unavailable |
| `strip-flags.test.mjs` | `stripFlags()` — removes `--json`, `--background`, `--wait`, `--agent=*`, `--agent *` from argv |
| `vote.test.mjs` | `vote` subcommand — collects per-agent votes, formats result, handles ties |

---

## `helpers/fake-agents.mjs`

The test helper provides two utilities:

### `createFakeAgents(agents, tmpDir)`

Creates fake CLI binaries (shell scripts) in a temp directory. Each script prints a deterministic response and exits 0. Returns a modified `PATH` string that prepends the temp directory.

Usage pattern in tests:

```js
import { createFakeAgents } from './helpers/fake-agents.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const tmp = mkdtempSync(tmpdir() + '/choreo-test-');
const env = createFakeAgents(['claude', 'codex'], tmp);
// pass env.PATH to spawnSync when running companion.mjs
```

### `runCompanion(args, env)`

Spawns `core/companion.mjs` as a subprocess with the given args and environment. Returns `{ stdout, stderr, status }`.

```js
import { runCompanion } from './helpers/fake-agents.mjs';

const { stdout, status } = runCompanion(['council', 'test task'], env);
assert.strictEqual(status, 0);
assert.match(stdout, /claude/);
```

---

## Coverage Expectations

| Area | Covered | Notes |
|------|---------|-------|
| `stripFlags` | Full | All flag variants |
| `parseClaudeStreamJson` | Full | Valid JSON, malformed lines, empty |
| `parseOpenCodeOutput` | Full | ANSI codes, empty lines, clean input |
| `checkCli` / `filterAvailable` | Full | Via fake PATH binaries |
| `requireAvailable` | Full | Min count enforcement, exit code |
| `council` subcommand | Integration | Via fake agents |
| `vote` subcommand | Integration | Via fake agents |
| `second-opinion` subcommand | Integration | Including fallback path |
| `parallel-review` / `parallel-debug` | Not tested | Structural similarity to council |
| `check-all` CLI output | Integration | stdout assertions |
| Installer (`bin/install.mjs`) | Not tested | File-system side effects |
| esbuild bundle output | Not tested | Build artifact, not source |

---

## Adding New Tests

1. Create `core/tests/<name>.test.mjs`.
2. Import from `node:test` and `node:assert`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```

3. Use `createFakeAgents` for any test that needs to spawn agent subprocesses.
4. Keep tests deterministic — no network calls, no real CLI binaries.
5. Run `npm test` to confirm all 32 + new assertions pass.

---

## CI / Automation

No CI pipeline is configured. Tests are run locally before commits. The `npm test` script is:

```json
"test": "node --test 'core/tests/*.test.mjs'"
```
