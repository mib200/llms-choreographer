---
name: llms-choreographer-second-opinion
description: Quick independent second opinion from Claude or OpenCode on a decision or approach. The agent gives a verdict — approve, approve-with-caveats, or reject. Use when the user says "second opinion", "sanity check", "quick check", or "what does X think".
---

# LLMs Choreographer: Second Opinion

## When to use

- Quick sanity check on a decision or approach
- User says "second opinion", "sanity check", "what does Claude/OpenCode think"

## Invocation

```bash
# Ask Claude (default — depth, correctness, edge cases)
claude --print --output-format=stream-json --verbose "Give a concise second opinion. Be direct: agree / concerns / verdict (approve / approve-with-caveats / reject).\n\n<approach>" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text'

# Or ask OpenCode (integration — does this fit the codebase?)
opencode run "Give a concise second opinion. Be direct: agree / concerns / verdict (approve / approve-with-caveats / reject).\n\n<approach>" --dangerously-skip-permissions
```

**Graceful degradation:** If the requested agent is not installed (`command -v <binary>` fails), fall back to the next available one and tell the user which agent you used instead.

**Claude output:** jq extracts assistant text from stream-json events.
**OpenCode output:** strip ANSI escape codes from stdout and return the plain text verbatim.

## Output handling

Return the agent's output verbatim — no additional commentary needed. The agent's verdict is self-contained.
