---
name: choreo-debug
description: Use when generating root-cause hypotheses for a single bug symptom using one agent (alias for parallel-debug with single agent focus).
---

Generate root-cause hypotheses for a bug symptom.

## Usage

```
Use the choreo-debug skill: <bug symptom or error message>
```

## What it does

Runs `node scripts/companion.mjs debug "<symptom>"`. Same as choreo-parallel-debug — uses all available agents. Prefer `choreo-parallel-debug` for explicit multi-agent framing.

## Example

```
Use the choreo-debug skill: fetch() returns 200 but response body is empty
```
