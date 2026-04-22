---
description: Get a second opinion on a decision or approach. Uses Claude by default; pass --agent=codex or --agent=opencode to choose.
---

Get a second opinion on a decision.

**Usage:** `/choreo-second-opinion [--agent=claude|codex|opencode] <decision or approach>`

Agent verdict: approve / approve-with-caveats / reject. Falls back to next available agent if chosen agent is unavailable.

```bash
node "$(dirname "$0")/../../dist/companion.mjs" second-opinion "$@"
```
