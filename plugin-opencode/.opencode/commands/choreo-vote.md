---
description: Put a proposition to a YES/NO/ABSTAIN vote across all available agents with tally and per-agent rationale.
---

Vote on a proposition.

**Usage:** `/choreo-vote <proposition>`

Each agent responds YES, NO, or ABSTAIN with one sentence of rationale. Prints vote tally.

```bash
node "$(dirname "$0")/../../dist/companion.mjs" vote "$@"
```
