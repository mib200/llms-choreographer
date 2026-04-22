# System Architecture — Chorus

## Overview

Chorus is a thin integration layer — no central server, no shared state. Each host agent gets its own native plugin format that drives non-interactive CLI invocations of the target agents.

---

## Delegation Mesh

Every agent can delegate to every other agent. OpenCode participates as a delegation *target* only (its TUI stdout cannot be captured for outbound delegation).

```mermaid
graph TD
    CC[Claude Code<br/>plugins/]
    OC[OpenCode<br/>for-opencode/ MCP]
    GC[Gemini CLI<br/>for-gemini/]
    CX[Codex<br/>for-codex/]
    CU[Cursor Agent CLI<br/>for-cursor/]
    KC[Kilo Code CLI<br/>for-kilo/]

    CC -->|slash commands| OC
    CC -->|slash commands| GC
    CC -->|slash commands| CX
    CC -->|slash commands| CU
    CC -->|slash commands| KC
    CC -->|self-delegation| CC

    OC -->|MCP tools| CC
    OC -->|MCP tools| GC
    OC -->|MCP tools| CX
    OC -->|MCP tools| CU
    OC -->|MCP tools| KC

    GC -->|SKILL.md| CC
    GC -->|SKILL.md| OC
    GC -->|SKILL.md| CX
    GC -->|SKILL.md| CU
    GC -->|SKILL.md| KC

    CX -->|SKILL.md| CC
    CX -->|SKILL.md| OC
    CX -->|SKILL.md| GC
    CX -->|SKILL.md| CU
    CX -->|SKILL.md| KC

    CU -->|RULE.mdc| CC
    CU -->|RULE.mdc| OC
    CU -->|RULE.mdc| GC
    CU -->|RULE.mdc| CX
    CU -->|RULE.mdc| KC

    KC -->|SKILL.md| CC
    KC -->|SKILL.md| OC
    KC -->|SKILL.md| GC
    KC -->|SKILL.md| CX
    KC -->|SKILL.md| CU
```

---

## Component Architecture

```mermaid
graph LR
    subgraph "Claude Code host"
        P[plugins/chorus/commands/*.md<br/>slash command specs]
        CM[companion.mjs<br/>parallel orchestrator]
        P --> CM
    end

    subgraph "OpenCode host"
        MCP[for-opencode/src/index.js<br/>MCP stdio server]
    end

    subgraph "Skill-based hosts"
        SK[for-gemini/ for-codex/<br/>for-cursor/ for-kilo/<br/>SKILL.md / RULE.mdc]
    end

    CM -->|spawnSync / spawn| Agents[claude / gemini / codex<br/>agent / kilo binaries]
    MCP -->|spawnSync / spawn| Agents
    SK -->|host invokes CLI| Agents
```

---

## Plugin Formats by Host

| Host | Format | Location | Discovery |
|------|--------|----------|-----------|
| Claude Code | `.claude-plugin/plugin.json` + `commands/*.md` | `plugins/<agent>/` | Plugin marketplace / manual install |
| OpenCode | MCP stdio server | `for-opencode/` (npm package `@valpere/chorus-opencode`) | `opencode.json` MCP config |
| Gemini CLI | `SKILL.md` | `for-gemini/<target>/` | Copied to `~/.gemini/skills/` |
| Codex | `SKILL.md` | `for-codex/<target>/` | Copied to `~/.codex/skills/` |
| Cursor Agent CLI | `RULE.mdc` | `for-cursor/<target>/` | Copied to `.cursor/rules/` |
| Kilo Code CLI | `SKILL.md` | `for-kilo/<target>/` | Copied to `.kilo/skills/` |

---

## companion.mjs — Parallel Orchestrator

`plugins/chorus/scripts/companion.mjs` is the core execution engine for Claude Code's workflow patterns.

### CLI Subcommands

| Subcommand | Min agents | Description |
|---|---|---|
| `check-all` | — | Check availability of all 5 target CLIs |
| `council <task>` | 2 | Each agent tackles the task from an assigned perspective |
| `review [task]` | 2 | Parallel code review of current git diff |
| `debug <task>` | 2 | Parallel root-cause hypotheses |
| `second-opinion <approach>` | 1 | One independent agent evaluates an approach |
| `vote <proposition>` | 2 | Each agent votes YES/NO/ABSTAIN with rationale |

