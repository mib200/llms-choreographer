---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:20:00Z
exit_code: 0
---

I concede to **opencode5**: the stop-review gate is not dead weight — it is the highest-value user-facing feature on the table. I was wrong to advocate dropping it. However, I maintain it must be implemented via direct Codex subprocess integration, not broker-mediated ACP.

I concede to **opencode3**: `acp-client.mjs` is premature abstraction. Building ACP-client before any ACP-server exists is putting the cart before the horse.

I concede to **opencode4**: "parity" is not a product outcome. Task success rate, latency, user selection rate must be the governing metrics.

I reject **claude-anon's** claim that subprocess parity is a "ceiling" and that evolutions A-G are interdependent. Structured output is an adapter-layer concern, not a wire-protocol concern. An adapter can enforce JSON schemas over stdout as rigorously as over ACP.

I reject **opencode2's** council-before-broker ordering. Council is a multi-agent coordination pattern. Without an adapter/broker layer, council.mjs must embed agent-specific spawn logic.

I reject **opencode3's** Ship 3 verbatim council as too late. Waiting until Ship 3 for any council functionality means two ships of infrastructure with zero user feedback. Council should be Ship 5, but only after broker telemetry proves users want multi-agent debate.

I reject **opencode4's** Ship 3 adapter interface as premature. Extract adapters from working direct integrations (Ships 1-2), not invent them in a vacuum.

I reject **opencode5's** "Protocol-First Bridge" as rebranded broker. Managing connection lifecycle, retry, cancellation across direct bridges IS what a broker does.

## UPDATED POSITION

**Conceded:** Include stop-review gate in Ship 2 (direct Codex subprocess, not broker-mediated); defer ACP abstraction until a native ACP speaker is proven; success metrics govern ship criteria.

**Held:** Zero evolutions in initial council; broker LAST, not first; Ship 1 = /choreo:codex fix plus NDJSON observability; dual-protocol awareness is primary architecture, not ACP-first fallback.

**Revised ordering:**
- Ship 1: Codex fix + structured logging
- Ship 2: stop-review gate via direct subprocess
- Ship 3: extract adapter interface from proven integrations
- Ship 4: broker if telemetry shows multi-agent contention
- Ship 5: verbatim council; evolutions A-G only when usage justifies complexity
