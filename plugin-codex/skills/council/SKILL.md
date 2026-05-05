---
name: choreo-council
description: Use when delegating a task to all available agents (Claude, Codex, OpenCode) for parallel review from different perspectives: correctness, scope, and integration.
---

Run a multi-agent council review. All available agents review the task in parallel.

## Usage

Ask Codex to run this skill with a task:

```
Use the choreo-council skill: <task or question>
```

## What it does

Runs `node scripts/companion.mjs council "<task>"` which:
1. Checks which agents (claude, codex, opencode) are available
2. Runs them in parallel, each with a different review focus:
   - Claude: correctness, logic errors, security
   - Codex: scope, complexity, simplicity
   - OpenCode: integration, codebase fit, dependencies
3. Prints delimited results per agent

## Example

```
Use the choreo-council skill: Should we use a Map or an object for this lookup?
```
