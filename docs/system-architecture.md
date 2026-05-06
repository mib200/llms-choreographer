# System Architecture — Choreographer

> See also: [Codebase Summary](./codebase-summary.md) · [Project Overview / PDR](./project-overview-pdr.md) · [Deployment Guide](./deployment-guide.md) · [Delegation Reference](./delegation.md)

## Overview

Choreographer is a build-time monorepo whose runtime artifact is a single self-contained `companion.mjs` file bundled into each plugin. The architecture is ACP-first: a broker daemon manages Agent Client Protocol connections to all agents (Claude, Codex, OpenCode), with native subprocess fallbacks. Multi-agent capabilities include council deliberation (6-phase state machine), adversarial review, and a verifier loop for iterative quality gates.

---

## Component Diagram

```mermaid
graph TD
    subgraph Monorepo["choreographer/ (build-time)"]
        CORE["core/\ncompanion.mjs · runners.mjs · parsers.mjs"]
        BUNDLE["scripts/bundle.mjs\n(esbuild)"]
        CORE --> BUNDLE
    end

    subgraph Plugins["Plugin outputs (committed to git)"]
        PC["plugin-claude/scripts/companion.mjs"]
        PX["plugin-codex/scripts/companion.mjs"]
        PO["plugin-opencode/dist/companion.mjs"]
        BUNDLE --> PC
        BUNDLE --> PX
        BUNDLE --> PO
    end

    subgraph Installed["Installed at runtime (per user machine)"]
        IC["~/.claude/plugins/cache/mib200/choreo/1.0.0/"]
        IX["~/.codex/plugins/cache/mib200/choreo/1.0.0/"]
        IO["~/.config/opencode/commands/ + choreo/companion.mjs"]
        PC --> IC
        PX --> IX
        PO --> IO
    end

    subgraph Runtimes["AI CLI Runtimes"]
        CC["Claude Code"]
        CX["Codex"]
        OC["OpenCode"]
        IC --> CC
        IX --> CX
        IO --> OC
    end
```

---

## Data Flow — Council Command

```mermaid
sequenceDiagram
    participant User
    participant HostCLI as Host CLI (e.g. Claude Code)
    participant Companion as companion.mjs (node subprocess)
    participant Claude as claude subprocess
    participant Codex as codex subprocess
    participant OpenCode as opencode subprocess

    User->>HostCLI: /choreo:council "Should we use Map?"
    HostCLI->>Companion: node ${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs council "..."
    Companion->>Companion: checkCli() × 3 → filterAvailable()
    Companion->>Companion: requireAvailable(agents, min=2)
    par Parallel spawns
        Companion->>Claude: claude --print --output-format stream-json --verbose "..."
        Companion->>Codex: codex exec "..."
        Companion->>OpenCode: opencode run "..."
    end
    Claude-->>Companion: stream-json → parseClaudeStreamJson()
    Codex-->>Companion: plain text
    OpenCode-->>Companion: ANSI text → parseOpenCodeOutput()
    Companion->>HostCLI: printDelimited(results) or printJSON()
    HostCLI->>User: formatted council output
```

---

## Plugin Bundle Flow

```mermaid
flowchart LR
    E1["plugin-claude/src/entry.mjs\n(re-export core/companion.mjs)"]
    E2["plugin-codex/src/entry.mjs"]
    E3["plugin-opencode/src/entry.mjs"]

    CORE["core/\nrunners.mjs + parsers.mjs + companion.mjs"]

    B["scripts/bundle.mjs\nesbuild: ESM · node22 · external: node:*"]

    OUT1["plugin-claude/scripts/companion.mjs\n(439L self-contained)"]
    OUT2["plugin-codex/scripts/companion.mjs\n(439L self-contained)"]
    OUT3["plugin-opencode/dist/companion.mjs\n(439L self-contained)"]

    CORE --> E1 & E2 & E3
    E1 & E2 & E3 --> B
    B --> OUT1 & OUT2 & OUT3
```

Each `entry.mjs` is a one-line re-export. esbuild tree-shakes and inlines all `core/` source. The output is a single ESM file with no npm dependencies — only Node.js builtins (`node:child_process`, `node:fs`, `node:url`, `node:os`, `node:path`).

---

## Install Flow

```mermaid
flowchart TD
    SRC["Repo source\n(git clone or npx)"]
    INS["bin/install.mjs\n--target=claude|codex|opencode|all"]
    SRC --> INS

    INS -->|"--target=claude"| IC["~/.claude/plugins/cache/mib200/choreo/1.0.0/\n(cpSync plugin-claude/)"]
    INS -->|"--target=codex"| IX["~/.codex/plugins/cache/mib200/choreo/1.0.0/\n(cpSync plugin-codex/)"]
    INS -->|"--target=opencode"| IO1["~/.config/opencode/commands/choreo-*.md\n(8 command files)"]
    INS -->|"--target=opencode"| IO2["~/.config/opencode/choreo/companion.mjs\n(bundled binary)"]

    IC --> MP1["Claude Code marketplace: mib200\n/plugin install choreo@mib200"]
    IX --> MP2["Codex marketplace: mib200\nskills appear automatically"]
    IO1 & IO2 --> OC["OpenCode\n/choreo-* commands available"]
```

---

## Core Module Relationships

```mermaid
graph LR
    CM["companion.mjs\n(CLI entry + re-exports)"]
    RN["runners.mjs\nREGISTRY · checkCli · runAgent\nfilterAvailable · requireAvailable\nprintDelimited · printJSON · stripFlags\nprintMissingWarning"]
    PA["parsers.mjs\nparseClaudeStreamJson\nparseOpenCodeOutput"]

    CM --> RN
    CM --> PA
```

`companion.mjs` imports from both modules and re-exports everything — plugins import only `companion.mjs`.

---

## REGISTRY

```js
export const REGISTRY = {
  claude:   { binary: 'claude',   setup: '/choreo:claude'   },
  codex:    { binary: 'codex',    setup: '/choreo:codex'    },
  opencode: { binary: 'opencode', setup: '/choreo:opencode' },
};
```

Each entry maps a logical agent name to:
- `binary` — the executable name used in `spawnSync` / `spawn`
- `setup` — the slash command shown in install hint messages

---

## Command Namespace Summary

| Runtime | Namespace | Example |
|---------|-----------|---------|
| Claude Code | `/choreo:*` | `/choreo:council` |
| Codex | skill name (no slash prefix) | `choreo-council` skill |
| OpenCode | `/choreo-*` | `/choreo-council` |

The difference in separator (colon vs hyphen) is a constraint of each runtime's command file naming convention.

---

## Key Design Constraints

| Constraint | Reason |
|------------|--------|
| `${CLAUDE_PLUGIN_ROOT}` with curly braces | Claude Code template substitution requires `${}` not `$()` or bare `$VAR` |
| `--output-format stream-json --verbose` for Claude | Bedrock returns empty `result` with plain `--print`; stream-json is the only reliable output format |
| No runtime npm deps | Bundled outputs must be self-contained for plugin environments without a `node_modules` |
| `--dangerously-skip-permissions` on delegated Claude calls | Delegated Claude instance is sandboxed under host agent supervision; non-interactive mode requires it |
| Bundled outputs committed to git | Plugins are installed by file copy, not npm install; the bundle must be present in the repo |
