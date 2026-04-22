# Project Overview — Chorus

## What Is Chorus?

Chorus is a cross-agent plugin collection that connects six AI coding CLIs in a full 6×6 delegation mesh. It lets every agent delegate tasks to every other agent without leaving their own interface.

**Agents in the mesh:**

| Agent | CLI Binary | Role |
|-------|-----------|------|
| Claude Code | `claude` | Primary orchestrator / delegation target |
| OpenCode | `opencode` (MCP) | MCP-native host; delegates via MCP tools |
| Gemini CLI | `gemini` | Delegation target via SKILL.md |
| Codex | `codex` | Delegation target via SKILL.md |
| Cursor Agent CLI | `agent` | Delegation target via RULE.mdc |
| Kilo Code CLI | `kilo` | Delegation target via SKILL.md |

---

## Problem / Design Rationale (PDR)

### Problem

Each AI coding CLI is an isolated silo. When one agent lacks context, capability, or a particular strength, the developer must manually switch tools, re-paste context, and reconcile results. There is no native way to route subtasks to the best-suited agent or run parallel multi-agent workflows.

### Solution

Chorus provides a thin integration layer — per-agent plugins, skills, and rules — so that:

1. **Any agent can delegate to any other agent** with a single slash command or natural-language request.
2. **Parallel workflows** (council, parallel review, parallel debug, second opinion, vote) can be triggered from any host without manual coordination.
3. **No new runtime or server is required** — delegation uses each CLI's native non-interactive invocation (`--print`, `--dangerously-skip-permissions`, etc.).

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Per-host plugin format (SKILL.md, RULE.mdc, MCP) | Each CLI has its own extension mechanism; native formats are most discoverable and reliable |
| `companion.mjs` as central orchestrator | A single Node.js script handles parallel spawning, output capture, and JSON emission — avoids duplicating logic per host |
| MCP stdio server for OpenCode | OpenCode's TUI stdout is not capturable; MCP is the only reliable integration point |
| OpenCode excluded from parallel workflows | OpenCode output cannot be captured from outside the TUI, making parallel orchestration impossible |
| `--json` output flag | Enables programmatic consumption of multi-agent results for scripting or chaining |
| Graceful degradation | Workflows proceed with available agents when some are not installed, rather than failing hard |

### Non-Goals

- Chorus does not provide a new UI or chat interface.
- Chorus does not store conversation history or agent state.
- Chorus does not require a cloud backend or API key management (each CLI uses its own credentials).

---

## Project Status

- Version: 1.0.0 (root), 1.1.0 (`@valpere/chorus-opencode` MCP package)
- License: MIT
- Author: valpere
- Node.js requirement: ≥ 18.18.0

---

## See Also

- [System Architecture](system-architecture.md) — delegation mesh internals and MCP server design
- [Codebase Summary](codebase-summary.md) — file inventory and key dependencies
- [Testing Guide](testing-guide.md) — how to run and extend tests
