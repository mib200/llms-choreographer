---
name: choreo-parallel-debug
description: Use when generating ranked root-cause hypotheses for a bug symptom across all available agents in parallel.
---

Generate parallel root-cause hypotheses for a bug.

## Usage

```
Use the choreo-parallel-debug skill: <bug symptom or error message>
```

## What it does

Runs `node scripts/companion.mjs debug "<symptom>"` which asks all available agents to rank hypotheses:
- Claude: application logic, state management, data flow
- Codex: edge cases, off-by-one errors, type coercion
- OpenCode: infrastructure, concurrency, external dependencies

## Example

```
Use the choreo-parallel-debug skill: TypeError: Cannot read property 'id' of undefined at line 42
```
