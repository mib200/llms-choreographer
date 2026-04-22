# Session Summary — choreographer

**When:** 2026-04-23T06:00:00Z
**Branch:** feature/monorepo-restructure @ 1c3fb82
**Status:** ALL 10 CHUNKS COMPLETE — branch ready to merge to main

## What Was Done

Full monorepo restructure of the choreographer repo. Previous structure had 4 separate plugins with drift risk and no shared core. New structure: one shared `core/` library bundled via esbuild into 3 runtime-specific plugins.

### Chunks completed

| # | Chunk | Key output |
|---|-------|-----------|
| 1 | Extract core/ | `core/parsers.mjs`, `core/runners.mjs`, `core/companion.mjs`, 32 tests passing |
| 2 | plugin-claude/ | `.claude-plugin/plugin.json`, 8 `/choreo:*` commands, SKILL.md, src/entry.mjs |
| 3 | plugin-codex/ | `.codex-plugin/plugin.json`, 9 SKILL.md files, src/entry.mjs |
| 4 | plugin-opencode/ | `package.json` (@mib200/choreo-opencode), choreo.ts, 8 `/choreo-*` commands, src/entry.mjs |
| 5 | esbuild bundle | `scripts/bundle.mjs`, 3 × 439-line ESM bundles |
| 6 | Marketplaces | `.claude-plugin/marketplace.json` (mib200/choreo → plugin-claude), `.agents/plugins/marketplace.json` (mib200/choreo → plugin-codex) |
| 7 | Installers | `bin/install.sh`, `bin/install.mjs`, `--target=claude\|codex\|opencode\|all` |
| 8 | Legacy deleted | `plugins/`, `for-codex/`, `.opencode/`, old scripts — 97 files changed |
| 9 | Docs | README.md, docs/delegation.md, docs/codebase-summary.md, docs/project-overview-pdr.md — all rewritten |
| 10 | Verify | npm run bundle ✓, npm test 32/32 ✓, install smoke test ✓, check-all (claude 2.1.117 / codex 0.122.0 / opencode 1.14.20) ✓, graph rebuilt (117 nodes, 761 edges) ✓ |

## Current State

- **Branch:** `feature/monorepo-restructure`, 6 commits ahead of main
- **Working tree:** clean
- **Tests:** 32/32 pass (`npm test`)
- **Bundles:** present in `plugin-claude/scripts/`, `plugin-codex/scripts/`, `plugin-opencode/dist/`

## Key Architecture Decisions

| Decision | Detail |
|----------|--------|
| Namespace | `/choreo:*` for Claude+Codex, `/choreo-*` for OpenCode (no colon in filenames) |
| Marketplace name | `mib200` (both Claude + Codex) |
| Plugin name | `choreo` |
| Core extraction | `runners.mjs` owns REGISTRY (setup hints updated to `/choreo:*`); `parsers.mjs` owns stream-json + ANSI parsing |
| esbuild | ESM, node22, `external: ['node:*']`, bundles committed to git |
| `${CLAUDE_PLUGIN_ROOT}` | Curly braces required for Claude Code template substitution |
| `--output-format=stream-json --verbose` | Required for Bedrock; plain `--print` returns empty result |
| Installers | Claude → `~/.claude/plugins/cache/mib200/choreo/1.0.0/`; Codex → `~/.codex/plugins/cache/mib200/choreo/1.0.0/`; OpenCode → `~/.config/opencode/commands/` + `~/.config/opencode/choreo/companion.mjs` |

## Known Limitations (not blocking merge)

- Single-agent commands (`/choreo:claude`, `/choreo:codex`, `/choreo:opencode`) all route through `council` (multi-agent). No single-agent dispatch yet.
- OpenCode commands reference `$HOME/.config/opencode/choreo/companion.mjs` — requires install step to resolve.
- No git remote configured — push requires manual remote setup.
- `@mib200/choreo-opencode` not published to npm.

## Next Steps (post-merge)

```bash
# Merge
git checkout main
git merge feature/monorepo-restructure
git tag v1.0.0

# Install all 3 runtimes
node bin/install.mjs --target=all

# Register Claude marketplace and install plugin
# (inside Claude Code session)
/plugin marketplace add /path/to/choreographer
/plugin install choreo@mib200
```

## File Locations

- **Plan:** `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md` (now stale — all work done)
- **Core tests:** `core/tests/*.test.mjs` — run with `npm test`
- **Bundle script:** `scripts/bundle.mjs` — run with `npm run bundle`
- **Installers:** `bin/install.sh`, `bin/install.mjs`
