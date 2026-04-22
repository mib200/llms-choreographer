---
name: llms-choreographer-claude
description: Delegate a task to Claude Code for a second opinion or alternative analysis.
---

# LLMs Choreographer: Delegate to Claude

This skill delegates tasks to Claude Code when the user asks for a second opinion from Claude or wants to compare answers.

## When to use

- User explicitly asks to delegate to Claude
- User wants a second opinion from Claude
- User wants to compare Claude's answer with Codex's
- User asks "what would Claude say?" or similar

## Invocation

Run Claude Code non-interactively:

```bash
claude --print --output-format=stream-json --verbose "<task>" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text'
```

`--output-format=stream-json --verbose` emits ndJSON events. `jq` extracts `type === "assistant"` events and prints `content[].text`. `--dangerously-skip-permissions` is required for automated execution.

## Output handling

Return Claude's output verbatim — no paraphrasing, no summaries.
