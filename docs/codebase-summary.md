# Codebase Summary — LLMs Choreographer

## Overview

Cross-agent plugin collection connecting AI coding CLIs in a full delegation mesh. Every agent can delegate to every other via plugins, skills, or slash commands.

**Agents:** Claude Code, OpenCode, Codex

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

### `.opencode/commands/` — OpenCode slash commands

Zero per-turn token cost — loaded only when user types `/`.

| File | Purpose |
|------|---------|
| `delegate-claude.md` | Run `claude --print` with given task, return output |
| `delegate-codex.md` | Run `codex exec` with given task, return output |
| `check-agents.md` | Report ✓/✗ availability of claude and codex |
| `council.md` | Claude (correctness) + Codex (scope) in parallel |
| `parallel-review.md` | Review `git diff HEAD` with both agents |
| `parallel-debug.md` | Root-cause hypotheses from both agents |
| `second-opinion.md` | Quick approve/caveat/reject from Claude |
| `vote.md` | YES/NO/ABSTAIN tally from both agents |
| `_helpers/run-parallel.sh` | Spawn two CLIs in parallel, delimit output |
| `_helpers/parse-vote.sh` | Extract YES/NO/ABSTAIN from agent stdout |

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
  claude:    { binary: 'claude',    setup: '/claude:setup' },
  codex:     { binary: 'codex',     setup: '/codex:setup'  },
  opencode:  { binary: 'opencode',  setup: '/opencode:setup' },
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
| `parse-opencode.test.mjs` | `parseOpenCodeNdJson` fixture tests |
| `second-opinion-fallback.test.mjs` | Fallback behavior when only 1 agent available |
| `strip-flags.test.mjs` | `stripFlags` helper |
| `vote.test.mjs` | Vote subcommand logic |
| `helpers/fake-agents.mjs` | Shared test fixture |

**Total: 7 test files. Run with:** `npm test`

---

## Dependencies

- **Runtime:** Node.js ≥ 22 (no external npm deps in companion.mjs)
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

- **Codex sandbox:** file access limited to working directory
- **OpenCode slash commands are user-initiated:** the OpenCode model cannot self-invoke them mid-reasoning
- `council`, `review`, `debug`, `vote` require ≥2 available agents (exit non-zero otherwise)
- `second-opinion` requires ≥1 agent
