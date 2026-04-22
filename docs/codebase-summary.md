# Codebase Summary — LLMs Choreographer

## Overview

Cross-agent plugin collection connecting five AI coding CLIs in a full 5×5 delegation mesh. Every agent can delegate to every other agent via plugins, skills, or MCP tools.

**Agents:** Claude Code, OpenCode, Gemini CLI, Codex, Cursor Agent CLI, Kilo Code CLI

---

## Directory Inventory

### `plugins/` — Claude Code plugins (one per target agent)

| Path | Purpose |
|------|---------|
| `plugins/claude/` | Self-delegation (second Claude instance) |
| `plugins/codex/` | Delegate to Codex from Claude Code |
| `plugins/opencode/` | Delegate to OpenCode from Claude Code |
| `plugins/llms-choreographer/` | Workflow patterns: council, review, debug, second-opinion, vote |

Each plugin dir contains:
- `.claude-plugin/plugin.json` — plugin manifest
- `commands/{run,setup,review}.md` — slash-command specs
- `scripts/companion.mjs` — plugin-local helper

### `plugins/llms-choreographer/` — Core orchestrator plugin

| File | Purpose |
|------|---------|
| `scripts/companion.mjs` | Core parallel orchestrator. Exports: `REGISTRY`, `checkCli`, `filterAvailable`, `printMissingWarning`, `stripFlags`. Subcommands: `council`, `review`, `debug`, `second-opinion`, `vote` |
| `commands/council.md` | Slash-command spec: run task across multiple agents, collate responses |
| `commands/review.md` | Slash-command spec: parallel code review |
| `commands/debug.md` | Slash-command spec: parallel debugging |
| `commands/second-opinion.md` | Slash-command spec: single-agent second opinion (≥1 agent) |
| `commands/vote.md` | Slash-command spec: majority-vote across agents |
| `scripts/tests/` | Smoke tests (see Test Structure below) |

### `for-opencode/` — OpenCode MCP server

| File | Purpose |
|------|---------|
| `src/index.js` | MCP stdio server. Exposes: `delegate_*` tools, `check_agents`, `council`, `parallel_review`, `parallel_debug`, `second_opinion`, `vote` |
| `src/tests/mcp.test.mjs` | Hermetic MCP server tests |
| `src/tests/helpers/mcp-session.mjs` | MCP session test helper |
| `package.json` | npm package manifest for MCP server |

### `for-codex/` — Codex skills

One `SKILL.md` per delegation target: `claude`, `codex`, `council`, `opencode`, `parallel-debug`, `parallel-review`, `second-opinion`, `vote`.

### `.claude-plugin/`

| File | Purpose |
|------|---------|
| `marketplace.json` | Claude Code plugin registry |

---

## Agent Registry

```js
const REGISTRY = {
  claude: { binary: 'claude', setup: '/claude:setup' },
  gemini: { binary: 'gemini', setup: '/gemini:setup' },
  codex:  { binary: 'codex',  setup: '/codex:setup'  },
  cursor: { binary: 'agent',  setup: '/cursor:setup'  },
  kilo:   { binary: 'kilo',   setup: '/kilo:setup'    },
};
```

`checkCli(binary)` returns `{ status: 'ok' | 'not-installed' | 'unavailable', version: string }`.

---

## Test Structure

### Companion tests (`plugins/llms-choreographer/scripts/tests/`)

| File | Covers |
|------|--------|
| `check-all.test.mjs` | `checkCli` / `filterAvailable` |
| `json-output.test.mjs` | JSONL output formatting |
| `min-agents.test.mjs` | Minimum agent count enforcement |
| `second-opinion-fallback.test.mjs` | Fallback behavior when only 1 agent available |
| `strip-flags.test.mjs` | `stripFlags` helper |
| `vote.test.mjs` | Vote subcommand logic |
| `helpers/fake-agents.mjs` | Shared test fixture |

### MCP server tests (`for-opencode/src/tests/`)

| File | Covers |
|------|--------|
| `mcp.test.mjs` | tools/list, check_agents, council, second_opinion, vote |
| `helpers/mcp-session.mjs` | MCP session helper |

**Total: 9 test files. Run with:** `npm test`

> Note: `npm test` currently runs a stub (exits 0, prints "Running tests..."). Full test execution: `node --test plugins/llms-choreographer/scripts/tests/*.test.mjs` and `node --test for-opencode/src/tests/mcp.test.mjs`.

---

## Dependencies

- **Runtime:** Node.js (no external npm deps in companion.mjs)
- **MCP server:** `for-opencode/package.json` (npm package)
- **Test runner:** `node --test` (Node.js built-in)

---

## How to Run

```bash
# Workflow pattern commands via companion.mjs
node plugins/llms-choreographer/scripts/companion.mjs check-all
node plugins/llms-choreographer/scripts/companion.mjs council "<task>"
node plugins/llms-choreographer/scripts/companion.mjs review
node plugins/llms-choreographer/scripts/companion.mjs debug "<symptom>"
node plugins/llms-choreographer/scripts/companion.mjs second-opinion [--agent <name>] "<approach>"
node plugins/llms-choreographer/scripts/companion.mjs vote "<question>"

# Run tests
npm test
```

---

## Known Limitations

- **OpenCode TUI:** stdout not capturable — excluded from parallel workflow patterns
- **Codex sandbox:** file access limited to working directory
- `council`, `review`, `debug`, `vote` require ≥2 available agents (exit non-zero otherwise)
- `second-opinion` requires ≥1 agent
