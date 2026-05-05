---
member: opencode3
model: opencode-go/deepseek-v4-pro
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:20:00Z
exit_code: 0
---

**I concede to opencode1** on observability. Core/observability.mjs with structured NDJSON logs from Ship 1 is correct.

**I concede to opencode4** that "parity" is not a product outcome. Success metrics should gate every ship. Verbatim v1.9.12 is the measurable baseline — the only thing proven to work.

**I concede to opencode5** that at least 4 evolutions must die. I go further — all 7 deferred to Ship 3.5. But add: Evolution B (citations) should be killed outright, not deferred. Creates a two-tier council where subprocess agents cannot guarantee line-number precision.

**I reject claude-anon's** central claim that Phase 0 validates ACP viability. Four agents, zero verified ACP speakers. This is a fiction propping up a 490-line protocol that exactly one agent might speak natively.

**I reject opencode2's** claim that evolutions A/B/E/F/G are safe "data-shape changes." Evolution A adds parse-failure paths; G adds version-negotiation drift. Protocol-level failure modes injected before base has seen one production round.

**I sharpen against opencode5** on Stop-review as Ship 1. The plan retires `codex exec` by Ship 5. Building a gate that intercepts a soon-to-be-dead code path is waste. If Stop-review has value, prove it AFTER the broker exists.

**I reject opencode2's council-before-broker ordering.** Council without broker is 3-5 sequential subprocess calls — what the codebase already does. No new value.

**I align with opencode1 and opencode4** on /choreo:codex single-agent fix in Ship 1. ~20 lines, existing subprocess path, zero adapters.

**I hold on killing acp-client.mjs.** Adapter boundary already abstracts transport.

**My new addition**: council crash recovery. Fix: `council.json` checkpoint file written per phase transition. Ship 3 mandatory for any multi-round debate.

## UPDATED POSITION

1. **Kill ACP-first.** Dual-protocol from Ship 1. Kill acp-client.mjs.
2. **Ship 1 = /choreo:codex fix + observability.** Single-agent dispatch via existing subprocess path. NDJSON logs. Zero adapters.
3. **Ship 2 = adapter interface.** Thin. Protocol-agnostic. Shim Codex and Claude through it.
4. **Ship 3 = verbatim v1.9.12 council.** 39 lines. No evolutions. council.json crash recovery mandatory.
5. **Ship 3.5 = evolutions A-G.** Gated by production data. Kill Evolution B outright.
6. **Ship 4 = broker.** Extracted after adapter and council prove interface.
7. **Drop Stop-review gate.** Irrelevant until broker exists.
8. **Reject debates/_index.json.**
