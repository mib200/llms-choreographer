# Choreographer

Cross-agent delegation mesh for Claude Code, Codex, and OpenCode. Install once into each CLI and delegate tasks, run parallel reviews, hold council votes, and get second opinions — without leaving your current interface.

![Node ≥22](https://img.shields.io/badge/node-%E2%89%A522-brightgreen) ![MIT](https://img.shields.io/badge/license-MIT-blue)

## What it does

- **Council** — ask all available agents to review a task in parallel (correctness / scope / integration)
- **Parallel review** — run `git diff HEAD` through all agents simultaneously
- **Parallel debug** — generate ranked root-cause hypotheses from multiple perspectives
- **Second opinion** — single agent approve/approve-with-caveats/reject with fallback
- **Vote** — YES/NO/ABSTAIN tally with per-agent rationale

## Install

### Prerequisites

- Node.js ≥ 22
- One or more of: [Claude Code](https://claude.ai/code), [Codex](https://github.com/openai/codex), [OpenCode](https://opencode.ai)

### Quick install

```bash
git clone https://github.com/mib200/choreographer.git
cd choreographer
node bin/install.mjs --target=all      # all three CLIs
node bin/install.mjs --target=claude   # Claude Code only
node bin/install.mjs --target=codex    # Codex only
node bin/install.mjs --target=opencode # OpenCode only
```

Or via bash curl (once published):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/mib200/choreographer/main/bin/install.sh) --target=all
```

### Manual install — Claude Code

```bash
# Inside a Claude Code session (once per machine):
/plugin marketplace add /absolute/path/to/choreographer

# Then install the plugin:
/plugin install choreo@mib200
```

Verify: `/help` should list `/choreo:*` commands.

### Manual install — Codex

The installer copies `plugin-codex/` to `~/.codex/plugins/cache/mib200/choreo/1.0.0/`. Skills appear on next Codex startup.

### Manual install — OpenCode

The installer copies `plugin-opencode/.opencode/commands/choreo-*.md` to `~/.config/opencode/commands/` and `dist/companion.mjs` to `~/.config/opencode/choreo/companion.mjs`.

## Commands reference

### Claude Code (`/choreo:*`)

| Command | Description |
|---------|-------------|
| `/choreo:council <task>` | All agents review in parallel (correctness / scope / integration) |
| `/choreo:parallel-review` | All agents review current `git diff HEAD` |
| `/choreo:parallel-debug <symptom>` | Ranked root-cause hypotheses from all agents |
| `/choreo:second-opinion [--agent=claude\|codex\|opencode] <decision>` | Single agent second opinion with fallback |
| `/choreo:vote <proposition>` | YES/NO/ABSTAIN tally with rationale |
| `/choreo:claude <task>` | Delegate to Claude Code |
| `/choreo:codex <task>` | Delegate to Codex |
| `/choreo:opencode <task>` | Delegate to OpenCode |

### Codex (skills)

Invoke via natural language: `Use the choreo-council skill: <task>`

| Skill | Description |
|-------|-------------|
| `choreo-council` | All agents review in parallel |
| `choreo-parallel-review` | Parallel code review |
| `choreo-parallel-debug` | Parallel root-cause hypotheses |
| `choreo-second-opinion` | Single agent second opinion |
| `choreo-vote` | YES/NO/ABSTAIN vote |
| `choreo-claude` | Delegate to Claude Code |
| `choreo-codex` | Delegate to second Codex |
| `choreo-opencode` | Delegate to OpenCode |
| `choreo-debug` | Root-cause hypotheses (alias) |

### OpenCode (`/choreo-*`)

| Command | Description |
|---------|-------------|
| `/choreo-council <task>` | All agents review in parallel |
| `/choreo-parallel-review` | Parallel code review |
| `/choreo-parallel-debug <symptom>` | Parallel root-cause hypotheses |
| `/choreo-second-opinion <decision>` | Single agent second opinion |
| `/choreo-vote <proposition>` | YES/NO/ABSTAIN vote |
| `/choreo-claude <task>` | Delegate to Claude Code |
| `/choreo-codex <task>` | Delegate to Codex |
| `/choreo-opencode <task>` | Delegate to second OpenCode |

## Develop

```bash
npm install       # install esbuild devDep
npm run bundle    # rebuild all 3 companion.mjs outputs from core/
npm test          # run 32 assertions in core/tests/
```

Run `npm run bundle` before committing if you modify `core/`.

## Smoke tests (after install)

```bash
node core/companion.mjs check-all
node core/companion.mjs council "what is 2+2?"
node core/companion.mjs vote "Node.js is the best runtime"
```

## Docs

- [`docs/delegation.md`](docs/delegation.md) — delegation round-trip reference
- [`docs/codebase-summary.md`](docs/codebase-summary.md) — directory inventory and key exports
- [`docs/project-overview-pdr.md`](docs/project-overview-pdr.md) — architecture and design decisions

## License

MIT — Manish Kumar
