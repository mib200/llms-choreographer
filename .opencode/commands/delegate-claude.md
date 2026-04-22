---
description: Delegate a task to Claude Code and return its output
---

!`
PLUGIN_ARGS=$(sh "$(dirname "$0")/_helpers/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "$ARGUMENTS" --dangerously-skip-permissions
`
