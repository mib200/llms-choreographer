---
name: choreo-codex
description: Use when delegating a task to a second Codex instance and returning its response.
---

Delegate a task to a second Codex instance.

## Usage

```
Use the choreo-codex skill: <task or prompt>
```

## What it does

Runs `node scripts/companion.mjs council "<task>"` targeting Codex. Returns Codex's response.

## Example

```
Use the choreo-codex skill: Is this the simplest way to implement this?
```
