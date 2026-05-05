---
description: Put a proposition to a vote across all available agents. Each agent responds YES, NO, or ABSTAIN with a one-sentence rationale.
argument-hint: <proposition to vote on>
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" vote "$ARGUMENTS"'
