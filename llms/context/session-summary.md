# Session Summary — choreographer

**When:** 2026-04-23T05:10:00Z
**Branch:** feature/monorepo-restructure @ baebaa8
**Previous session:** 2026-04-23T04:55:00Z — chunks 1-7 complete

## Completed This Session

- **Chunks 1-7** — core/, 3 plugins, esbuild, installers, marketplaces. All done.
- **Chunk 8** — Legacy deleted. Big commit baebaa8 (97 files, 2666 insertions, 1928 deletions):
  - Deleted: `plugins/`, `for-codex/`, `.opencode/`, `scripts/install-local.sh`, `scripts/uninstall-local.sh`, `scripts/claude-print-args.sh`
  - `learn/` and `.worktrees/` already gitignored — not tracked, no action needed

## Current File State

- **Working tree:** clean (after baebaa8)
- **Branch ahead of main:** 3 commits. No remote.

## Pending TODOs

- [ ] **Chunk 9** — Update `README.md` + `docs/delegation.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md` for new structure.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test, graphify rebuild.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **OpenCode companion path** — command files use `dirname "$0"` which won't resolve to installed companion. Fix during Chunk 9 (update command docs) or accept as known limitation.
- **Single-agent commands all call `council`** — MVP.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | Marketplace name: `mib200`, plugin name: `choreo` |
| 2 | Claude: `~/.claude/plugins/cache/mib200/choreo/1.0.0/` |
| 3 | Codex: `~/.codex/plugins/cache/mib200/choreo/1.0.0/` |
| 4 | OpenCode: commands → `~/.config/opencode/commands/`, companion → `~/.config/opencode/choreo/` |
| 5 | Bundled outputs committed to git |
| 6 | Version sync at 1.0.0 |

## Recap for Next Session

- **Start at Chunk 9**: update docs
  - `README.md` — rewrite: install matrix (3 methods × 3 runtimes), usage table, `/choreo:*` command list
  - `docs/delegation.md` — update command names to `/choreo:*`, update file paths
  - `docs/codebase-summary.md` — update structure, remove stale export lists
  - `docs/project-overview-pdr.md` — update agent mesh table with new invocation paths
- **Then Chunk 10**: full verification
  - `npm run bundle` → 3 outputs
  - `npm test` → 32 pass
  - `node bin/install.mjs --target=claude` → dir exists
  - `/choreo:council` e2e (manual)
  - graphify rebuild
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
