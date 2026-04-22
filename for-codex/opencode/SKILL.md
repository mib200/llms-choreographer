---
name: llms-choreographer-opencode
description: Delegate a task to OpenCode for a second opinion or alternative analysis.
---

# LLMs Choreographer: Delegate to OpenCode

This skill delegates tasks to OpenCode when the user asks for a second opinion or wants to compare answers.

## When to use

- User explicitly asks to delegate to OpenCode
- User wants a second opinion from OpenCode
- User wants to compare OpenCode's answer with Codex's
- User asks "what would OpenCode say?" or similar

## Invocation

Run OpenCode non-interactively and capture the response:

```bash
opencode run "<task>" --dangerously-skip-permissions
```

OpenCode emits plain text (with ANSI escape codes). Strip ANSI codes and return the text verbatim.

Set `OPENCODE_SERVER_URL=http://localhost:4096` before running to reuse a warm `opencode serve` instance instead of cold-starting a new one.

## Output handling

Return OpenCode's final assistant text verbatim — no paraphrasing, no summaries.
