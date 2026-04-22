---
description: Get a second opinion on a decision or approach from another agent. Uses Claude by default; pass --agent=codex or --agent=opencode to choose.
argument-hint: [--agent=claude|codex|opencode] <decision or approach>
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" second-opinion "$ARGUMENTS"'
