---
description: Ask all available agents (Claude, Codex, OpenCode) to review a task in parallel from different perspectives.
---

Run multi-agent council review.

**Usage:** `/choreo-council <task or question>`

Runs all available agents in parallel:
- Claude: correctness, logic, security
- Codex: scope, complexity, simplicity
- OpenCode: integration, codebase fit, dependencies

```bash
node "$(dirname "$0")/../../dist/companion.mjs" council "$@"
```
