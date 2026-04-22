---
name: choreo-second-opinion
description: Use when getting a second opinion on a decision or approach from another agent. Falls back gracefully if the preferred agent is unavailable.
---

Get a second opinion on a decision or approach.

## Usage

```
Use the choreo-second-opinion skill: <decision or approach>
Use the choreo-second-opinion skill: --agent=claude <decision>
Use the choreo-second-opinion skill: --agent=opencode <decision>
```

## What it does

Runs `node scripts/companion.mjs second-opinion "<task>"`. Defaults to Claude; falls back to next available agent if unavailable. Agent verdict: approve / approve-with-caveats / reject.

## Example

```
Use the choreo-second-opinion skill: --agent=claude Should we use a singleton here or dependency injection?
```
