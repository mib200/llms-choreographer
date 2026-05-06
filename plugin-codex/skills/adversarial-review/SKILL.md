---
name: choreo-adversarial-review
description: Use when running an adversarial review of the current branch or working tree to find material risks before shipping.
---

Run an adversarial code review. Codex actively tries to find reasons the change should not ship.

## Usage

Ask Codex to run this skill:

```
Use the choreo-adversarial-review skill: [focus text]
```

## What it does

Runs `node scripts/companion.mjs adversarial-review "$ARGUMENTS"` which:
1. Resolves the review target (working tree if dirty, branch diff against main if clean)
2. Collects git context (diff, commit log, changed files)
3. Sends an adversarial review prompt to Codex with structured output schema
4. Returns findings sorted by severity with file locations and recommendations

## Flags

- `--scope=working-tree` — review uncommitted changes only
- `--scope=branch` — review branch diff against default branch
- `--base=<ref>` — review against a specific ref
- `--json` — output as JSON

## Example

```
Use the choreo-adversarial-review skill: focus on auth and permission checks
```
