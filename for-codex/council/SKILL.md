---
name: llms-choreographer-council
description: Run an LLM council — Claude (correctness), OpenCode (integration), and you (scope) tackle the same task in parallel. Use when the user wants multiple independent perspectives on a decision, approach, or problem.
---

# LLMs Choreographer: LLM Council

## When to use

- User asks for a multi-agent perspective on a decision or problem
- User says "council", "multiple opinions", "ask all agents", "LLM council"

## Your role in the council

You are the **SCOPE reviewer**. Focus on: unnecessary complexity, premature abstractions, whether the smallest viable solution was chosen.

## Agent roles

| Agent | Focus |
|-------|-------|
| Claude | Correctness — logic errors, type safety, security issues |
| OpenCode | Integration — codebase fit, patterns, dependency risks |
| (you) | Scope — unnecessary complexity, smallest viable solution |

## Invocation

Spawn both agents in parallel, then add your own scope review:

```bash
PLUGIN_ARGS=$(sh "$HOME/.codex/skills/_shared/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "You are the CORRECTNESS reviewer in an LLM council. Focus on: logic errors, type safety, off-by-one bugs, security issues. Be concise — bullet points.\n\nTask: <task>" --dangerously-skip-permissions &
CLAUDE_PID=$!

opencode run "You are the INTEGRATION reviewer in an LLM council. Focus on: codebase fit, consistency with existing patterns, dependency implications. Be concise — bullet points.\n\nTask: <task>" --format json --dangerously-skip-permissions &
OPENCODE_PID=$!

wait $CLAUDE_PID $OPENCODE_PID
```

**Graceful degradation:** Check each agent with `command -v <binary>` before spawning. Skip missing agents and warn the user. Proceed as long as at least 1 external agent is available.

**OpenCode output:** pipe stdout through an ndJSON parser — extract `type === "assistant"` events and concatenate `message.content[].text` blocks.

## Output handling

After collecting outputs plus your own scope review, synthesize as chairman:

1. **Consensus** — points all agents agree on
2. **Disagreements** — flag and adjudicate
3. **Chairman's Recommendation** — your own 2–4 sentence verdict informed by (but not just a summary of) the council

Format under `## Council Synthesis` and `## Recommendation`.

## Known limitation

Codex sandbox limits file access to the current working directory. Tasks that require reading files outside this scope may yield partial results.
