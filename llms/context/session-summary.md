# Session Summary — choreographer

**When:** 2026-04-22T19:58:23Z
**Branch:** main @ f132dca
**Previous session:** 2026-04-22T08:53:49Z — graphify + learn init + feature-trim rename

## Completed

- **Inter-agent communication bugs fixed** (`feature/issues` branch, merged to `main @ 2803ee5`):
  - `${CLAUDE_PLUGIN_ROOT}` curly-brace syntax fixed in all 9 plugin command files (`plugins/claude/`, `plugins/codex/`, `plugins/opencode/`, `plugins/llms-choreographer/` commands)
  - `opencode run --format json` removed — opencode emits plain text; replaced with `parseOpenCodeOutput` (ANSI stripping) in `companion.mjs`
  - `claude --print` subprocess fix — `--output-format=stream-json --verbose | jq` pipeline; added `parseClaudeStreamJson` to `companion.mjs`
  - `PLUGIN_ARGS` expansion removed from all `for-codex` SKILL files (caused "unknown option" error in Codex shell)
  - `jq` replaced fragile node one-liner in all for-codex SKILL files
  - `plugins/opencode` cache created and synced to `~/.claude/plugins/cache/llms-choreographer/opencode/1.0.0/`
- **`install-local.sh` updated** — added cache-sync step after each plugin install (`scripts/install-local.sh`)
- **Docs updated** to reflect all fixes:
  - `README.md` — delegation table, test count (33→32), delegation directions
  - `docs/codebase-summary.md` — exports list, test description, for-codex invocation notes
  - `docs/delegation.md` — Round-Trip Matrix, all Code Snippets, Worked Examples, Caveats
  - `docs/project-overview-pdr.md` — agent mesh table
- **`graphify --update`** run — graph rebuilt: 73 nodes, 129 edges, 6 communities. `graphify-out/graph.html` + `GRAPH_REPORT.md` updated.

## Current file state

- **Modified:** _(none — working tree clean)_
- **Untracked:** _(none)_
- **Branch status vs main:** on `main`, no branch ahead/behind (single branch, no remote)

## Pending TODOs

- [ ] Verify all agent delegation works end-to-end in a live session (Codex→Claude, Claude→council, etc.)
- [ ] Rename sweep: ~60 files on `main` still contain `chorus` refs (for-cursor, for-gemini, for-kilo, for-codex partial, .github, docs/announcement, AGENTS.md, CLAUDE.md)
- [ ] Rebuild code-review-graph index (may still reference stale paths after renames)
- [ ] Delete or commit `scripts/rename-chorus.mjs` (untracked scratch script)
- [ ] Run `/autoresearch:learn --mode update` to regenerate docs with current state

## Open bugs / concerns

- **`claude --print` cold-start latency** (~4-5s per subprocess call) — caused by Bedrock loading `cacheCreationInputTokens: 57K` from hooks/CLAUDE.md on every subprocess. Not a code bug; inherent to this setup.
- **Partial rename still outstanding** — `chorus` refs exist in for-cursor, for-gemini, for-kilo, for-codex partial, .github. These are functional but inconsistent with the `llms-choreographer` brand.
- **No git remote configured** — merges are local only; `git push` will fail until a remote is added.
- **`claude --print` on non-Bedrock** — stream-json pipeline assumed throughout; behavior on direct Anthropic API key untested.

## Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}` (curly braces) not `$CLAUDE_PLUGIN_ROOT` | Claude Code template substitution only matches `${VAR}` syntax |
| 2 | `--output-format=stream-json --verbose \| jq` for claude subprocess | Plain `--print` returns empty `result` field on Bedrock; stream-json events have text |
| 3 | Remove `opencode --format json` entirely | Flag doesn't exist; opencode emits plain text + ANSI |
| 4 | Drop `PLUGIN_ARGS` from for-codex skills | Multi-value string passed as single token in Codex shell → "unknown option" error |
| 5 | `jq` over node one-liner for stream-json parsing | Node inline parser with mixed quotes broke in Codex shell execution |
| 6 | Merge `feature/issues` to local `main` (no remote PR) | No remote configured; local merge preserves all commits |
| 7 | Rename slugs/paths: llms-choreographer | Matches `package.json.name` (carried from previous session) |
| 8 | `author: "Manish Kumar"` in package.json | User confirmed git user name (carried from previous session) |

## Recap suggestions

- Test full council flow: in Claude session run `/llms-choreographer:council "is 2+2=4?"` — should invoke all 3 agents
- Check Codex: `use the council skill on: one-word answer: sky color?` — verifies stream-json pipeline
- Remaining chorus rename: `grep -r 'chorus' for-cursor/ for-gemini/ for-kilo/ AGENTS.md CLAUDE.md .github/ 2>/dev/null | head -20`
- Add git remote when ready to push: `git remote add origin <url> && git push -u origin main`

## Open plan files

- `/Users/mk/.claude/plans/lexical-enchanting-hejlsberg.md`: completed (ship + docs update done)
