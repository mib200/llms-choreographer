---
name: llms-choreographer-vote
description: Put a yes/no proposition to Claude and OpenCode then tally YES / NO / ABSTAIN votes when the user wants a quick decision signal.
---

# LLMs Choreographer: Parallel Vote

## When to use

- User wants a decision signal: "should we adopt X?", "vote on whether we should Y"
- User says "vote", "take a vote", "poll the agents", or "yes/no from all agents"
- You want a quick consensus check before committing to an approach
- Use the council skill instead when you want reasoning and trade-offs

## Your role

You are the **SCOPE voter**. Your vote should reflect whether the proposition is the smallest viable solution or introduces unnecessary complexity. Vote YES if the scope is appropriate, NO if it seems over-engineered or under-specified, ABSTAIN if context is insufficient.

## Invocation

Spawn two agents in parallel, then cast your own vote:

```bash
PLUGIN_ARGS=$(sh "$HOME/.codex/skills/_shared/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.\n\nProposition: <proposition>" --dangerously-skip-permissions &
CLAUDE_PID=$!

opencode run "Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.\n\nProposition: <proposition>" --format json --dangerously-skip-permissions &
OPENCODE_PID=$!

wait $CLAUDE_PID $OPENCODE_PID
```

**Graceful degradation:** Check each agent with `command -v <binary>` before spawning. Skip missing agents and warn the user. Proceed as long as at least 1 external agent is available.

**OpenCode output:** extract assistant text from ndJSON stream (`type === "assistant"`, `message.content[].type === "text"`).

## Casting your vote

After collecting the other agents' responses, cast your own vote:

```
YES|NO|ABSTAIN — one sentence rationale from scope perspective.
```

## Output format

```
## Vote Tally

| Vote    | Count |
|---------|-------|
| YES     | N     |
| NO      | N     |
| ABSTAIN | N     |

## Per-Agent Rationale

**Claude:** YES — ...
**OpenCode:** NO — ...
**(you):** YES — ...
```

## Output handling

Return the vote tally and per-agent rationales in the format above verbatim.

Do not synthesize, reconcile, or adjudicate the votes unless the user explicitly asks for analysis or a recommendation.

## Known limitation

Codex sandbox limits file access to the current working directory. Tasks requiring files outside this scope may yield partial results.
