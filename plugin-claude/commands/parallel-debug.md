---
description: Ask all available agents to generate ranked root-cause hypotheses for a bug symptom in parallel.
argument-hint: <bug symptom or error message>
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" debug "$ARGUMENTS"'
