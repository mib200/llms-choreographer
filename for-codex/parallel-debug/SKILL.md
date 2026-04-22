---
name: llms-choreographer-parallel-debug
description: Parallel root-cause hypotheses from Claude and OpenCode for a reported bug. Use when the user says "parallel debug", "llms-choreographer debug", "multiple hypotheses", or "debug with all agents".
---

# LLMs Choreographer: Parallel Debug

## When to use

- Root cause of a bug is unclear
- User says "parallel debug", "llms-choreographer debug", "hypotheses from all agents"

## Your role

You generate hypotheses focused on **edge cases in input handling, type coercion, off-by-one errors**.

## Invocation

```bash
SYMPTOM="<symptom>"

claude --print --output-format=stream-json --verbose "Root-cause hypotheses, ranked by likelihood (numbered list). Focus: application logic, state management.\n\nSymptom: $SYMPTOM" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text' &
CLAUDE_PID=$!

opencode run "Root-cause hypotheses, ranked by likelihood (numbered list). Focus: infrastructure, concurrency, environment.\n\nSymptom: $SYMPTOM" --dangerously-skip-permissions &
OPENCODE_PID=$!

wait $CLAUDE_PID $OPENCODE_PID
```

**Graceful degradation:** Check each agent with `command -v <binary>` before spawning. Skip missing agents and warn the user. Proceed as long as at least 1 external agent is available.

**OpenCode output:** strip ANSI escape codes from stdout and return the plain text verbatim.

## Output handling

Merge all available hypothesis lists (agents + your edge-case hypotheses), prioritize ones flagged by multiple agents:

```
## Hypothesis Pool (ranked)
1. … (Claude + you)
2. … (OpenCode)

## Investigation Plan
1. Check X first — rules out hypotheses 1 and 3
```

## Known limitation

Codex sandbox limits access to the current working directory.
