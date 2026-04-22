# Code Standards — Chorus

## Language and Runtime

- **JavaScript ESM only** — all `.mjs` and `.js` files use `import`/`export`, never `require()`
- **Node.js ≥ 18.18.0** — use built-in `node:test`, `node:assert`, `child_process` (no test framework deps)
- **No build step** — source files run directly; no TypeScript, no transpilation
- **No external dependencies** in the root package; `@modelcontextprotocol/sdk` is only in `for-opencode/`

---

## File Naming Conventions

| Pattern | Usage |
|---------|-------|
| `companion.mjs` | Orchestrator scripts (one per plugin dir that needs one) |
| `SKILL.md` | Gemini/Codex/Kilo skill files (uppercase, no suffix variation) |
| `RULE.mdc` | Cursor rule files (uppercase `.mdc` extension) |
| `plugin.json` | Claude Code plugin manifests |
| `*.test.mjs` | Test files (picked up by `node --test *.test.mjs`) |
| `helpers/*.mjs` | Shared test helpers (not test files themselves) |

---

## companion.mjs Conventions

### Structure

```
companion.mjs
├── imports (top-level, ESM)
├── REGISTRY constant — agent name → { binary, setup }
├── Helper functions (exported for tests)
│   ├── checkCli(binary) → { status, version }
│   ├── stripFlags(args) → string[]
│   └── printMissingWarning(missing)
├── CLI entry point guard:
│   if (fileURLToPath(import.meta.url) === process.argv[1]) { ... }
└── Subcommand dispatch: check-all | council | review | debug | second-opinion | vote
```

### CLI Guard Pattern

Tests import `companion.mjs` as a module to access exported helpers. The CLI dispatch block **must** be guarded:

```js
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // CLI dispatch here — never runs during import
}
```

### Agent Spawning

- Use `spawnSync` for parallel blocking invocations (standard pattern for council/review/debug/vote)
- Pass `{ encoding: 'utf8', timeout: 120000 }` to capture output and prevent hangs
- Always check `result.status` and `result.error` before using `result.stdout`
- Non-interactive flags per agent (canonical, from `.github/instructions/skill-files.instructions.md`):

| Agent | Non-interactive flag |
|-------|---------------------|
| `claude` | `--print` |
| `gemini` | `--yolo` (or `-y`) |
| `codex` | `--full-auto` |
| `agent` (Cursor) | `--headless` |
| `kilo` | `--yes` |

### Output Formatting

- Delimited text (default): sections separated by `═` lines, agent name as header
- JSON mode (`--json`): structured object — see [System Architecture](system-architecture.md)
- Warnings about unavailable agents always go to **stderr**, never stdout
- `stripFlags(rest)` must be called before joining args into the task string

### Graceful Degradation

- `council`, `review`, `debug`, `vote` require `--min-agents` (default 2) available agents
- `second-opinion` requires at least 1
- If minimum not met: print error to stderr, `process.exit(1)`
- If some agents unavailable but minimum met: proceed, print warning via `printMissingWarning`

---

## MCP Server Conventions (`for-opencode/src/index.js`)

- All tools defined in the `TOOLS` array with `name`, `description`, `inputSchema`
- Tool handlers use `requireString(value, paramName)` for input validation — throws descriptive errors
- Async handlers use `await`; sync CLI checks use `spawnSync`
- Tool descriptions include behavioral notes (strict mode, fallback behavior, output format)
- Server name: `chorus-opencode`, version matches `package.json`

---

## Slash Command Files (`.md`)

Claude Code command files follow this header convention:

```yaml
---
disable-model-invocation: true   # REQUIRED — prevents Claude from answering instead of running
---
```

Command files describe what to run (shell command or companion.mjs invocation), not what to think. Keep them imperative.

---

## SKILL.md / RULE.mdc Files

- Each file documents a single delegation target or workflow pattern
- Must include the exact non-interactive invocation flags for the target CLI
- Must handle the case where the target CLI is not installed (graceful error message)
- Use the canonical flags from `.github/instructions/skill-files.instructions.md`

---

## Testing Conventions

- Test files: `*.test.mjs` using `node:test` and `node:assert`
- Fake agents in `helpers/fake-agents.mjs` — a `BINARY_MAP` of agent name → script path
- Tests override `PATH` to point at fake agents — never invoke real CLIs in tests
- MCP tests use `helpers/mcp-session.mjs` to start/stop the real server process
- See [Testing Guide](testing-guide.md) for full details

---

## Adding a New Agent

Follow `docs/add-agent-checklist.md` for the complete checklist. Key invariants to maintain:

1. Every new agent needs entries in: `REGISTRY` (companion.mjs), `TOOLS` + `BINARIES` (index.js), `BINARY_MAP` (both test helpers)
2. Non-interactive flag must be documented in `.github/instructions/skill-files.instructions.md`
3. All 5 parallel orchestrators in `index.js` must include the new agent
4. `tools/list` assertion in `for-opencode/src/tests/mcp.test.mjs` must be updated

---

## See Also

- [System Architecture](system-architecture.md) — component design and data flow
- [Testing Guide](testing-guide.md) — test patterns and running tests
- [Codebase Summary](codebase-summary.md) — file inventory
