---
member: opencode3
model: opencode-go/qwen3.6-plus
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## DEBATE ROUND 2 — opencode3/qwen3.6-plus

### (A) UNIFIED BROKER TAXONOMY

**Convention decision**: ACP protocol events use `slash/separated` names (matching the ACP spec's `session/update`, `session/prompt`). Internal choreographer events use `colon:namespace` names. This creates a visual boundary: slash = external protocol, colon = internal coordination. No consumer ever guesses which channel an event belongs to.

```markdown
### Broker pub/sub surfaces

Two surfaces. Never mix.

#### `broker.agents[name]` — ACP protocol connections

Per-agent ACP stdio session channels. One channel per agent name key.

**Event types** (ACP protocol frames, slash-separated):
- `session/update` — streaming progress (tool calls, text deltas, plan updates, permission requests)
- `session/close` — ACP session terminated
- `session/cancel` — session interrupt requested

**Adapter lifecycle events** (colon-separated, emitted by adapter wrapper, NOT by ACP protocol):
- `adapter:available` — ACP stdio spawn + initialize succeeded
- `adapter:degraded` — circuit-breaker half-open; availability probe in progress
- `adapter:failed` — circuit-breaker tripped; adapter unavailable

**Producers**: ACP stdio subprocesses (emit `session/*`), per-agent adapter wrappers in `core/agents/*.mjs` (emit `adapter:*`)

**Consumers**:
- Council phase machine (Ship 3) — reads `session/update` for Phase 1 openings, Phase 2 rebuttals
- Verifier Loop dispatcher (Ship 4) — reads `session/update` to capture Builder output
- `core/observability.mjs` — subscribes to all events on all channels for NDJSON logging

#### `broker.events` — internal EventEmitter (not ACP)

Choreography lifecycle and cross-agent coordination. Low-frequency, stable schema.

**Event types** (all colon-separated):
- `builder:stop` — Builder agent completed a turn; triggers Verifier Loop
- `verifier:dispatch` — fire to trigger a specific verifier by ID
- `verifier:report` — verifier emitted its structured report
- `lifecycle:transition` — SessionStart / SessionEnd; consumed for broker spawn/teardown
- `broker:dlq` — message deposited to dead-letter queue
- `broker:circuit-breaker:trip` — adapter circuit-breaker state change

**Producers**:
- `core/runtime/lifecycle.mjs` — `lifecycle:transition` (SessionStart, SessionEnd)
- `core/verifier/loop.mjs` — `verifier:dispatch`, `verifier:report`
- Builder stop hook (`plugin-claude/scripts/verifier-stop-hook.mjs`) — `builder:stop`
- `core/runtime/broker.mjs` internal — `broker:dlq`, `broker:circuit-breaker:trip`

**Consumers**:
- `core/observability.mjs` — subscribes to ALL event types on BOTH channels
- `core/verifier/loop.mjs` — `builder:stop`, `verifier:report`
- `core/runtime/lifecycle.mjs` — `lifecycle:transition`
- [Ship 4] verifier composer (`core/verifier/composer.mjs`) — `verifier:report`

**Boundary rule**: ACP protocol frames (`session/*`) stay on `broker.agents[name]`. Orchestration decisions and lifecycle facts (`*: *`) stay on `broker.events`. If a consumer needs both, it subscribes to both channels explicitly — no wildcard bridging.
```

**Provenance**:
- `session/update`, `session/close`, `session/cancel`: from ACP spec, adopted by all 4 proposals.
- `adapter:available/degraded/failed`: from opencode1 (kimi), most complete adapter lifecycle coverage.
- `builder:stop`: from opencode2 (gpt-5.5) naming; Claude and opencode3 used `builder_stop`. Colon convention wins for consistency.
- `verifier:dispatch`, `verifier:report`: from opencode1 and opencode3 (colon convention).
- `lifecycle:transition`: from opencode3, with SessionStart/SessionEnd subtypes from Claude.
- `broker:dlq`, `broker:circuit-breaker:trip`: from opencode1, with opencode2's simpler naming (`dlq_message` → `dlq`).
- Boundary rule: from opencode2, sharpened with "no wildcard bridging" (new).
- Producer/consumer file paths: synthesized from the plan's Ship 2-4 file lists. Claude's `orchestrator.mjs` and `router.mjs` do not exist in the plan — replaced with actual planned files (`lifecycle.mjs`, `verifier/loop.mjs`, `verifier-stop-hook.mjs`).

---

### (B) OPEN QUESTIONS

| # | Question | Decision | Reason |
|---|----------|----------|--------|
| 1 | Exact ratchet thresholds per metric (task success %, p95 latency ms, citation ratio %) | **DEFER TO IMPL** | Baseline does not exist yet. Ship 1 must instrument and collect one week of data before any threshold is meaningful. Recording "baseline-then-observe" in the plan text is sufficient. |
| 2 | Whether `/choreo:verify` manual trigger should accept `--agent=codex` for app-server schema enforcement under ACP-first | **DROP AS NON-ISSUE** | The plan already resolved schema strategy: ACP-first client-side uniform, no Codex auto-fallback. If `/choreo:verify` ever needs schema enforcement, it uses the same client-side parser as council positions. No special Codex path. |
| 3 | ACP permission handling default in non-interactive council/verifier contexts (auto-allow vs auto-deny) | **RESOLVE NOW** | Default to **auto-deny** in non-interactive contexts. Safer: a denied permission produces a structured error the Verifier Loop can act on; an auto-allowed permission that causes damage cannot be undone. Document this in `core/agents/acp-client.mjs` as a design decision, not a TODO. |

---

### (C) FINAL CRITIQUE

**One concern: producer/consumer file references in the taxonomy cite files that do not yet exist in the plan's file lists.**

Claude's proposal names `orchestrator.mjs` and `core/router.mjs` as producers/consumers. These files appear nowhere in the Ship 2-4 file lists. The plan has `core/runtime/broker.mjs`, `core/runtime/lifecycle.mjs`, `core/verifier/loop.mjs`, but no `orchestrator.mjs` or `router.mjs`. If the plan text adopts my unified taxonomy above, this is resolved — but the debate should explicitly note that any plan-text edit MUST use file names that appear in the Ship 2-4 "Files to create" tables. Inventing new file names in the broker section creates phantom dependencies.

**Second concern: `broker:dlq` and `broker:circuit-breaker:trip` are internal broker state events, not coordination events.**

These are emitted and consumed by the broker itself. Putting them on `broker.events` means observability sees them (correct), but no other consumer should subscribe to them. The taxonomy should mark them as `internal` — consumed by `broker.mjs` only, plus observability. Otherwise an implementer might wire the Verifier Loop to listen for circuit-breaker trips, which is the wrong abstraction layer.

---

### UPDATED POSITION

1. **Broker taxonomy**: Unified enumeration above. Slash names for ACP protocol, colon names for internal events. Two channels, explicit boundary rule, no wildcard bridging. File references match actual Ship 2-4 file lists.
2. **Open questions**: Q1 defer (no baseline), Q2 drop (schema strategy already resolved), Q3 resolve now (auto-deny in non-interactive).
3. **Angles 1-6**: Locked from Round 1. No re-litigation.
4. **Concerns**: Phantom file names in taxonomy (resolved by using plan file lists). Internal broker state events on public channel (resolved by marking them internal).
