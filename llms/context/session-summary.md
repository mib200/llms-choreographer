# Session Summary — choreographer

**When:** 2026-04-23T03:50:00Z
**Branch:** feature/monorepo-restructure @ 549c746
**Previous session:** 2026-04-23T03:30:00Z — chunks 1-2 complete

## Completed This Session

- **Chunk 1** — `core/` extracted (parsers.mjs, runners.mjs, companion.mjs, tests/). 32/32 tests pass.
- **Chunk 2** — `plugin-claude/` scaffolded (plugin.json, 8 commands, SKILL.md, src/entry.mjs).
- **Chunk 3** — `plugin-codex/` scaffolded:
  - `plugin-codex/.codex-plugin/plugin.json` — name: `choreo`, skills: `./skills`, interface with category/capabilities
  - `plugin-codex/skills/` — 9 SKILL.md files: claude, codex, opencode, council, parallel-review, parallel-debug, second-opinion, vote, debug
  - `plugin-codex/src/entry.mjs` — `export * from '../../core/companion.mjs'`
  - `plugin-codex/scripts/` dir created (esbuild populates in Chunk 5)

## Current File State

- **Modified:** `package.json`, `llms/context/session-summary.md`
- **Untracked:** `core/`, `plugin-claude/`, `plugin-codex/`
- **Not yet committed:** all of the above (summary commit pending after transfer)

## Pending TODOs

- [ ] **Chunk 4** — Scaffold `plugin-opencode/` (`package.json`, `.opencode/plugins/choreo.ts`, 8 commands `choreo-*.md`, `src/entry.mjs`, `dist/` dir)
- [ ] **Chunk 5** — Write `scripts/bundle.mjs` (esbuild) + wire `npm run bundle`. Bundle produces 3 `companion.mjs` outputs.
- [ ] **Chunk 6** — Rewrite `.claude-plugin/marketplace.json` (name: `mib200`, one plugin: `choreo`) + create `.agents/plugins/marketplace.json` for Codex.
- [ ] **Chunk 7** — Write `bin/install.sh` + `bin/install.mjs`. Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installer scripts.
- [ ] **Chunk 9** — Update `README.md` + `docs/` files for new structure.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **`claude.md`, `codex.md`, `opencode.md` all call `council`** — all 3 single-agent commands route to council (multi-agent). No single-agent dispatch in companion yet. Acceptable MVP behaviour.
- **Bundled `scripts/companion.mjs` not yet present** in plugin-claude/ or plugin-codex/ — esbuild Chunk 5 produces them.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` curly braces required |
| 2 | `--output-format=stream-json --verbose` for Claude subprocess |
| 3 | REGISTRY setup hints: `/choreo:*` namespace |
| 4 | entry.mjs = thin re-export; esbuild inlines core/ at bundle time |
| 5 | All commands point to `scripts/companion.mjs` (bundle output) |
| 6 | Codex: 9 SKILL.md files; tight descriptions to avoid auto-fire |
| 7 | OpenCode: `choreo-` prefix (no colon in filenames) |
| 8 | Marketplace name: `mib200` |
| 9 | Version sync at 1.0.0 across all 3 plugins |

## Recap for Next Session

- **Start at Chunk 4**: scaffold `plugin-opencode/`
  - `plugin-opencode/package.json` — name: `@mib200/choreo-opencode`, version 1.0.0, files: [`.opencode`, `dist`]
  - `plugin-opencode/.opencode/plugins/choreo.ts` — OpenCode plugin TS hook importing from `../../dist/companion.mjs`
  - `plugin-opencode/.opencode/commands/choreo-*.md` — 8 files: choreo-claude, choreo-codex, choreo-opencode, choreo-council, choreo-parallel-review, choreo-parallel-debug, choreo-second-opinion, choreo-vote
  - `plugin-opencode/src/entry.mjs` — `export * from '../../core/companion.mjs'`
  - `plugin-opencode/dist/` dir (esbuild populates)
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` → 32 tests in `core/tests/`
