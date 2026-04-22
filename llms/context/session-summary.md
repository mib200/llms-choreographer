# Session Summary — choreographer

**When:** 2026-04-23T04:10:00Z
**Branch:** feature/monorepo-restructure @ 8a24d7c
**Previous session:** 2026-04-23T03:50:00Z — chunks 1-3 complete

## Completed This Session

- **Chunk 1** — `core/` extracted. 32/32 tests pass.
- **Chunk 2** — `plugin-claude/` scaffolded (8 commands, plugin.json, SKILL.md, src/entry.mjs).
- **Chunk 3** — `plugin-codex/` scaffolded (plugin.json, 9 skills, src/entry.mjs).
- **Chunk 4** — `plugin-opencode/` scaffolded:
  - `plugin-opencode/package.json` — name: `@mib200/choreo-opencode`, files: [`.opencode`, `dist`]
  - `plugin-opencode/.opencode/plugins/choreo.ts` — imports `../../dist/companion.mjs`
  - `plugin-opencode/.opencode/commands/` — 8 command files: choreo-claude, choreo-codex, choreo-opencode, choreo-council, choreo-parallel-review, choreo-parallel-debug, choreo-second-opinion, choreo-vote
  - `plugin-opencode/src/entry.mjs` — `export * from '../../core/companion.mjs'`
  - `plugin-opencode/dist/` dir created (esbuild populates in Chunk 5)

## Current File State

- **Modified:** `package.json`, `llms/context/session-summary.md`
- **Untracked:** `core/`, `plugin-claude/`, `plugin-codex/`, `plugin-opencode/`
- **Branch status vs main:** ahead by 2 commits. No remote.

## Pending TODOs

- [ ] **Chunk 5** — Write `scripts/bundle.mjs` (esbuild). Inputs: `plugin-{claude,codex,opencode}/src/entry.mjs`. Outputs: `plugin-claude/scripts/companion.mjs`, `plugin-codex/scripts/companion.mjs`, `plugin-opencode/dist/companion.mjs`. Install esbuild devDep.
- [ ] **Chunk 6** — Rewrite `.claude-plugin/marketplace.json` (name: `mib200`, one plugin: `choreo` → `./plugin-claude`) + create `.agents/plugins/marketplace.json` for Codex (source: `./plugin-codex`).
- [ ] **Chunk 7** — Write `bin/install.sh` + `bin/install.mjs`. Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installer scripts.
- [ ] **Chunk 9** — Update `README.md` + `docs/` files.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **OpenCode commands use `dirname "$0"` path** — assumes command file is invoked as a shell script. Need to verify how OpenCode resolves commands at runtime. May need adjustment during Chunk 10 verification.
- **Single-agent commands (claude.md, codex.md, opencode.md, choreo-claude.md etc.) all call `council`** — routes to all available agents. No single-agent mode in companion yet. MVP acceptable.
- **`scripts/companion.mjs` not yet present** in plugin-claude/ or plugin-codex/ — Chunk 5 esbuild produces it.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` curly braces for Claude commands |
| 2 | `--output-format=stream-json --verbose` for Claude subprocess |
| 3 | OpenCode commands: `choreo-` prefix (no colon support) |
| 4 | entry.mjs = thin re-export; esbuild inlines core/ at bundle time |
| 5 | All commands point to bundle output (`scripts/` or `dist/`) not `src/` |
| 6 | Marketplace name: `mib200` |
| 7 | Version sync at 1.0.0 |

## Recap for Next Session

- **Start at Chunk 5**: write `scripts/bundle.mjs`
  - Install esbuild: `npm install --save-dev esbuild`
  - Three build targets:
    - `{ in: 'plugin-claude/src/entry.mjs', out: 'plugin-claude/scripts/companion.mjs' }`
    - `{ in: 'plugin-codex/src/entry.mjs', out: 'plugin-codex/scripts/companion.mjs' }`
    - `{ in: 'plugin-opencode/src/entry.mjs', out: 'plugin-opencode/dist/companion.mjs' }`
  - Options: `bundle: true, format: 'esm', platform: 'node', target: 'node22', external: ['node:*']`
  - Run `npm run bundle` and verify all 3 outputs produced
- **Then Chunk 6**: update `.claude-plugin/marketplace.json` + create `.agents/plugins/marketplace.json`
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` → 32 tests in `core/tests/`
