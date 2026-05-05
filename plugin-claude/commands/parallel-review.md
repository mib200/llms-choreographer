---
description: Run a parallel code review across all available agents. Each agent reviews current git diff from a different angle.
argument-hint: (no argument needed — reviews current git diff)
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" review "$ARGUMENTS"'
