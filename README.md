# LLMs Choreographer

Cross-agent delegation mesh for Claude Code, Codex, and OpenCode. Install once into each CLI and delegate tasks, run parallel reviews, hold council votes, and get second opinions — without leaving your current interface.

![Node ≥22](https://img.shields.io/badge/node-%E2%89%A522-brightgreen) ![MIT](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

Each AI coding CLI is an island. Claude Code cannot natively ask Codex to review the same diff. Switching tools manually is slow and context is lost at each boundary.

LLMs Choreographer wires every supported CLI into a delegation mesh. A single slash command spawns peer agents in parallel, collects their output verbatim, and surfaces results back in the host interface.

**Supported agents:** Claude Code · Codex · OpenCode

---

## Six delegation directions

All directions are operational:

| From → To | Mechanism |
|-----------|-----------|
| Claude Code → Codex | `/codex:run <task>` → `codex exec` |
| Claude Code → OpenCode | `/opencode:run <task>` → `opencode run --format json` |
| Claude Code → Claude | `/claude:run <task>` → second `claude --print` instance |
| Codex → Claude Code | `claude` skill → `claude --print --dangerously-skip-permissions` |
| Codex → OpenCode | `opencode` skill → `opencode run --format json` |
| OpenCode → Claude Code | `/delegate-claude <task>` → `claude --print` |
| OpenCode → Codex | `/delegate-codex <task>` → `codex exec` |

See [`docs/delegation.md`](docs/delegation.md) for code snippets and worked examples.

---

## Install

### Prerequisites

- **Node.js ≥ 22** — required to run the orchestrator (`companion.mjs`) and tests
- **CLIs on `$PATH`** — install only the ones you plan to delegate to:
  - Claude Code: `npm install -g @anthropic-ai/claude-code`
  - Codex: `npm install -g @openai/codex`
  - OpenCode: see [opencode.ai](https://opencode.ai)

---

### Claude Code — plugin install

Claude Code loads plugins from a local marketplace registry.

```bash
# 1. Clone the repo
git clone https://github.com/valpere/llms-choreographer.git
cd llms-choreographer

# 2. Register the local marketplace (once per machine)
#    Inside a Claude Code session:
/plugin marketplace add /absolute/path/to/llms-choreographer

# 3. Install the plugins you want
/plugin install claude@llms-choreographer
/plugin install codex@llms-choreographer
/plugin install opencode@llms-choreographer
/plugin install llms-choreographer@llms-choreographer
```

Verify installation — in a Claude Code session:
```
/plugin
```
Should list: `claude`, `codex`, `opencode`, `llms-choreographer`.

> **Path tip:** replace `/absolute/path/to/llms-choreographer` with the actual path, e.g. `/Users/yourname/Repositories/llms-choreographer`.

---

### Codex — skills (zero install)

Codex auto-discovers `SKILL.md` files from the working directory. No install step needed — launch Codex inside this repo and the skills are live.

```bash
cd /path/to/llms-choreographer
codex
```

Skills available in `for-codex/`:

| Skill | What it does |
|-------|--------------|
| `claude` | Delegate a task to Claude Code |
| `opencode` | Delegate a task to OpenCode |
| `council` | Both agents answer; results shown together |
| `parallel-review` | Parallel code review across both agents |
| `parallel-debug` | Root-cause hypotheses from both agents |
| `second-opinion` | Quick approve/concerns/verdict from Claude |
| `vote` | YES/NO/ABSTAIN tally from both agents |

Example prompt inside Codex:
```
use the council skill on: should we adopt TypeScript for this project?
```

---

### OpenCode — custom slash commands (zero install)

OpenCode auto-discovers `.opencode/commands/*.md` from the working directory. Launch OpenCode inside this repo.

```bash
cd /path/to/llms-choreographer
opencode
```

Type `/` to see all 8 commands. Zero per-turn token cost — commands are lazy-loaded only on invocation.

---

## Commands reference

### Claude Code slash commands (via installed plugins)

| Command | Description |
|---------|-------------|
| `/claude:setup` | Verify Claude Code CLI is installed and authenticated |
| `/claude:run [--wait\|--background] <task>` | Delegate task to a second Claude instance |
| `/claude:review [--wait\|--background]` | Claude reviews current git working tree |
| `/codex:setup` | Verify Codex CLI is installed |
| `/codex:run <task>` | Delegate task to Codex |
| `/codex:review` | Codex reviews current git working tree |
| `/opencode:setup` | Verify OpenCode CLI is installed |
| `/opencode:run <task>` | Delegate task to OpenCode |
| `/opencode:review` | OpenCode reviews current git working tree |
| `/llms-choreographer:council <task>` | All available agents answer in parallel |
| `/llms-choreographer:review` | Parallel code review across all agents |
| `/llms-choreographer:debug <symptom>` | Parallel debug triage across all agents |
| `/llms-choreographer:second-opinion <approach>` | Single peer agent provides alternative perspective |
| `/llms-choreographer:vote <question>` | Agents vote YES/NO/ABSTAIN; tally reported |

### OpenCode slash commands

| Command | Description |
|---------|-------------|
| `/delegate-claude <task>` | Delegate to Claude Code, return output |
| `/delegate-codex <task>` | Delegate to Codex, return output |
| `/check-agents` | Report ✓/✗ availability of `claude` and `codex` |
| `/council <task>` | Claude (correctness) + Codex (scope) in parallel |
| `/parallel-review` | Review `git diff HEAD` with both agents |
| `/parallel-debug <symptom>` | Root-cause hypotheses from both agents |
| `/second-opinion <approach>` | Quick approve/caveat/reject from Claude |
| `/vote <proposition>` | YES/NO/ABSTAIN tally from both agents |

---

## Workflow patterns

| Pattern | Min agents | Description |
|---------|------------|-------------|
| `council` | 2 | All available agents answer; results collated |
| `review` | 2 | Parallel code review across agents |
| `debug` | 2 | Parallel root-cause triage |
| `second-opinion` | 1 | Single peer agent provides an alternative perspective |
| `vote` | 2 | Agents vote YES/NO/ABSTAIN; majority reported |

---

## Develop

```bash
# Run tests (Node built-in test runner, no external deps)
npm test
```

Tests live in `plugins/llms-choreographer/scripts/tests/` — 7 test files, 33 assertions. No live CLIs required.

See [`docs/codebase-summary.md`](docs/codebase-summary.md) for test file inventory.

---

## Smoke tests (after install)

**Claude Code:**
```
/codex:run reply with: ok
/opencode:run reply with: ok
/llms-choreographer:council "one-word answer: sky color?"
/llms-choreographer:vote "adopt TypeScript"
```

**Codex** (inside repo dir):
```
use the claude skill to delegate: reply with: ok
use the council skill on: one-word answer: sky color?
```

**OpenCode** (inside repo dir):
```
/check-agents
/delegate-claude reply with: ok
/vote "adopt TypeScript"
```

---

## Docs

| Document | Contents |
|----------|----------|
| [`docs/project-overview-pdr.md`](docs/project-overview-pdr.md) | Problem, architecture, non-goals |
| [`docs/codebase-summary.md`](docs/codebase-summary.md) | Directory inventory, test structure, how to run |
| [`docs/delegation.md`](docs/delegation.md) | All six delegation directions with code snippets and worked examples |

---

## License

[MIT](LICENSE) — Manish Kumar
