---
description: Run an adversarial review of the current branch or working tree. Finds material risks before shipping.
argument-hint: [--scope=auto|working-tree|branch] [--base=<ref>] [focus text]
allowed-tools: Bash
---

!bash -c 'node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" adversarial-review "$ARGUMENTS"'
