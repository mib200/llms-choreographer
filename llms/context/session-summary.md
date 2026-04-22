# Session Summary — choreographer

**When:** 2026-04-23T03:30:00Z
**Branch:** feature/monorepo-restructure @ cf11354
**Previous session:** 2026-04-23T01:45:00Z — monorepo plan drafted, feature branch created

## Completed This Session

- **Chunk 1** — `core/` extracted from `plugins/llms-choreographer/scripts/companion.mjs`:
  - `core/parsers.mjs` — `parseClaudeStreamJson`, `parseOpenCodeOutput`
  - `core/runners.mjs` — `REGISTRY` (updated to `/choreo:*` setup hints), all helpers + subprocess wrappers (`checkCli`, `filterAvailable`, `printMissingWarning`, `requireAvailable`, `runAgent`, `printDelimited`, `printJSON`, `stripFlags`)
  - `core/companion.mjs` — CLI dispatcher (check-all, council, review, debug, second-opinion, vote) + re-exports all from parsers + runners
  - `core/tests/helpers/fake-agents.mjs` — COMPANION path updated to `../../companion.mjs`, BINARY_MAP trimmed to claude/codex/opencode
  - `core/tests/*.test.mjs` — 7 test files copied from old location, imports valid
  - `package.json` — updated name to `@mib200/choreographer-monorepo`, test path → `core/tests/*.test.mjs`, added `bundle` script stub
  - **32/32 tests pass** via `npm test`

- **Chunk 2** — `plugin-claude/` scaffolded:
  - `plugin-claude/.claude-plugin/plugin.json` — name: `choreo`, version 1.0.0, author Manish Kumar
  - `plugin-claude/commands/` — 8 command files: `claude.md`, `codex.md`, `opencode.md`, `council.md`, `parallel-review.md`, `parallel-debug.md`, `second-opinion.md`, `vote.md`
  - All commands use `${CLAUDE_PLUGIN_ROOT}` (curly braces) and point to `scripts/companion.mjs`
  - `plugin-claude/skills/choreo/SKILL.md` — trigger on delegate/council/second-opinion/vote phrases
  - `plugin-claude/src/entry.mjs` — `export * from '../../core/companion.mjs'`
  - `plugin-claude/scripts/` dir created (esbuild will populate `companion.mjs` here in Chunk 5)

## Current File State

- **Modified:** `package.json`
- **Untracked:** `core/`, `plugin-claude/`
- **Branch status vs main:** ahead by 1 commit (cf11354 = session summary update). No remote.

## Pending TODOs

- [ ] **Chunk 3** — Scaffold `plugin-codex/` (`.codex-plugin/plugin.json`, 9 skills under `skills/*/SKILL.md`, `src/entry.mjs`)
- [ ] **Chunk 4** — Scaffold `plugin-opencode/` (`package.json`, `.opencode/plugins/choreo.ts`, 8 commands `choreo-*.md`, `src/entry.mjs`)
- [ ] **Chunk 5** — Write `scripts/bundle.mjs` (esbuild) + wire `npm run bundle`. Produces 3 bundled companion.mjs files.
- [ ] **Chunk 6** — Rewrite `.claude-plugin/marketplace.json` (name: `mib200`) + create `.agents/plugins/marketplace.json` for Codex.
- [ ] **Chunk 7** — Write `bin/install.sh` + `bin/install.mjs`. Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installer scripts. Only AFTER verification.
- [ ] **Chunk 9** — Update `README.md` + `docs/{delegation,codebase-summary,project-overview-pdr}.md` for new structure.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, Claude/Codex/OpenCode install, `/choreo:council` e2e test, graphify rebuild.
- [ ] **Merge to main** + tag v1.0.0 after full verification.

## Open Bugs / Concerns

- **`claude.md`, `codex.md`, `opencode.md` all call `council`** — single-agent delegation commands wired to `council` mode (delegates to all available). Companion has no single-agent mode yet. Acceptable for MVP; refine if single-agent routing needed later.
- **`plugin-claude/scripts/companion.mjs` not yet present** — esbuild in Chunk 5 will produce it. Plugin won't work until then.
- **Bundled outputs in git** — YES (committed). Contributors run `npm run bundle` before commit.
- **No git remote configured** — merges local only.
- **Claude subprocess Bedrock latency** (~4-5s cold-start) — inherent.

## Key Decisions (carried forward)

| # | Decision |
|---|----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` (curly braces) — required for Claude Code template substitution |
| 2 | `--output-format=stream-json --verbose \| jq` for claude subprocess |
| 3 | REGISTRY setup hints updated to `/choreo:*` namespace |
| 4 | `plugin-claude/src/entry.mjs` = thin re-export of `core/companion.mjs` (esbuild inlines at bundle time) |
| 5 | All commands point to `scripts/companion.mjs` (esbuild output, not `src/`) |
| 6 | Codex: 9 separate SKILL.md files (claude, codex, opencode, council, parallel-review, parallel-debug, second-opinion, vote, debug) |
| 7 | OpenCode: `choreo-` prefix for slash commands (no colon support in filenames) |
| 8 | Marketplace name: `mib200` |
| 9 | Version sync across all 3 plugins + root package.json at 1.0.0 |

## Recap for Next Session

- **Start at Chunk 3**: scaffold `plugin-codex/` — Codex manifest + 9 skill SKILL.md files + `src/entry.mjs`
- **Codex plugin.json schema**: fields `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `skills: "./skills"`, `interface: {displayName, shortDescription, category: "Productivity", capabilities: [...]}`
- **9 Codex skills**: claude, codex, opencode, council, parallel-review, parallel-debug, second-opinion, vote, debug
- **After Chunk 3**: Chunk 4 (plugin-opencode) → Chunk 5 (esbuild bundle) → Chunk 6 (marketplaces) → Chunk 7 (installers) → Chunk 8 (delete legacy) → Chunk 9 (docs) → Chunk 10 (verify)
- **Plan file**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md`
- **Tests**: `npm test` from repo root runs 32 tests in `core/tests/`
