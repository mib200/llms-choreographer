---
member: opencode3
model: opencode-go/qwen3.6-plus
phase: phase-0-preflight
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

1. Has `@agentclientprotocol/claude-agent-acp` been verified to exist on npm and function as an ACP stdio wrapper for Claude CLI? The critical-review plan commits to it as the primary ACP path, but the feasibility research doc makes no mention of this package — only `@anthropic-ai/claude-agent-sdk` and a third-party `claude-code-acp`. If this package doesn't exist or is unmaintained, the entire Claude ACP adapter strategy in Ship 2 collapses.

2. What was the user's stated rationale for locking Gemini to Ship 5+? The prior council placed Gemini in Ships 1-2 (REGISTRY entry, `/choreo:gemini` command, adapter), and the user overrode that. The current plan still leaks Gemini into Ship 1 and Ship 2. Knowing whether the lock was based on cost, instability, API quota, or strategic deferral affects whether the re-lock is correct or whether Gemini's native ACP support is cheap enough to include earlier.

3. For the broker channel split (`broker.agents` vs `broker.events`): are the internal events (builder_stop, verifier_dispatch, lifecycle transitions) already concrete with known producers and consumers in the current codebase, or is this anticipatory structure for Ship 4's Verifier Loop which hasn't been built yet? This determines whether the split is separating proven concerns or pre-building scaffolding.
