# Session Summary — choreographer

**When:** 2026-04-23T04:25:00Z
**Branch:** feature/monorepo-restructure @ 365b7f3
**Previous session:** 2026-04-23T04:10:00Z — chunks 1-4 complete

## Completed This Session

- **Chunk 1** — `core/` extracted. 32/32 tests pass.
- **Chunk 2** — `plugin-claude/` scaffolded.
- **Chunk 3** — `plugin-codex/` scaffolded.
- **Chunk 4** — `plugin-opencode/` scaffolded.
- **Chunk 5** — esbuild bundler wired:
  - `scripts/bundle.mjs` — 3 build targets (plugin-claude, plugin-codex, plugin-opencode)
  - `esbuild ^0.28.0` added to `devDependencies`
  - `npm run bundle` produces all 3 outputs (439 lines each, ESM, node22, node:* external)
  - Outputs: `plugin-claude/scripts/companion.mjs`, `plugin-codex/scripts/companion.mjs`, `plugin-opencode/dist/companion.mjs`
  - 32/32 tests still pass after bundle

## Current File State

- **Modified:** `package.json` (esbuild devDep added), `llms/context/session-summary.md`
- **Untracked:** `core/`, `plugin-claude/`, `plugin-codex/`, `plugin-opencode/`, `scripts/bundle.mjs`, `node_modules/`
- **Branch ahead of main:** 2 commits. No remote.

## Pending TODOs

- [ ] **Chunk 6** — Rewrite `.claude-plugin/marketplace.json` (name: `mib200`, owner, one plugin: `choreo` → source: `./plugin-claude`) + create `.agents/plugins/marketplace.json` for Codex (source: `./plugin-codex`).
- [ ] **Chunk 7** — Write `bin/install.sh` + `bin/install.mjs`. Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installers.
- [ ] **Chunk 9** — Update `README.md` + `docs/` files.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **OpenCode commands use `dirname "$0"` path** — needs verification during Chunk 10.
- **Single-agent commands all call `council`** — routes to all available agents. MVP acceptable.
- **`node_modules/` present** — ensure `.gitignore` covers it before staging.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` curly braces for Claude commands |
| 2 | `--output-format=stream-json --verbose` for Claude subprocess |
| 3 | esbuild: `format: esm`, `platform: node`, `target: node22`, `external: ['node:*']` |
| 4 | Bundled outputs committed to git (marketplace install works without Node toolchain) |
| 5 | Marketplace name: `mib200` |
| 6 | Version sync at 1.0.0 |

## Recap for Next Session

- **Start at Chunk 6**: update marketplaces
  - `.claude-plugin/marketplace.json` → rewrite: `name: "mib200"`, `owner: {name: "Manish Kumar"}`, `plugins: [{name: "choreo", source: "./plugin-claude", ...}]`
  - `.agents/plugins/marketplace.json` → NEW: same structure but `source: "./plugin-codex"`, `source.source: "local"`
  - Reference: session-choreographer plugin uses `marketplace.json` at repo root with `name`, `owner`, `plugins[].source`
- **Then Chunk 7**: `bin/install.sh` + `bin/install.mjs`
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` → 32 tests in `core/tests/`
