---
description: Ask all available agents (Claude, Codex, OpenCode) to review a task in parallel. Each agent reviews from a different perspective.
argument-hint: <task or question for the council>
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" council "$ARGUMENTS"'
