---
name: choreo-opencode
description: Use when delegating a task to OpenCode and returning its response.
---

Delegate a task to OpenCode.

## Usage

```
Use the choreo-opencode skill: <task or prompt>
```

## What it does

Runs `node scripts/companion.mjs council "<task>"` targeting OpenCode. Returns OpenCode's response.

## Example

```
Use the choreo-opencode skill: How does this change fit with the existing codebase patterns?
```
