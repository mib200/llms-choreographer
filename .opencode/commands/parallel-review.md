---
description: Parallel code review of the current git diff — Claude (correctness/security) and Codex (scope/simplicity)
---

!`
DIFF=$(git diff HEAD 2>/dev/null)
if [ -z "$DIFF" ]; then DIFF="No uncommitted changes found."; fi
"$(dirname "$0")/_helpers/run-parallel.sh" \
  "Review these code changes for CORRECTNESS AND SECURITY.
Focus on: bugs, logic errors, security vulnerabilities, unsafe patterns.
Be concise — numbered findings.

$DIFF" \
  "Review these code changes for SCOPE AND SIMPLICITY.
Focus on: unnecessary complexity, changes that exceed the stated goal, simpler alternatives.
Be concise — numbered findings.

$DIFF"
`
