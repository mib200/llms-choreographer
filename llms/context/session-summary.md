# Session Summary — choreographer

**When:** 2026-04-23T22:35:00Z
**Branch:** fixes/feature-monorepo @ 9d9b882
**Previous session:** feature/monorepo-restructure — all 10 chunks complete

## Completed

- `/autoresearch:learn --mode update` — docs updated + 3 new docs:
  - `docs/system-architecture.md` (177L) — 5 Mermaid diagrams
  - `docs/testing-guide.md` (130L) — test strategy + fake-agents API
  - `docs/deployment-guide.md` (220L) — install all 3 runtimes, marketplace setup
  - `docs/codebase-summary.md` +21L, `docs/project-overview-pdr.md` +14L, `docs/delegation.md` +2L
  - `learn/260423-update/` — learn log + summary
- `/autoresearch:predict --chain debug,fix` — 5-persona swarm complete:
  - 40 raw findings → 10 clusters: 2 CRITICAL + 6 HIGH + 2 MEDIUM
  - `predict/260423-10348-quality/` — overview, findings, hypothesis-queue, handoff.json
- 8 bugs fixed (all confirmed by code recon), 32/32 tests pass, linter clean:
  - `core/runners.mjs` — spawnSync timeout, runAgent kill timeout, requireAvailable throws
  - `core/parsers.mjs` — parse errors logged to stderr, ANSI regex via String.fromCharCode
  - `core/companion.mjs` — requireAvailable try/catch x4, vote quorum check, git diff maxBuffer, unhandledRejection
  - `bin/install.mjs` — existsSync pre-check, try/catch + rollback
- All changes committed (5 commits on fixes/feature-monorepo)

## Current File State

- **Modified:** none (clean working tree)
- **Untracked:** none
- **Branch status vs main:** fixes/feature-monorepo, 5 commits ahead (no remote)

## Pending TODOs

- [ ] Merge `feature/monorepo-restructure` → main + tag v1.0.0
- [ ] Merge/rebase `fixes/feature-monorepo` → main
- [ ] Discuss H-01 (`--dangerously-skip-permissions`) — architectural, needs decision

## Open Bugs / Concerns

- **H-01 UNRESOLVED** `--dangerously-skip-permissions` universal — `core/companion.mjs:53+` — design decision required
- **npm name unclaimed** `@mib200/choreographer-monorepo` — registry 404
- **No git remote** — all work local only

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Namespace `/choreo:*` Claude+Codex, `/choreo-*` OpenCode | No colon in OpenCode filenames |
| 2 | `${CLAUDE_PLUGIN_ROOT}` curly braces required | Claude Code template substitution |
| 3 | `--output-format=stream-json --verbose` required | Bedrock: plain `--print` returns empty |
| 4 | Bundles committed to git | No build step at install time |
| 5 | Single-agent commands route through council | Known limitation |
| 6 | `requireAvailable` throws Error, CLI entry owns exit | Library contract |
| 7 | `runAgent` timeout 5min, `checkCli` timeout 5s | Practical LLM response window |
| 8 | vote all-INVALID = CRITICAL exit 1 | Correctness contract |

## Recap Suggestions

- Merge: rebase `fixes/feature-monorepo` onto `feature/monorepo-restructure`, then merge to main
- Tag v1.0.0 after merge
- H-01 options: (a) remove from vote/council/debug, (b) `--allowedTools read`, (c) document only
- Claim npm name `@mib200/choreographer-monorepo` before publishing

## Open Plan Files

- `predict/260423-10348-quality/handoff.json` — H-01 still open
- `predict/260423-10348-quality/findings.md` — complete findings with evidence
