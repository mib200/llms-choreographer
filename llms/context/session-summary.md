# Session Summary — choreographer

**When:** 2026-04-22T22:59:38Z
**Branch:** fixes/feature-monorepo @ 1e048c0
**Previous session:** fixes session — H-01 closed + memory saved

## Completed

- /autoresearch:debug 15-iteration hunt: 6 bugs confirmed, 9 eliminated (debug/<stamp>-bugs/)
- /autoresearch:fix — 6/7 fixed, B-03 deferred (codex runtime research)
- Rebundled plugins (a1861aa): SIGTERM timeout + requireAvailable-throws now in bundles
- Installer hardened (218a414): B-04 path rewrite, B-02 guard, B-05 orphan delete, B-08 rollback
- Bundle drift guard (430f178): scripts/check-bundles.mjs + npm run check-bundles
- Debug artifacts committed (1e048c0)
- 9 install-sim tests pass
- .claude/settings.json allowlist: user blocked the write

## Current File State

- Modified: none (clean)
- Untracked: none
- Branch: fixes/feature-monorepo, 10 commits ahead of main, no remote

## Pending TODOs

- [ ] B-03: codex skills use relative scripts/companion.mjs path — need codex runtime research
- [ ] Merge feature/monorepo-restructure → main + tag v1.0.0
- [ ] Merge/rebase fixes/feature-monorepo → main
- [ ] Wire check-bundles into CI/pre-commit

## Open Bugs / Concerns

- B-03 UNRESOLVED — plugin-codex/skills/*/SKILL.md
- npm name unclaimed @mib200/choreographer-monorepo (404)
- No git remote — all work local

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | /choreo:* Claude+Codex, /choreo-* OpenCode | No colon in OpenCode filenames |
| 2 | ${CLAUDE_PLUGIN_ROOT} curly braces required | Claude Code template substitution |
| 3 | --output-format=stream-json --verbose | Bedrock: plain --print returns empty |
| 4 | Bundles committed to git | No build step at install time |
| 5 | Single-agent commands route through council | Known limitation |
| 6 | requireAvailable throws Error, CLI owns exit | Library contract |
| 7 | runAgent 5min timeout, checkCli 5s | Practical LLM window |
| 8 | vote all-INVALID = CRITICAL exit 1 | Correctness contract |
| 9 | H-01 closed: --dangerously-skip-permissions universal | User 2026-04-23 |
| 10 | Opencode installer sed-rewrites relative → absolute | Template uses $(dirname) that breaks post-install |
| 11 | Drift check via sha256 | esbuild byte-stable |

## Recap Suggestions

- B-03: check codex CLI for plugin-root env var; if none, installer must sed-rewrite codex skills too
- Wire npm run check-bundles into pre-commit or GH Action
- Merge + tag v1.0.0 before claiming npm name
- Run /ultrareview on fixes/feature-monorepo before merge

## Open Plan Files

- debug/<stamp>-bugs/findings.md — 6 bugs with evidence + fixes
- debug/<stamp>-bugs/summary.md — severity + fix order
- predict/<prior>-quality/findings.md — prior predict (H-01 closed)
