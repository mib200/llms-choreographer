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
claude --print --output-format=stream-json --verbose "Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.\n\nProposition: <proposition>" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text' &
CLAUDE_PID=$!

opencode run "Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.\n\nProposition: <proposition>" --dangerously-skip-permissions &
OPENCODE_PID=$!

wait $CLAUDE_PID $OPENCODE_PID
```

**Graceful degradation:** Check each agent with `command -v <binary>` before spawning. Skip missing agents and warn the user. Proceed as long as at least 1 external agent is available.

**OpenCode output:** strip ANSI escape codes from stdout and return the plain text verbatim.

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
