# Session Summary — choreographer

**When:** 2026-04-23T22:23:33Z
**Branch:** fixes/feature-monorepo @ ccdae6a
**Previous session:** feature/monorepo-restructure — all 10 chunks complete, branch ready to merge

## Completed

- `/autoresearch:learn --mode update` — docs updated + 3 new docs created:
  - `docs/system-architecture.md` (177L) — 5 Mermaid diagrams
  - `docs/testing-guide.md` (130L) — test strategy, per-file reference, fake-agents API
  - `docs/deployment-guide.md` (220L) — install all 3 runtimes, marketplace setup
  - `docs/codebase-summary.md` +21L, `docs/project-overview-pdr.md` +14L, `docs/delegation.md` +2L
  - `learn/260423-update/` — learn log + summary
- `/autoresearch:predict --chain debug,fix` — 5-persona swarm, 40 findings → 10 clusters, 2 CRITICAL + 6 HIGH + 2 MEDIUM
  - `predict/260423-10348-quality/` — full report + handoff.json
- Debug chain recon complete — all 8 hypotheses confirmed by code evidence

## Current File State

- **Untracked:** `docs/deployment-guide.md`, `docs/system-architecture.md`, `docs/testing-guide.md`, `predict/`
- **Modified:** `docs/codebase-summary.md`, `docs/delegation.md`, `docs/project-overview-pdr.md`, `learn/260423-update/`
- **Branch status vs main:** fixes/feature-monorepo, no new commits this session

## Pending TODOs

- [ ] Commit docs updates + new docs
- [ ] Run `/autoresearch:fix` — 8 confirmed bugs from predict chain
- [ ] Merge feature/monorepo-restructure → main + tag v1.0.0

## Open Bugs / Concerns

1. **CRITICAL** vote all-INVALID exits 0 — `core/companion.mjs:244-260`
2. **CRITICAL** `--dangerously-skip-permissions` universal — `core/companion.mjs:53+`
3. **HIGH** git diff no maxBuffer + LLM injection — `core/companion.mjs:84-98`
4. **HIGH** installOpenCode ENOENT unhandled — `bin/install.mjs:63-64`
5. **HIGH** checkCli spawnSync no timeout — `core/runners.mjs:14`
6. **HIGH** runAgent no timeout — `core/runners.mjs:54-68`
7. **HIGH** requireAvailable process.exit in library — `core/runners.mjs:~100`
8. **HIGH** parseClaudeStreamJson swallows errors — `core/parsers.mjs:8-14`

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Namespace `/choreo:*` Claude+Codex, `/choreo-*` OpenCode | No colon in OpenCode filenames |
| 2 | `${CLAUDE_PLUGIN_ROOT}` curly braces required | Claude Code template substitution |
| 3 | `--output-format=stream-json --verbose` required | Bedrock: plain `--print` returns empty |
| 4 | Bundles committed to git | No build step at install time |
| 5 | Single-agent commands route through council | Known limitation, in non-goals |
| 6 | predict: `--dangerously-skip-permissions` = HIGH not CRITICAL | Required for non-interactive ops |
| 7 | predict: vote all-INVALID = CRITICAL | Correctness contract violation |

## Recap Suggestions

- Run `/autoresearch:fix` — handoff at `predict/260423-10348-quality/handoff.json`
- Fix order: H-02 (vote quorum) → H-05/H-06 (timeouts) → H-07 (process.exit) → H-08 (parser) → H-04 (install) → H-03 (git diff)
- H-01 (`--dangerously-skip-permissions`) is architectural — discuss before changing
- After fixes: commit → merge feature/monorepo-restructure → main → tag v1.0.0
- npm name `@mib200/choreographer-monorepo` not yet claimed (registry 404)

## Open Plan Files

- `predict/260423-10348-quality/handoff.json` — fix chain input
- `predict/260423-10348-quality/hypothesis-queue.md` — ranked queue
