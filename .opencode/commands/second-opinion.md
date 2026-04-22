---
description: Quick second opinion from Claude on a decision or approach (approve / approve-with-caveats / reject)
---

!`
PLUGIN_ARGS=$(sh "$(dirname "$0")/_helpers/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "Give a concise second opinion on the following decision or approach.
Be direct: state what you agree with, what concerns you, and your overall verdict (approve / approve-with-caveats / reject).

$ARGUMENTS" --dangerously-skip-permissions
`
