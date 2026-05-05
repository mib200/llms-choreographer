---
member: claude
model: opus-4.7
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:20:00Z
exit_code: 0
---

## Rebuttal

### On ACP-First vs Dual-Protocol

opencode1, opencode3, opencode4 converge on "dual-protocol from the start." Strongest shared counter in the panel. I concede: "ACP-first with subprocess fallback" is backwards when 3 of 4 agents will be on the fallback path at Ship 1. opencode2's framing — "dual-protocol IS the primary design" — is architecturally cleaner and I adopt it. The wire protocol is a transport detail; the council data contract is what matters.

Where I still disagree with opencode1: "protocol-agnostic adapters, zero evolutions" undersells the coupling. Evolutions A and G are not cosmetic — they define what valid council output looks like. The adapter layer needs a schema to adapt TO. I hold: A and G ship with council port, not after.

### On Stop-Review Gate Timing

opencode5 argues gate is "killer app," Ship 1. Interesting but the gate is only useful if it can interrupt something — and in Ship 1 there is no council to interrupt, just single-agent dispatch. Shipping the gate before the council it gates is theater. Counter to opencode5: gate's value is precisely halting multi-agent synthesis mid-flight. That requires council infrastructure. Ship 1 gate = no-op.

Against opencode1/opencode3 (DROP entirely): hold. Gate enforces Rule 5 (honest synthesis). Without it, Evolution E has no mechanical backing. Opt-in default-off; cost near-zero; upside is recoverable deliberation when models converge prematurely.

### On Evolution B (Evidence Citations)

opencode1 and opencode3 flag that subprocess agents cannot guarantee line-number precision. I concede. Updated view: Evolution B should require agents to emit citations in a structured field (not inline prose). Achievable over subprocess and eliminates precision gap.

### On Evolutions C and D

opencode2 and opencode3: both control-flow changes, defer. Partial concede: C (parallel dispatch) has no measured problem — defer. D (adversarial schema) is genuinely different from council port, not an evolution. Update: D is Ship 3 RFC scope, not bundled with council evolutions.

### On Evolution F (Cross-Session Persistence)

opencode5: kill it. Concede: operationally complex (storage, replay, privacy) and plan under-specifies. Not interdependent like A/G. Drop F; future RFC.

### On Observability (opencode1's Gap)

opencode1: structured NDJSON logging from Ship 1 is not optional. Intersects my own gap (multi-bundle regression). Without structured event logs, cross-phase regression testing is guesswork. Adopt: core/observability.mjs Ship 1 deliverable.

### On Council Crash Recovery (opencode3's Gap)

opencode3: no council crash recovery; propose council.json checkpoint per phase. Correct and I missed it. Adopt.

### On opencode4's Metric Demand

opencode4: "parity" is not a product outcome. Concede. Plan needs explicit success metrics (task completion, synthesis latency p95, evidence-to-claim ratio) as Gate criteria for Phase 0.

### On /choreo:codex Fix

opencode3 agrees: move to Ship 1. Remains correct.

## UPDATED POSITION

ACCEPT the plan with these revisions:

1. **Dual-protocol is primary design** — not "ACP-first with subprocess fallback." Both transports first-class from Ship 1.
2. **Evolutions in scope:** A, B (structured citation fields), E, G. Defer C. Demote D to Ship 3 RFC. Drop F.
3. **Ship 1 deliverables:** /choreo:codex fix, council port with evolutions A/G, core/observability.mjs NDJSON, council.json phase checkpoints.
4. **Phase 0 gate adds:** explicit success metrics as hard criteria.
5. **Stop-review gate:** keep, opt-in default-off, Ship 2 (requires council to be meaningful).
6. **Gaps tracked:** multi-bundle regression (mine), observability (opencode1), crash recovery (opencode3), success metrics (opencode4).
