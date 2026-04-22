# Delegation Round-Trip Reference

> See also: [Codebase Summary](./codebase-summary.md) · [System Architecture](./system-architecture.md) · [Deployment Guide](./deployment-guide.md)

How each agent delegates to every other agent via the `choreo` plugin.

## Round-Trip Matrix

| From \ To | Claude Code | Codex | OpenCode |
|-----------|-------------|-------|----------|
| **Claude Code** | `/choreo:claude <task>` | `/choreo:codex <task>` | `/choreo:opencode <task>` |
| **Codex** | `choreo-claude` skill | `choreo-codex` skill | `choreo-opencode` skill |
| **OpenCode** | `/choreo-claude <task>` | `/choreo-codex <task>` | `/choreo-opencode <task>` |

All routes go through `companion.mjs council` which runs available agents in parallel and returns results.

## Code Snippets

### Claude Code → any agent (`plugin-claude/scripts/companion.mjs`)

```bash
# council runs all available agents
node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" council "$ARGUMENTS"

# single-agent second opinion
node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" second-opinion --agent=codex "$ARGUMENTS"
```

### Codex → any agent (`plugin-codex/skills/*/SKILL.md`)

Skills invoke companion via natural language. Codex runs:

```bash
node scripts/companion.mjs council "<task>"
node scripts/companion.mjs second-opinion --agent=claude "<task>"
```

### OpenCode → any agent (`plugin-opencode/.opencode/commands/choreo-*.md`)

```bash
node "$HOME/.config/opencode/choreo/companion.mjs" council "$@"
node "$HOME/.config/opencode/choreo/companion.mjs" second-opinion "$@"
```

## Worked Example: Claude Code → Council

1. User types `/choreo:council "Should we use Map or object for this lookup?"`
2. Claude Code reads `plugin-claude/commands/council.md` → runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs council "..."`
3. `companion.mjs` checks availability of all 3 agents via `checkCli()`
4. Spawns available agents in parallel:
   - Claude: correctness/logic/security reviewer
   - Codex: scope/complexity/simplicity reviewer
   - OpenCode: integration/codebase-fit reviewer
5. Collects outputs, prints delimited per-agent sections

## Worked Example: Council with JSON output

```bash
node core/companion.mjs council --json "refactor this function" | jq '.results[].output'
```

## Caveats

- **Minimum 2 agents required** for council/review/debug/vote. `second-opinion` needs only 1.
- **Claude subprocess** uses `--output-format=stream-json --verbose` — required on Bedrock; plain `--print` returns empty `result` field.
- **OpenCode** output is plain text + ANSI — stripped by `parseOpenCodeOutput()`.
- **Cold-start latency** — Claude subprocess ~4-5s, Codex/OpenCode vary by model.
- **Self-delegation** — an agent delegating to itself creates a subprocess (not recursion); output is independent.
- **`--dangerously-skip-permissions`** — intentional on all delegated Claude calls; the delegated instance runs sandboxed under the host agent's supervision.
