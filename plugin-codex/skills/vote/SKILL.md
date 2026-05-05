---
name: choreo-vote
description: Use when putting a proposition to a YES/NO/ABSTAIN vote across all available agents with a tally and per-agent rationale.
---

Vote on a proposition across all available agents.

## Usage

```
Use the choreo-vote skill: <proposition>
```

## What it does

Runs `node scripts/companion.mjs vote "<proposition>"`. Each agent responds YES, NO, or ABSTAIN with one sentence of rationale. Prints vote tally and per-agent rationale.

## Example

```
Use the choreo-vote skill: We should rewrite the auth module in TypeScript.
```
