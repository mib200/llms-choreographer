---
description: Delegate a task to a second Claude Code instance and return its response.
argument-hint: <task or prompt to delegate>
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" council "$ARGUMENTS"'