### Flags

| Flag | Applies to | Effect |
|---|---|---|
| `--json` | `council`, `review`, `debug`, `second-opinion`, `vote` | Emit structured JSON instead of delimited text |
| `--min-agents N` | `council`, `review`, `debug`, `vote` | Require at least N available agents |

### Agent Role Assignment (council/review/debug)

```
claude   → correctness, type safety, logic errors
gemini   → edge cases, infrastructure, concurrency
codex    → scope simplicity, off-by-one, input handling
cursor   → integration, framework/library issues
kilo     → naming, readability, maintainability
```

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant companion.mjs
    participant claude
    participant gemini
    participant codex
    participant cursor
    participant kilo

    User->>companion.mjs: council "Review this function"
    companion.mjs->>companion.mjs: checkAvailable() — filter to installed agents
    par parallel spawn
        companion.mjs->>claude: spawnSync with role prompt
        companion.mjs->>gemini: spawnSync with role prompt
        companion.mjs->>codex: spawnSync with role prompt
        companion.mjs->>cursor: spawnSync with role prompt
        companion.mjs->>kilo: spawnSync with role prompt
    end
    claude-->>companion.mjs: stdout
    gemini-->>companion.mjs: stdout
    codex-->>companion.mjs: stdout
    cursor-->>companion.mjs: stdout
    kilo-->>companion.mjs: stdout
    companion.mjs->>User: delimited output (or JSON if --json)
```

---

## MCP Server (for-opencode/src/index.js)

The OpenCode MCP server exposes 11 tools over stdio transport.

### Tool Catalog

| Tool | Description |
|------|-------------|
| `delegate_claude` | Delegate task to Claude Code, return output |
| `delegate_gemini` | Delegate task to Gemini CLI, return output |
| `delegate_codex` | Delegate task to Codex, return output |
| `delegate_cursor` | Delegate task to Cursor Agent CLI, return output |
| `delegate_kilo` | Delegate task to Kilo Code CLI, return output |
| `check_agents` | Report availability of all 5 target CLIs |
| `council` | LLM council: 5 agents with assigned roles in parallel |
| `parallel_review` | Parallel git-diff code review across 5 agents |
| `parallel_debug` | Parallel root-cause hypotheses across 5 agents |
| `second_opinion` | One independent agent evaluates an approach (with fallback) |
| `vote` | YES/NO/ABSTAIN parallel vote with tally |

### Service Dependency Graph

```mermaid
graph TD
    OC[OpenCode TUI] -->|MCP stdio| MCP[chorus-opencode MCP server<br/>for-opencode/src/index.js]
    MCP -->|spawnSync| Claude[claude --print]
    MCP -->|spawnSync| Gemini[gemini --yolo]
    MCP -->|spawnSync| Codex[codex --full-auto]
    MCP -->|spawnSync| Cursor[agent --headless]
    MCP -->|spawnSync| Kilo[kilo --yes]
```

### second_opinion Fallback Behavior

`second_opinion` selects an agent using a priority list. If the requested agent is unavailable, it falls back to the next available agent in `defaultOrder`. This ensures the tool always returns a result when at least one agent is installed.

---

## Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| OpenCode TUI stdout not capturable | OpenCode cannot participate in outbound parallel workflows | OpenCode is delegation-target only; use Claude Code as host for parallel workflows |
| Codex sandbox file access restrictions | Codex may not read arbitrary paths inside its sandbox | Pass file contents inline in the task prompt |
| Parallel workflows use `spawnSync` | Long-running tasks block the Node.js event loop | Intended for short code-review/analysis tasks; not for multi-minute agent runs |

---

## See Also

- [Project Overview & PDR](project-overview-pdr.md) — design decisions
- [Code Standards](code-standards.md) — conventions for extending the mesh
- [Testing Guide](testing-guide.md) — how companion.mjs and MCP server are tested
