---
member: opencode2
model: opencode-go/qwen3.6-plus
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

## Position: ACP-First with Dual-Protocol Broker, Council Port at Full Evolutions, Ship Council Before Broker

### Decision 1: ACP-First Broker (Path B) — YES, but with dual-protocol for Codex

**Recommendation:** Path B (ACP-first broker across all agents) with a **dual-protocol Codex shim** as a first-class transport, not a fallback. The broker speaks ACP to Claude/OpenCode/Gemini and native app-server JSON-RPC to Codex. The adapter interface hides the difference.

**Why:**
1. app-server-broker.mjs:68 shows the external plugin already connects to codex app-server directly — it's not ACP-shaped. Forcing a shim that translates ACP↔app-server is building a protocol translator that will break on every Codex update.
2. The AgentAdapter interface already abstracts transport. Dual-protocol is one more adapter implementation detail.
3. Cross-agent parity is the stated goal. Parity means "same capabilities," not "same wire format."

**Risk accepted:** The broker is more complex (two protocol handlers). But complexity lives in core/runtime/broker.mjs and core/agents/codex.mjs only.

### Decision 2: Codex ACP Shim — REJECT primary, ACCEPT thin native adapter

Do NOT write a general-purpose ACP↔app-server translator. Codex adapter speaks native app-server JSON-RPC directly. Plan line 284 calls this a "fallback" — it's the correct design from day one.

### Decision 3: opencode serve mandate — YES, fail loud

Endorse without reservation. Council degrades gracefully (skips opencode, continues with quorum).

### Decision 4: Pi.dev deferral — YES

No debate.

### Decision 5: Option 1+ Council Port — YES, with one modification

Port full protocol plus all evolutions, but **reorder evolution implementation**:

- **Ship 3 (A+B+E+F+G):** Structured JSON positions, evidence citations, minority preservation, cross-session memory, structured synthesis JSON — these are prompt-level/artifact-level changes, not control-flow.
- **Defer C+D to Ship 4:** Adaptive rounds and adversarial round injection change the state machine. Get the base 6-phase protocol stable first.

**Why:** Current companion.mjs:47-84 is a 1-round Promise.all. Target is a 6-phase state machine with user re-entry, convergence checks, durable artifacts. 10x complexity jump. Evolutions A/B/E/F/G are "data shape" changes — don't affect debate flow. C/D change control flow — need base stable first.

### Decision 6: Ship Ordering — REORDER

**My:** Ship 1 (adapters) → **Ship 2 (council port)** → Ship 3 (broker) → Ship 4 (adversarial + single-agent) → Ship 5 (safety).

**Why:** Council delivers user-visible value and exercises the adapter interface immediately. Broker is infrastructure — valuable but invisible. Council's 3-5 round debate doesn't need persistent connections; each round is a discrete invocation.

### Decision 7: Stop-Review Gate — INCLUDE but mark as experimental

Port it. Default off. Mark as experimental in docs. Cost is low: one hook script + one prompt template + one state.json toggle. 15-min timeout is only operational concern and plan accounts for it.

**Would not:** Gate any ship on the stop-review gate. It ships when it ships.

### Decision 8: Fundamental Gap — Broker Crash Recovery Under-Specified

Plan says "broker state persists in state.json + jobs/; on restart, read and restore" but doesn't specify:
1. How broker detects orphaned connections after crash (activeRequestSocket/activeStreamSocket are in-memory, lost on crash).
2. How council resumes mid-debate. Replay requires re-invoking agents with same context — long-lived sessions are dead on crash.

**Recommendation:** Add Phase 3.5: broker crash recovery spec. Document recoverable (completed phases, durable artifacts) vs must-re-run (in-flight invocations, active streams). Council phase machine handles "phase N partially complete" by re-running phase N from scratch.

---

## Summary

| Decision | Position |
|----------|----------|
| ACP-first broker | YES, dual-protocol (ACP + native app-server) |
| Codex ACP shim | NO — native adapter, not translator |
| opencode serve mandate | YES, fail loud |
| Pi.dev deferral | YES |
| Option 1+ council port | YES, but defer adaptive rounds + adversarial round to Ship 4 |
| Ship ordering | Council before broker |
| Stop-review gate | Include, experimental, default off |
| Gap found | Broker crash recovery under-specified |
