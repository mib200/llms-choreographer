# Project Overview / PDR: Choreographer

> See also: [Codebase Summary](./codebase-summary.md) · [System Architecture](./system-architecture.md) · [Deployment Guide](./deployment-guide.md) · [Testing Guide](./testing-guide.md) · [Delegation Reference](./delegation.md)

**Package:** `@mib200/choreographer-monorepo` v1.0.0
**Marketplace:** `mib200` · **Plugin:** `choreo`
**Author:** Manish Kumar · **License:** MIT · **Runtime:** Node ≥ 22

## 1. Overview

Choreographer is a monorepo providing multi-agent delegation between Claude Code, Codex, and OpenCode. It installs as a native plugin/skill set into each runtime and enables council reviews, second opinions, parallel debugging, and voting — all without leaving the current interface.

**Namespace:** `/choreo:*` (Claude/Codex), `/choreo-*` (OpenCode)

## 2. Problem It Solves

Each AI coding CLI is an island. A developer using Claude Code cannot natively ask Codex to review the same diff, or run a council vote across agents to reach consensus. Switching tools manually is slow and context is lost at each boundary.

Choreographer installs once into each CLI and wires them into a delegation mesh. A single slash command or skill invocation spawns peer agents in parallel, collects their output verbatim, and surfaces the results back in the host interface.

Without it:
- Multi-agent review requires manual copy-paste across terminals.
- Council/vote workflows have no standard protocol.
- Second-opinion requests have no non-interactive invocation path.

## 3. Architecture

### Repo layout

```
choreographer/
├── .claude-plugin/marketplace.json   ← Claude Code marketplace (mib200)
├── .agents/plugins/marketplace.json  ← Codex marketplace (mib200)
├── core/                             ← shared source — consumed by bundler, not shipped
│   ├── companion.mjs                 ← CLI dispatcher
│   ├── parsers.mjs                   ← parseClaudeStreamJson, parseOpenCodeOutput
│   ├── runners.mjs                   ← REGISTRY, subprocess wrappers, helpers
│   └── tests/                        ← 32 assertions (node --test)
├── plugin-claude/                    ← Claude Code plugin
│   ├── .claude-plugin/plugin.json    ← name: "choreo"
│   ├── commands/                     ← /choreo:* (8 commands)
│   ├── skills/choreo/SKILL.md        ← auto-trigger skill
│   ├── src/entry.mjs                 ← esbuild entry
│   └── scripts/companion.mjs         ← ESBUILD OUTPUT
├── plugin-codex/                     ← Codex plugin
│   ├── .codex-plugin/plugin.json     ← name: "choreo"
│   ├── skills/*/SKILL.md             ← 9 skills
│   ├── src/entry.mjs
│   └── scripts/companion.mjs         ← ESBUILD OUTPUT
├── plugin-opencode/                  ← OpenCode plugin
│   ├── package.json                  ← @mib200/choreo-opencode
│   ├── .opencode/plugins/choreo.ts
│   ├── .opencode/commands/choreo-*.md ← 8 commands
│   ├── src/entry.mjs
│   └── dist/companion.mjs            ← ESBUILD OUTPUT
├── bin/
│   ├── install.sh                    ← bash <(curl ...) entry
│   └── install.mjs                   ← node/npx entry
└── scripts/bundle.mjs                ← esbuild config (3 targets)
```

### Agent mesh

| From \ To | Claude Code | Codex | OpenCode |
|-----------|-------------|-------|----------|
| **Claude Code** | `/choreo:claude` | `/choreo:codex` | `/choreo:opencode` |
| **Codex** | `choreo-claude` skill | `choreo-codex` skill | `choreo-opencode` skill |
| **OpenCode** | `/choreo-claude` | `/choreo-codex` | `/choreo-opencode` |

### Build pipeline

`core/` is shared source. esbuild bundles each `plugin-*/src/entry.mjs` into a single `companion.mjs` in the plugin's output directory. No runtime npm dependencies. Bundled outputs committed to git.

## 4. Key Components

### `core/runners.mjs`

- `REGISTRY` — agent definitions: binary name + `/choreo:*` setup hint
- `checkCli(binary)` — spawnSync `--version`, returns `{ status, version }`
- `filterAvailable(agents)` — splits into `{ available, missing }`
- `requireAvailable(agents, min)` — asserts min count, exits with install hint
- `runAgent(name, binary, args, parse)` — spawns subprocess, returns `{ name, output, error, code }`
- `printDelimited(results)` — bordered per-agent human output
- `printJSON(command, results)` — `{ command, results[] }` JSON envelope
- `stripFlags(args)` — removes `--json`, `--background`, `--wait`, `--agent[=]`

### `core/parsers.mjs`

- `parseClaudeStreamJson(raw)` — extracts assistant text from `--output-format stream-json --verbose` event stream
- `parseOpenCodeOutput(raw)` — strips ANSI codes and empty lines

### Workflow patterns

| Pattern | CLI subcommand | Min agents |
|---------|----------------|------------|
| Council | `council` | 2 |
| Parallel review | `parallel-review` | 2 |
| Parallel debug | `parallel-debug` | 2 |
| Second opinion | `second-opinion` | 1 (with fallback) |
| Vote | `vote` | 2 |
| Check availability | `check-all` | — |

### Tests

32 assertions across 7 files in `core/tests/`. Uses fake-agent binaries injected via `PATH` (`helpers/fake-agents.mjs`). Run with `npm test`.

## 5. Non-Goals / Scope

- Publishing `@mib200/choreo-opencode` to npm registry — structure written, not published.
- GitHub remote setup — no remote configured.
- Migration script for existing `llms-choreographer` users — manual re-install.
- MCP server definitions — none.
- Gemini/Cursor/Kilo adapters — Claude Code + Codex + OpenCode only.
- Single-agent dispatch for `/choreo:codex` etc. — currently all route through `council`. Deferred.
