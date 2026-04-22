# Session Summary — choreographer

**When:** 2026-04-23T04:55:00Z
**Branch:** feature/monorepo-restructure @ 9f707be
**Previous session:** 2026-04-23T04:40:00Z — chunks 1-6 complete

## Completed This Session

- **Chunks 1-6** — core/, plugin-claude/, plugin-codex/, plugin-opencode/, esbuild bundle, marketplaces. All done.
- **Chunk 7** — Installers written and smoke-tested:
  - `bin/install.sh` — bash entry (curl/wget download OR `--local`), `--target=claude|codex|opencode|all`
  - `bin/install.mjs` — Node entry (`#!/usr/bin/env node`), same logic
  - Claude target: copies `plugin-claude/` → `~/.claude/plugins/cache/mib200/choreo/1.0.0/`
  - Codex target: copies `plugin-codex/` → `~/.codex/plugins/cache/mib200/choreo/1.0.0/`
  - OpenCode target: copies `choreo-*.md` → `~/.config/opencode/commands/`, `companion.mjs` → `~/.config/opencode/choreo/`
  - Smoke test: `node bin/install.mjs --target=claude` succeeded, dir structure verified

## Current File State

- **Modified:** `.claude-plugin/marketplace.json`, `package.json`, `llms/context/session-summary.md`
- **Untracked:** `core/`, `plugin-claude/`, `plugin-codex/`, `plugin-opencode/`, `scripts/bundle.mjs`, `.agents/`, `bin/`, `node_modules/`
- **Branch ahead of main:** 2 commits. No remote.

## Pending TODOs

- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, `scripts/install-local.sh`, `scripts/uninstall-local.sh`. Only safe once Chunk 10 verifies new structure works.
- [ ] **Chunk 9** — Update `README.md` + `docs/delegation.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md`.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, install flows, e2e council test, graphify rebuild.
- [ ] **Merge to main** + tag v1.0.0.

## Open Bugs / Concerns

- **OpenCode companion path hardcoded** — `install.sh`/`install.mjs` copy companion to `~/.config/opencode/choreo/companion.mjs`. The `.opencode/commands/choreo-*.md` files use `dirname "$0"` which won't resolve to this path. **Need to fix command files in Chunk 9/10** to use absolute path or env var pointing to installed companion.
- **Single-agent commands all call `council`** — MVP acceptable.
- **`node_modules/` needs `.gitignore` entry** — check before staging.
- **No git remote configured** — local only.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | Both bash + Node installers (shared logic, separate implementations) |
| 2 | Claude: `~/.claude/plugins/cache/mib200/choreo/1.0.0/` |
| 3 | Codex: `~/.codex/plugins/cache/mib200/choreo/1.0.0/` |
| 4 | OpenCode: commands → `~/.config/opencode/commands/`, companion → `~/.config/opencode/choreo/` |
| 5 | Marketplace name: `mib200`, plugin name: `choreo` |
| 6 | Bundled outputs committed to git |

## Recap for Next Session

- **Start at Chunk 8**: delete legacy dirs
  - `rm -rf plugins/ for-codex/ .opencode/ learn/ .worktrees/`
  - `rm -f scripts/install-local.sh scripts/uninstall-local.sh`
  - Check for `scripts/rename-chorus.mjs` and `scripts/claude-print-args.sh` — delete if present
  - Audit `docs/` for announcement*.md stale files
- **Then Chunk 9**: update docs
- **Then Chunk 10**: full verification pass
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` → 32 tests in `core/tests/`
