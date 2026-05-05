---
name: choreo-parallel-review
description: Use when running a parallel code review across all available agents on the current git diff.
---

Run a parallel code review. All agents review the current `git diff HEAD` simultaneously.

## Usage

```
Use the choreo-parallel-review skill
```

## What it does

Runs `node scripts/companion.mjs review` which:
1. Gets `git diff HEAD`
2. Sends diff to all available agents in parallel:
   - Claude: correctness and security
   - Codex: scope and simplicity
   - OpenCode: edge cases and robustness
3. Prints numbered findings per agent

## Example

```
Use the choreo-parallel-review skill
```
