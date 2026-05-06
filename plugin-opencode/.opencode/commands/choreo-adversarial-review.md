---
description: Run an adversarial review of the current branch or working tree. Finds material risks before shipping.
---

Run adversarial code review. Actively tries to find reasons the change should not ship.

**Usage:** `/choreo-adversarial-review [--scope=auto|working-tree|branch] [--base=<ref>] [focus text]`

Collects git context and runs adversarial review with structured output.

```bash
node "$(dirname "$0")/../../dist/companion.mjs" adversarial-review "$@"
```
