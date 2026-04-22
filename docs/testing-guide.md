# Testing Guide — Chorus

## Overview

Chorus uses Node.js's built-in `node --test` runner (no Jest, Vitest, or Mocha). There are two independent test suites:

| Suite | Location | Tests | What it covers |
|-------|----------|-------|---------------|
| Companion tests | `plugins/chorus/scripts/tests/` | ~29 tests | `companion.mjs` helper functions and subcommands |
| MCP integration tests | `for-opencode/src/tests/` | ~8 tests | MCP server tools (hermetic, real server process) |

---

## Running Tests

### All tests (both suites)

```bash
npm test
# Equivalent: node --test plugins/chorus/scripts/tests/*.test.mjs for-opencode/src/tests/*.test.mjs
```

### Companion tests only

```bash
node --test plugins/chorus/scripts/tests/*.test.mjs
```

### MCP tests only

```bash
node --test for-opencode/src/tests/*.test.mjs
```

### Single test file

```bash
node --test plugins/chorus/scripts/tests/vote.test.mjs
```

---

## Test Files

### Companion Test Suite (`plugins/chorus/scripts/tests/`)

| File | What it tests |
|------|--------------|
| `check-all.test.mjs` | `check-all` subcommand — agent availability detection |
| `vote.test.mjs` | `vote` subcommand — YES/NO/ABSTAIN parsing and tally |
| `second-opinion-fallback.test.mjs` | `second-opinion` fallback when preferred agent unavailable |
| `strip-flags.test.mjs` | `stripFlags()` helper — removes CLI flags from arg array |
| `min-agents.test.mjs` | Minimum agent enforcement (exits with code 1 if not met) |
| `json-output.test.mjs` | `--json` flag — validates structured output shape |
| `helpers/fake-agents.mjs` | Shared helper — fake CLI binaries for test isolation |

### MCP Test Suite (`for-opencode/src/tests/`)

| File | What it tests |
|------|--------------|
| `mcp.test.mjs` | `tools/list`, `check_agents`, `council`, `second_opinion`, `vote` over MCP stdio |
| `helpers/mcp-session.mjs` | Shared helper — starts/stops the real MCP server process |

---

## Test Architecture

### Fake Agents (companion tests)

All companion tests override `PATH` to inject fake agent binaries from `helpers/fake-agents.mjs`. Fake agents are minimal scripts that:

- Return predictable output (e.g., a fixed vote or review text)
- Exit with code 0 (simulating success)
- Never make real API calls

The `BINARY_MAP` in `fake-agents.mjs` maps agent names to their fake script paths. When adding a new agent, add an entry here.

```
helpers/fake-agents.mjs
  BINARY_MAP = {
    claude: <path to fake claude script>,
    gemini: <path to fake gemini script>,
    codex:  <path to fake codex script>,
    cursor: <path to fake cursor script>,   // binary name: "agent"
    kilo:   <path to fake kilo script>,
  }
```

### MCP Session Helper (MCP tests)

`helpers/mcp-session.mjs` starts the MCP server as a child process and provides a session object for sending JSON-RPC requests and receiving responses. Tests use this to verify:

- Tool list matches expected tools
- Tools return correct content structure
- Agent availability responses are well-formed

The MCP tests also override `PATH` to inject fake agents so no real CLIs are invoked.

---

## Writing New Tests

### Companion test template

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripFlags } from '../companion.mjs';  // import exported helpers

test('stripFlags removes --json', () => {
  const result = stripFlags(['--json', 'review', 'this']);
  assert.deepEqual(result, ['review', 'this']);
});
```

### MCP test template

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startMcpSession } from './helpers/mcp-session.mjs';

test('delegate_claude tool exists', async () => {
  const session = await startMcpSession();
  const response = await session.send({ method: 'tools/list' });
  const names = response.tools.map(t => t.name);
  assert.ok(names.includes('delegate_claude'));
  await session.close();
});
```

---

## Key Testing Invariants

1. **No real CLI calls in tests** — always use fake agents via PATH override
2. **MCP tests start a real server** — the server process is killed on test teardown
3. **`tools/list` test must match all 11 tools** — update when adding a new agent
4. **`BINARY_MAP` in both helpers must be kept in sync** with `REGISTRY` in `companion.mjs` and `BINARIES` in `index.js`

---

## Coverage Expectations

The test suite covers:

- All `companion.mjs` exported helpers (`stripFlags`, `checkCli`, etc.)
- All 6 subcommands (`check-all`, `council`, `review`, `debug`, `second-opinion`, `vote`)
- `--json` output mode
- Minimum agent enforcement and graceful degradation
- MCP `tools/list` completeness
- MCP tool invocation and response shape

The test suite does **not** cover:

- Real API responses from actual agent CLIs (integration testing with live CLIs)
- Network failures or credential errors

---

## See Also

- [Code Standards](code-standards.md) — conventions for `companion.mjs` and test helpers
- [System Architecture](system-architecture.md) — what each component does
