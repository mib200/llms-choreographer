---
description: Run a parallel code review across all available agents on the current git diff.
---

Parallel code review of current git diff.

**Usage:** `/choreo-parallel-review`

Each agent reviews from a different angle:
- Claude: correctness and security
- Codex: scope and simplicity
- OpenCode: edge cases and robustness

```bash
node "$(dirname "$0")/../../dist/companion.mjs" review "$@"
```
