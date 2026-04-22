# Codebase Summary — Choreographer

## Overview

Monorepo with one shared core library bundled into three runtime-specific plugins (Claude Code, Codex, OpenCode) via esbuild. One marketplace name (`mib200`), one plugin name (`choreo`), one namespace (`/choreo:*` for Claude/Codex, `/choreo-*` for OpenCode).

**Agents:** Claude Code, Codex, OpenCode

## Directory Inventory

### `core/` — shared source (not shipped directly)

| File | Purpose |
|------|---------|
| `companion.mjs` | CLI dispatcher (check-all, council, review, debug, second-opinion, vote) + re-exports from parsers + runners |
| `parsers.mjs` | `parseClaudeStreamJson`, `parseOpenCodeOutput` |
| `runners.mjs` | `REGISTRY`, `checkCli`, `filterAvailable`, `printMissingWarning`, `requireAvailable`, `runAgent`, `printDelimited`, `printJSON`, `stripFlags` |
| `tests/` | 7 test files + `helpers/fake-agents.mjs` — 32 assertions |

### `plugin-claude/` — Claude Code plugin

| Path | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin manifest — name: `choreo` |
| `commands/*.md` | 8 slash commands: `/choreo:claude`, `/choreo:codex`, `/choreo:opencode`, `/choreo:council`, `/choreo:parallel-review`, `/choreo:parallel-debug`, `/choreo:second-opinion`, `/choreo:vote` |
| `skills/choreo/SKILL.md` | Auto-trigger skill |
| `src/entry.mjs` | esbuild entry — re-exports `core/companion.mjs` |
| `scripts/companion.mjs` | **esbuild output** — what commands invoke |

### `plugin-codex/` — Codex plugin

| Path | Purpose |
|------|---------|
| `.codex-plugin/plugin.json` | Plugin manifest — name: `choreo`, skills: `./skills` |
| `skills/*/SKILL.md` | 9 skills: claude, codex, opencode, council, parallel-review, parallel-debug, second-opinion, vote, debug |
| `src/entry.mjs` | esbuild entry |
| `scripts/companion.mjs` | **esbuild output** |

### `plugin-opencode/` — OpenCode plugin (npm-distributed)

| Path | Purpose |
|------|---------|
| `package.json` | `@mib200/choreo-opencode` |
| `.opencode/plugins/choreo.ts` | OpenCode plugin hook |
| `.opencode/commands/choreo-*.md` | 8 slash commands: `/choreo-claude`, `/choreo-codex`, `/choreo-opencode`, `/choreo-council`, `/choreo-parallel-review`, `/choreo-parallel-debug`, `/choreo-second-opinion`, `/choreo-vote` |
| `src/entry.mjs` | esbuild entry |
| `dist/companion.mjs` | **esbuild output** — published to npm |

### `scripts/` — build tooling

| File | Purpose |
|------|---------|
| `bundle.mjs` | esbuild config — 3 targets, ESM, node22, external: `node:*` |

### `bin/` — installers

| File | Purpose |
|------|---------|
| `install.sh` | Bash installer — `--target=claude\|codex\|opencode\|all` |
| `install.mjs` | Node installer — same flags |

### `.claude-plugin/marketplace.json`

Claude Code marketplace — `name: "mib200"`, one plugin: `choreo` → `./plugin-claude`.

### `.agents/plugins/marketplace.json`

Codex marketplace — `name: "mib200"`, one plugin: `choreo` → `./plugin-codex`.

## Key Exports (`core/runners.mjs`)

| Export | Description |
|--------|-------------|
| `REGISTRY` | `{ claude, codex, opencode }` — binary names + `/choreo:*` setup hints |
| `checkCli(binary)` | Returns `{ status: 'ok'\|'not-installed'\|'unavailable', version }` |
| `filterAvailable(agents)` | Splits agents into `{ available, missing }` |
| `requireAvailable(agents, min)` | Asserts min count; exits with install hint on failure |
| `runAgent(name, binary, args, parse)` | Spawns agent subprocess, returns `{ name, output, error, code }` |
| `printDelimited(results)` | Human-readable bordered output per agent |
| `printJSON(command, results)` | JSON output `{ command, results[] }` |
| `stripFlags(args)` | Strips `--json`, `--background`, `--wait`, `--agent[=]` |

## Test Structure

```
core/tests/
├── helpers/fake-agents.mjs           # createFakeAgents(), runCompanion()
├── check-all.test.mjs                # checkCli / filterAvailable
├── json-output.test.mjs              # JSON output formatting
├── min-agents.test.mjs               # minimum agent count enforcement
├── parse-opencode.test.mjs           # parseOpenCodeOutput (ANSI stripping)
├── second-opinion-fallback.test.mjs  # fallback when agent unavailable
├── strip-flags.test.mjs              # stripFlags helper
└── vote.test.mjs                     # vote subcommand logic
```

**32 assertions. Run with:** `npm test`

## Dependencies

| Package | Purpose |
|---------|---------|
| `esbuild` (devDep) | Bundles `core/` into each plugin's `companion.mjs` |

No runtime npm dependencies — uses only `node:child_process`, `node:fs`, `node:url`, `node:os`, `node:path`.

## How to Run

```bash
npm install          # install esbuild devDep
npm run bundle       # rebuild all 3 companion.mjs outputs
npm test             # run 32 core tests

node core/companion.mjs check-all
node core/companion.mjs council "your task here"
node core/companion.mjs vote "proposition"
```

## Known Limitations

- Single-agent delegation commands (`/choreo:claude` etc.) currently route through `council` (all available agents). No single-agent dispatch mode yet.
- OpenCode output is plain text + ANSI, stripped by `parseOpenCodeOutput`.
- Claude subprocess requires `--output-format=stream-json --verbose` on Bedrock.
- No git remote configured — install is local only until remote is added.
