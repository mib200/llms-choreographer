---
name: llms-choreographer-parallel-review
description: Parallel code review of the current git diff from Claude (correctness/security), OpenCode (edge cases), and you (scope/simplicity). Use when the user says "parallel review", "review with all agents", or "llms-choreographer review".
---

# LLMs Choreographer: Parallel Code Review

## When to use

- User wants code reviewed from multiple angles simultaneously
- User says "parallel review", "all agents review", "llms-choreographer review"

## Your role

You review for **SCOPE AND SIMPLICITY**: unnecessary complexity, changes exceeding the stated goal, simpler alternatives.

## Invocation

```bash
git diff HEAD > /tmp/llms-choreographer-diff.txt

PLUGIN_ARGS=$(sh "$HOME/.codex/skills/_shared/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "Review for CORRECTNESS AND SECURITY. Numbered findings.\n\n$(cat /tmp/llms-choreographer-diff.txt)" --dangerously-skip-permissions &
CLAUDE_PID=$!

opencode run "Review for EDGE CASES AND ROBUSTNESS. Numbered findings.\n\n$(cat /tmp/llms-choreographer-diff.txt)" --format json --dangerously-skip-permissions &
OPENCODE_PID=$!

wait $CLAUDE_PID $OPENCODE_PID
```

**Graceful degradation:** Check each agent with `command -v <binary>` before spawning. Skip missing agents and warn the user. Proceed as long as at least 1 external agent is available.

**OpenCode output:** extract assistant text from ndJSON stream (`type === "assistant"`, `message.content[].type === "text"`).

## Output handling

Synthesize all available reviews (up to two agents + your scope review):

```
## Parallel Review Summary
**Critical findings** (2+ agents): …
**Verdict**: <proceed / needs revision>
```

Review-only — do not apply patches.

## Known limitation

Codex sandbox limits access to the current working directory. Reviews of files outside this scope will be incomplete.
