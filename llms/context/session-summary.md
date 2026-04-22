# Session Summary — choreographer

**When:** 2026-04-23T01:45:00Z
**Branch:** feature/monorepo-restructure @ f132dca (no commits yet on branch)
**Previous session:** 2026-04-22T19:58:23Z — inter-agent communication bug fixes + docs update

## Completed

- **Research & plan drafted** for full monorepo restructure. Plan file: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md` (~12 KB).
- **Codex plugin system + OpenCode plugin system researched** via `ctx_fetch_and_index`:
  - Codex: `.codex-plugin/plugin.json` manifest. Skills only — no slash commands. Reads `.claude-plugin/marketplace.json` OR `.agents/plugins/marketplace.json`. Cache at `~/.codex/plugins/cache/$MKT/$PLUGIN/$VER/`.
  - OpenCode: npm packages + `.opencode/commands/*.md` slash commands (filename = cmd, no colon namespace). `.opencode/plugins/*.ts` for TS hooks.
  - Reference plugin pattern confirmed at `/Users/mk/Repositories/mib200/AI/claude/plugins/session-choreographer/` — marketplace name `mib200`, owner `Manish Kumar`, plugin source `./plugin`.
- **Feature branch created**: `feature/monorepo-restructure` off `main`. Working tree clean.
- **Task list seeded**: 10 tasks tracking implementation chunks (core extract → 3 plugin scaffolds → bundler → marketplaces → installers → legacy delete → docs → verify).
- **Existing companion.mjs code read + indexed** via ctx_batch_execute. Key functions preserved: `parseClaudeStreamJson`, `parseOpenCodeOutput`, `runAgent`, `REGISTRY`, `filterAvailable`, `requireAvailable`, `stripFlags`, `printDelimited`, `printJSON`. Subcommands: check-all, council, review, debug, second-opinion, vote.
- **Test files enumerated**: 7 test suites under `plugins/llms-choreographer/scripts/tests/` (check-all, json-output, min-agents, parse-opencode, second-opinion-fallback, strip-flags, vote) + helpers/ dir.

## Current file state

- **Modified:** _(none — feature branch created, no files changed yet)_
- **Untracked:** _(none)_
- **Branch status vs main:** on `feature/monorepo-restructure`, 0 ahead / 0 behind. No remote.

## Pending TODOs

- [ ] **Chunk 1** — Extract `core/` from existing `plugins/llms-choreographer/scripts/companion.mjs` → `core/{companion,parsers,runners}.mjs` + move tests to `core/tests/`.
- [ ] **Chunk 2** — Scaffold `plugin-claude/` (manifest, 8 commands under `commands/*.md` → `/choreo:*`, 1 SKILL.md, src/entry.mjs).
- [ ] **Chunk 3** — Scaffold `plugin-codex/` (`.codex-plugin/plugin.json` per OpenAI schema, 9 skills under `skills/*/SKILL.md`, src/entry.mjs).
- [ ] **Chunk 4** — Scaffold `plugin-opencode/` (npm package `@mib200/choreo-opencode`, `.opencode/plugins/choreo.ts`, 8 commands `choreo-*.md` → `/choreo-*`, dist output).
- [ ] **Chunk 5** — Write `scripts/bundle.mjs` (esbuild) + wire `npm run bundle`. Produces 3 bundled companion.mjs files.
- [ ] **Chunk 6** — Rewrite `.claude-plugin/marketplace.json` (name: `mib200`) + create `.agents/plugins/marketplace.json` for Codex.
- [ ] **Chunk 7** — Write `bin/install.sh` (bash curl entry) + `bin/install.mjs` (npx entry). Flags: `--target=claude|codex|opencode|all`.
- [ ] **Chunk 8** — Delete legacy: `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, old installer scripts. Only AFTER verification.
- [ ] **Chunk 9** — Update README.md + docs/{delegation,codebase-summary,project-overview-pdr}.md for new structure.
- [ ] **Chunk 10** — Verify: `npm run bundle`, `npm test`, Claude/Codex/OpenCode install, `/choreo:council` e2e test, graphify rebuild.
- [ ] **Merge to main** + tag v1.0.0 after full verification.

## Open bugs / concerns

