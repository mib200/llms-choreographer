# Changelog — Chorus

All notable changes to Chorus are documented here.

---

## [1.1.0] — 2025 (MCP package)

### Added
- `@valpere/chorus-opencode` MCP package v1.1.0 (`for-opencode/`)
- MCP stdio server with 11 tools: `delegate_claude`, `delegate_gemini`, `delegate_codex`, `delegate_cursor`, `delegate_kilo`, `check_agents`, `council`, `parallel_review`, `parallel_debug`, `second_opinion`, `vote`
- `second_opinion` tool with agent fallback (priority list: gemini → claude → codex → cursor → kilo)
- `parallel_review` and `parallel_debug` tools with role-assigned agents
- `--json` output flag for `council`, `review`, `debug`, `second-opinion`, `vote` subcommands
- `strict` mode flag for `council`, `parallel_review`, `parallel_debug` MCP tools
- Hermetic MCP integration test suite (`for-opencode/src/tests/`, 8 tests)
- `.github/instructions/` coding instruction files for AI agents

---

## [1.0.0] — Initial Release

### Added
- Full 6×6 delegation mesh: Claude Code, OpenCode, Gemini CLI, Codex, Cursor Agent CLI, Kilo Code CLI
- Claude Code plugins (`plugins/`) for all 6 agents with `setup`, `run`, `review` slash commands
- Chorus workflow plugins: `council`, `review`, `debug`, `second-opinion`, `vote`
- `companion.mjs` parallel orchestrator with subcommands: `check-all`, `council`, `review`, `debug`, `second-opinion`, `vote`
- Skill files for Gemini CLI (`for-gemini/`, 10 skills)
- Skill files for Codex (`for-codex/`, 10 skills)
- Rules for Cursor Agent CLI (`for-cursor/`, 10 rules)
- Skill files for Kilo Code CLI (`for-kilo/`, 10 skills)
- `.claude-plugin/marketplace.json` plugin registry
- Companion test suite (`plugins/chorus/scripts/tests/`, 29 tests)
- `docs/add-agent-checklist.md` for extending the mesh
- `AGENTS.md` AI agent context file
- `README.md` full user documentation with installation instructions per host
- MIT license

---

## Generating Updates

To update this changelog after new commits:

```bash
git log --oneline --no-merges -20
```

Group commits by type (feat, fix, docs, refactor) and append new entries above the most recent release.
