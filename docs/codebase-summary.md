# Codebase Summary — Chorus

## Overview

Cross-agent plugin collection. 227 files across 65+ directories. Pure JavaScript (ESM), no build step, Node.js ≥ 18.18.0.

**Tech stack:** Node.js · ESM modules · `node --test` runner · `@modelcontextprotocol/sdk` (MCP)

---

## Directory Inventory

```
chorus/
├── .claude-plugin/            # Claude Code marketplace registry
├── plugins/                   # Claude Code plugins (one per target agent + chorus orchestrator)
│   ├── claude/                # Self-delegation (second Claude instance)
│   ├── opencode/              # OpenCode delegation
│   ├── gemini/                # Gemini CLI delegation
│   ├── codex/                 # Codex delegation
│   ├── cursor/                # Cursor Agent CLI delegation
│   ├── kilo/                  # Kilo Code CLI delegation
│   └── chorus/                # Workflow patterns
│       ├── commands/          # council.md, review.md, debug.md, second-opinion.md, vote.md
│       └── scripts/
│           ├── companion.mjs  # Core parallel orchestrator (CLI + test-helper exports)
│           └── tests/         # node --test smoke tests (29 tests)
├── for-gemini/                # Gemini CLI skills (SKILL.md format)
├── for-codex/                 # Codex skills (SKILL.md format)
├── for-cursor/                # Cursor Agent CLI rules (RULE.mdc format)
├── for-kilo/                  # Kilo Code CLI skills (SKILL.md format)
├── for-opencode/              # OpenCode MCP npm package
│   ├── package.json           # @valpere/chorus-opencode v1.1.0
│   └── src/
│       ├── index.js           # MCP stdio server (11 tools)
│       └── tests/             # node --test MCP integration tests (8 tests)
├── .github/
│   └── instructions/          # Coding instructions for AI agents
│       ├── companion-scripts.instructions.md
│       ├── mcp-server.instructions.md
│       └── skill-files.instructions.md
├── docs/                      # Project documentation (this directory)
├── llms/context/              # Session summaries / AI context cache
├── graphify-out/              # Graph analysis output
├── test/                      # review_target.js (used by test suite)
├── package.json               # Root: name=chorus, scripts.test
├── README.md                  # Full user-facing documentation
├── AGENTS.md                  # AI agent context (CLI invocation patterns)
└── CLAUDE.md                  # Claude Code maintainer instructions
```

### Per-Host `for-*/` Structure

Each `for-*/` directory contains 10 subdirectories:

| Subdirectory | Purpose |
|---|---|
| `claude/` | Delegate to Claude Code |
| `opencode/` | Delegate to OpenCode |
| `gemini/` | Delegate to Gemini CLI |
| `codex/` | Delegate to Codex |
| `cursor/` | Delegate to Cursor Agent CLI |
| `kilo/` | Delegate to Kilo Code CLI |
| `council/` | Run LLM council workflow |
| `parallel-review/` | Run parallel code review |
| `parallel-debug/` | Run parallel debug hypotheses |
| `second-opinion/` | Get one independent second opinion |
| `vote/` | Run parallel YES/NO/ABSTAIN vote |

---

## Key Files

| File | Purpose |
|------|---------|
| `plugins/chorus/scripts/companion.mjs` | Core orchestrator: `check-all`, `council`, `review`, `debug`, `second-opinion`, `vote` subcommands |
| `for-opencode/src/index.js` | MCP stdio server exposing 11 tools to OpenCode |
| `.claude-plugin/marketplace.json` | Claude Code plugin registry (6 agent plugins + 1 chorus plugin) |
| `docs/add-agent-checklist.md` | Step-by-step guide for adding a 7th+ agent |

---

## Key Dependencies

| Package | Version | Purpose | Type |
|---------|---------|---------|------|
| `@modelcontextprotocol/sdk` | `^1.0.0` | MCP stdio server/transport for OpenCode integration | runtime (for-opencode only) |
| Node.js built-ins (`child_process`, `node:test`, `node:assert`) | — | Process spawning, test runner | runtime / dev |

No other npm dependencies. The root `package.json` has zero `dependencies` or `devDependencies`.

---

## Scale

- **Total files:** ~227 (excluding `.git/`, `node_modules/`)
- **Test files:** 7 companion tests + 1 MCP integration test = 8 test files, 37 total tests
- **Slash commands (Claude Code):** 18 (3 per agent × 6 agents + 5 chorus workflow commands)
- **MCP tools (OpenCode):** 11 (`delegate_*` × 5 + `check_agents`, `council`, `parallel_review`, `parallel_debug`, `second_opinion`, `vote`)
- **SKILL.md / RULE.mdc files:** 40 (10 per host × 4 skill-based hosts: Gemini, Codex, Kilo, and the `for-opencode` equivalents are MCP tools)

---

## See Also

- [Project Overview & PDR](project-overview-pdr.md) — design rationale and decisions
- [System Architecture](system-architecture.md) — how the delegation mesh works internally
- [Code Standards](code-standards.md) — conventions and patterns