- **Session context at 89%** when wrap triggered — implementation began but immediately hit context limit. Fresh session needed before coding begins.
- **Bundled outputs in git** — decided YES (commit bundles). Contributors still run `npm run bundle` before commit; users installing from git skip build.
- **Version sync** — all 3 plugins + root package.json pinned to 1.0.0 initially. One bump per release.
- **OpenCode namespace limitation** — no colon support in slash commands. Chose `choreo-` prefix (`/choreo-claude`, `/choreo-codex`, etc). Not true `/choreo:*` parity with Claude/Codex.
- **Codex multi-skill auto-fire risk** — 9 separate SKILL.md files. Codex may invoke skills on keyword matches. Mitigation: tight `description:` frontmatter. Monitor in verification.
- **No git remote configured** — merges local only. `git push` fails until user adds remote.
- **Claude subprocess Bedrock latency** (~4-5s cold-start) — inherent, not a code bug. Carried from prior session.

## Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` (curly braces) not `$CLAUDE_PLUGIN_ROOT` | Claude Code template substitution only matches `${VAR}` syntax |
| 2 | `--output-format=stream-json --verbose \| jq` for claude subprocess | Plain `--print` returns empty `result` field on Bedrock; stream-json events have text |
| 3 | Remove `opencode --format json` entirely | Flag doesn't exist; opencode emits plain text + ANSI |
| 4 | Drop `PLUGIN_ARGS` from for-codex skills | Multi-value string passed as single token in Codex shell → "unknown option" error |
| 5 | **Monorepo over Hybrid** | User wants per-runtime isolation + independent versioning potential. Chosen after weighing bundle-at-build-time cost. |
| 6 | **esbuild bundler** | Bundles `core/` into each `plugin-*/` pre-commit. Standard JS monorepo pattern. 5-line config. |
| 7 | **Commit bundled output to git** | Users installing from marketplace/curl don't need Node toolchain. Contributors rebuild via `npm run bundle` before commit. |
| 8 | **Version sync across plugins** | All 3 plugins share version. One changelog, one bump per release. |
| 9 | **Branch workflow** | Build new structure on `feature/monorepo-restructure`. Merge after verification. |
| 10 | **Namespace: `/choreo:*` for Claude+Codex, `/choreo-*` for OpenCode** | Claude+Codex plugins named `choreo` (colon namespace). OpenCode filename=cmd, no colon → prefix convention. |
| 11 | **Marketplace name: `mib200`** | Matches session-choreographer reference + user's GitHub org. |
| 12 | **9 separate Codex skills** (claude, codex, opencode, council, parallel-review, parallel-debug, second-opinion, vote, debug) | Closer to Claude slash-cmd parity. Accept auto-fire risk; mitigate via tight descriptions. |
| 13 | **Both bash curl AND npx installers** | `bin/install.sh` for marketplace-less users + `bin/install.mjs` for npm ecosystem. Shared arg parser. |
| 14 | **Aggressive prune + consolidate for-codex/.opencode** | Delete `plugins/`, `for-codex/`, `.opencode/`, `learn/260422-init/`, `.worktrees/`, duplicate `claude-print-args.sh`, obsolete installer scripts, announcement docs. |
| 15 | **Delete all `setup.md` commands** | Trivial health-check wrappers — confirmed unnecessary. |

## Recap suggestions

- Next session starts **Chunk 1**: extract `core/` from `plugins/llms-choreographer/scripts/companion.mjs`. Preserve all 7 existing tests. Write new unit tests for parsers.
- **Read these first**: `/Users/mk/.claude/plans/what-were-we-doing-lazy-lantern.md` (full plan), existing `plugins/llms-choreographer/scripts/companion.mjs` (source code to extract).
- **Reference pattern**: `/Users/mk/Repositories/mib200/AI/claude/plugins/session-choreographer/` — study `marketplace.json` + `plugin/.claude-plugin/plugin.json` + `install.sh`.
- **Codex plugin docs**: `.codex-plugin/plugin.json` schema — fields `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `skills: "./skills"`, `interface: {displayName, category, capabilities}`.
- **Fresh session, then**: `git checkout feature/monorepo-restructure` and proceed through 10-chunk task list. Don't start implementation in same session as plan — context pollution.
- **Execution order reminder**: core → plugin-claude → plugin-codex → plugin-opencode → bundler → marketplaces → installers → verify → delete legacy → docs → commit.
