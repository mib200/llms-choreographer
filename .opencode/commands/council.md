---
description: LLM council — Claude (correctness) and Codex (scope/simplicity) tackle the same task in parallel
---

!`"$(dirname "$0")/_helpers/run-parallel.sh" \
  "You are the CORRECTNESS reviewer in an LLM council.
Focus on: logic errors, type safety, off-by-one bugs, unhandled edge cases, security issues.
Be concise — bullet points preferred.

Task: $ARGUMENTS" \
  "You are the SCOPE reviewer in an LLM council.
Focus on: unnecessary complexity, premature abstractions, whether the smallest solution was chosen.
Be concise — bullet points preferred.

Task: $ARGUMENTS"`
