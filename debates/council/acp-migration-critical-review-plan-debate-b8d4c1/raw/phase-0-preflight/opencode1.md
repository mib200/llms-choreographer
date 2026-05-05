---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-0-preflight
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

1. Has `@agentclientprotocol/claude-agent-acp` been verified to exist and speak compliant ACP stdio — e.g., via `npm view` or actual install? The prior council research never mentions this package and explicitly concluded "zero of four agents speak native ACP," so this is a new factual claim that underpins two labeled blockers.

2. Did the user explicitly override the prior council's binding decision to reject "ACP-first" in favor of "adapter-interface-first"? The critical-review plan reintroduces ACP-first framing (items 2, 5, 6) that directly contradicts the council's consensus position, yet no user override is documented in the provided files.

3. Does Gemini actually have native ACP stdio transport today (distinct from the `--acp` A2A server mode noted in research)? If Gemini's ACP support is unverified, then re-locking it to Ship 5+ is clearly correct; if it is verified and cheap, the leak into Ship 2 may be justified.
