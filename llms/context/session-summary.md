# Session Summary — choreographer

**When:** 2026-04-23T04:40:00Z
**Branch:** feature/monorepo-restructure @ e0e0779
**Previous session:** 2026-04-23T04:25:00Z — chunks 1-5 complete

## Completed This Session

- **Chunk 1** — `core/` extracted. 32/32 tests pass.
- **Chunk 2** — `plugin-claude/` scaffolded.
- **Chunk 3** — `plugin-codex/` scaffolded.
- **Chunk 4** — `plugin-opencode/` scaffolded.
- **Chunk 5** — esbuild bundler. 3 bundles produced. 32/32 tests pass.
- **Chunk 6** — Marketplaces updated:
  - `.claude-plugin/marketplace.json` — rewritten: `name: "mib200"`, one plugin `choreo` → `source: "./plugin-claude"`
  - `.agents/plugins/marketplace.json` — NEW: `name: "mib200"`, one plugin `choreo` → `source: {path: "./plugin-codex", source: "local"}`

## Current File State

- **Modified:** `.claude-plugin/marketplace.json`, `package.json`, `llms/context/session-summary.md`
- **Untracked:** `core/`, `plugin-claude/`, `plugin-codex/`, `plugin-opencode/`, `scripts/bundle.mjs`, `.agents/`, `node_modules/`
- **Branch ahead of main:** 2 commits. No remote.

## Pending TODOs

- [ ] **Chunk 7** — Write `bin/install.sh` + `bin/install.mjs`. Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installers (`scripts/install-local.sh`, `scripts/uninstall-local.sh`).
- [ ] **Chunk 9** — Update `README.md` + `docs/` files.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **OpenCode commands use `dirname "$0"` path** — needs verification during Chunk 10.
- **Single-agent commands all call `council`** — routes to all available agents. MVP acceptable.
- **`node_modules/` present** — check `.gitignore` before staging.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | Marketplace name: `mib200` (both Claude + Codex) |
| 2 | Claude marketplace source: `./plugin-claude` |
| 3 | Codex marketplace source: `{path: "./plugin-codex", source: "local"}` |
| 4 | `${CLAUDE_PLUGIN_ROOT}` curly braces for Claude commands |
| 5 | esbuild: `format: esm`, `platform: node`, `target: node22`, `external: ['node:*']` |
| 6 | Bundled outputs committed to git |
| 7 | Version sync at 1.0.0 |

## Recap for Next Session

- **Start at Chunk 7**: write `bin/install.sh` + `bin/install.mjs`
  - `bin/install.sh`: bash curl entry, flags `--target=claude|codex|opencode|all`, detects curl/wget, copies plugin dirs to correct locations
    - claude: copy `plugin-claude/` to `~/.claude/plugins/cache/mib200/choreo/1.0.0/`
    - codex: copy `plugin-codex/` to `~/.codex/plugins/cache/mib200/choreo/1.0.0/`
    - opencode: symlink/copy commands into `~/.config/opencode/commands/`
  - `bin/install.mjs`: Node entry (`#!/usr/bin/env node`), same logic
  - Both support `--local` flag (use local repo path instead of downloading)
- **Then Chunk 8**: delete legacy dirs
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` → 32 tests in `core/tests/`
