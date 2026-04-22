# Project Overview / PDR: LLMs Choreographer

**Package:** `llms-choreographer` v1.0.0
**Author:** Manish Kumar
**License:** MIT
**Runtime:** Node ≥ 22 (root), Node ≥ 18.18 (for-opencode)

---

## 1. Overview

LLMs Choreographer is a cross-agent plugin collection that lets every supported AI coding CLI delegate tasks to every other. It ships as native plugins, skills, and MCP tools so each host CLI can invoke peer agents without leaving its own interface.

**Supported agents (active):** Claude Code, OpenCode, Codex, Kilo Code
**Target users:** Developers who run multiple AI coding CLIs and want to combine them in structured workflows (parallel review, council votes, second opinions, debug triage).

---

## 2. Problem It Solves

Each AI coding CLI is an island. A developer using Claude Code cannot natively ask Codex to review the same diff, or run a council vote across four agents to reach consensus. Switching tools manually is slow and context is lost at each boundary.

LLMs Choreographer installs once into each CLI and wires them into a delegation mesh. A single slash command or skill invocation spawns peer agents in parallel, collects their output verbatim, and surfaces the results back in the host interface.

Without it:
- Multi-agent review requires manual copy-paste across four terminals.
- Council/vote workflows have no standard protocol.
- Second-opinion requests have no non-interactive invocation path.

---

## 3. Architecture

### Plugin layout

```
choreographer/
├── plugins/                        # Claude Code plugins
│   ├── claude/                     # Delegate to a second Claude instance
│   ├── codex/                      # Delegate to Codex
│   ├── opencode/                   # Delegate to OpenCode
│   └── llms-choreographer/         # Workflow patterns (council, review, debug, vote)
│       ├── commands/               # Slash-command specs (*.md)
│       └── scripts/companion.mjs  # Parallel orchestrator
├── for-codex/                      # Codex SKILL.md files (one per target + patterns)
└── for-opencode/                   # OpenCode MCP npm package (llms-choreographer-opencode v1.1.0)
    └── src/index.js                # MCP stdio server exposing delegate_* tools
```

### Agent mesh

The companion orchestrator (`companion.mjs`) maintains a registry of five agent binaries:

| Key    | Binary  | Notes                                  |
|--------|---------|----------------------------------------|
| claude | claude  | Non-interactive via `--print`          |
| codex  | codex   | `codex exec`                           |

---

## 4. Key Components

| Component | Description |
|-----------|-------------|
| `companion.mjs` | Core orchestrator. Spawns agents in parallel (stdin: `ignore`). Subcommands: `council`, `review`, `debug`, `second-opinion`, `vote`. |
| `plugins/llms-choreographer/commands/*.md` | Claude Code slash-command specs for each workflow pattern. |
| `for-opencode/src/index.js` | MCP stdio server. Exposes `delegate_*`, `check_agents`, `council`, `parallel_review`, `parallel_debug`, `second_opinion`, `vote` tools to OpenCode. |
| `for-codex/` | SKILL.md files teaching Codex how to delegate to each peer and run workflow patterns. |

### Workflow patterns

| Pattern | Min agents | Description |
|---------|-----------|-------------|
| `council` | 2 | All available agents answer; results surfaced together |
| `review` | 2 | Parallel code review across agents |
| `debug` | 2 | Parallel debug triage |
| `second-opinion` | 1 | Single peer agent provides an alternative perspective |
| `vote` | 2 | Agents vote; majority or consensus reported |

### Tests

- `plugins/llms-choreographer/scripts/tests/` — 7 test files (companion helpers + subcommands, no live CLIs required)
- `for-opencode/src/tests/` — hermetic MCP server tests (tools/list, check_agents, council, second_opinion, vote)
- Run all: `npm test`

---

## 5. Non-Goals / Scope

- **Not a general task runner.** Choreographer delegates coding tasks; it does not schedule jobs, manage files, or orchestrate non-AI processes.
- **No UI.** All interaction is through each host CLI's native interface (slash commands, skills, MCP tools). No web dashboard or standalone TUI.
- **OpenCode is output-only via MCP.** Its TUI stdout is not capturable, so it is excluded from parallel workflow patterns that require captured output. It receives tasks via the MCP server.
- **No model selection.** Each agent uses whatever model it is configured for externally. Choreographer only routes tasks and collects text output.
- **No persistent state.** Workflow results are ephemeral — returned to the host CLI session, not stored.
