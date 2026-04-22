---
name: choreo-claude
description: Use when delegating a task specifically to Claude Code and returning its response.
---

Delegate a task to Claude Code.

## Usage

```
Use the choreo-claude skill: <task or prompt>
```

## What it does

Runs `node scripts/companion.mjs council "<task>"` targeting Claude. Returns Claude's response.

## Example

```
Use the choreo-claude skill: Review this function for edge cases.
```
