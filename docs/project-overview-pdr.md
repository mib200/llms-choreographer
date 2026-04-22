# Project Overview / PDR: LLMs Choreographer

**Package:** `llms-choreographer` v1.0.0
**Author:** Manish Kumar
**License:** MIT
**Runtime:** Node ≥ 22

---

## 1. Overview

LLMs Choreographer is a cross-agent plugin collection that lets every supported AI coding CLI delegate tasks to every other. It ships as native plugins, skills, and slash commands so each host CLI can invoke peer agents without leaving its own interface.

**Supported agents (active):** Claude Code, OpenCode, Codex
**Target users:** Developers who run multiple AI coding CLIs and want to combine them in structured workflows (parallel review, council votes, second opinions, debug triage).

---

## 2. Problem It Solves

Each AI coding CLI is an island. A developer using Claude Code cannot natively ask Codex to review the same diff, or run a council vote across agents to reach consensus. Switching tools manually is slow and context is lost at each boundary.

LLMs Choreographer installs once into each CLI and wires them into a delegation mesh. A single slash command or skill invocation spawns peer agents in parallel, collects their output verbatim, and surfaces the results back in the host interface.

Without it:
- Multi-agent review requires manual copy-paste across terminals.
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
└── .opencode/                      # OpenCode slash commands (zero per-turn token cost)
    └── commands/                   # *.md files — loaded only on /invocation
```

### Agent mesh

The companion orchestrator (`companion.mjs`) maintains a registry of agent binaries:

| Key      | Binary   | Notes                         |
|----------|----------|-------------------------------|
| claude   | claude   | Non-interactive via `--print --output-format=stream-json --verbose \| jq` |
| codex    | codex    | `codex exec`                                                              |
| opencode | opencode | `opencode run` (plain text output, ANSI-stripped)                         |

---

## 4. Key Components

| Component | Description |
|-----------|-------------|
| `companion.mjs` | Core orchestrator. Spawns agents in parallel (stdin: `ignore`). Subcommands: `council`, `review`, `debug`, `second-opinion`, `vote`. |
| `plugins/llms-choreographer/commands/*.md` | Claude Code slash-command specs for each workflow pattern. |
| `.opencode/commands/*.md` | OpenCode slash commands. Zero per-turn token cost. User-invoked. |
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
- Run all: `npm test`

---

## 5. Non-Goals / Scope

- **Not a general task runner.** Choreographer delegates coding tasks; it does not schedule jobs, manage files, or orchestrate non-AI processes.
- **No UI.** All interaction is through each host CLI's native interface (slash commands, skills). No web dashboard or standalone TUI.
- **No autonomous self-delegation from OpenCode.** Slash commands are user-initiated. If model-initiated delegation is needed, an MCP server must be built and installed separately.
- **No model selection.** Each agent uses whatever model it is configured for externally. Choreographer only routes tasks and collects text output.
- **No persistent state.** Workflow results are ephemeral — returned to the host CLI session, not stored.
