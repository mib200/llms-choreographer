---
name: choreo
description: Use when delegating to other agents, running a council review, getting a second opinion, parallel debugging, or voting on a proposition.
---

You have access to multi-agent choreography commands via the choreo plugin.

## Available commands

- `/choreo:council <task>` — All agents review in parallel (correctness / scope / integration perspectives)
- `/choreo:parallel-review` — All agents review current git diff in parallel
- `/choreo:parallel-debug <symptom>` — All agents generate root-cause hypotheses in parallel
- `/choreo:second-opinion [--agent=claude|codex|opencode] <decision>` — Single agent second opinion with fallback
- `/choreo:vote <proposition>` — YES/NO/ABSTAIN vote with tally
- `/choreo:claude <task>` — Delegate to Claude
- `/choreo:codex <task>` — Delegate to Codex
- `/choreo:opencode <task>` — Delegate to OpenCode

## When to invoke

Invoke these commands when the user:
- Asks to "delegate", "get a second opinion", "run a council", "ask all agents", or "vote on"
- Wants parallel perspectives on a code change, bug, or architectural decision
- Uses phrases like "what do the other agents think", "council review", "parallel debug"
