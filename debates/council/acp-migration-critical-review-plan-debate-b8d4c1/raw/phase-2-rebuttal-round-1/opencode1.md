---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## Rebuttal — ACP Migration Critical-Review Plan

### Concessions (Unanimous Angles)

**I concede: Angle 2 — Claude package disambiguation.** `@agentclientprotocol/claude-agent-acp` at 0.32.0 (19 versions, published yesterday) is the unequivocal primary ACP stdio path. The npm probe settles it: the adapter wraps the SDK inside ACP stdio. They are not alternatives. The plan must list `@agentclientprotocol/claude-agent-acp` as the ACP spawn target and relegate `@anthropic-ai/claude-agent-sdk` to the fallback column only.

**I concede: Angle 3 — Gemini hard lock to Ship 5+.** Prior council decision, user lock, and constraint violation if Gemini leaks into Ship 1/2. The current plan text places Gemini in Ship 1 REGISTRY, `/choreo:gemini` command creation, and Ship 2 adapter table. All three must be excised. Unanimous, correct, non-negotiable.

**I concede: Angle 4 — ACP-first client-side uniform validation.** Bifurcated validation (Codex app-server `outputSchema` auto-fallback vs client-side for others) creates a maintenance surface that compounds with every schema evolution. The user's explicit choice of ACP-first uniformity binds the plan. No auto-fallback. No Codex-only exception.

**I concede: Angle 5 — Broker channel split is load-bearing.** The separation between ACP protocol surface (`broker.agents[name]`) and internal choreographer event surface (`broker.events`) is architecturally necessary today. Observability subscribes to both. No disagreement.

---

### Challenge Angle 1 — Blocker Semantics (Research Rewrite)

**I disagree with Claude's framing that the research rewrite is a "TRUE Ship 1 blocker."**

The Ship 1 coding scope is explicitly: "/choreo:codex single-agent dispatch fix (~20 LoC) · `core/observability.mjs` NDJSON · Phase 0 research with hard success metrics as gate." The 20 LoC fix routes existing subprocess paths. It does not instantiate ACP adapters. It does not read `acp-feasibility.md` for operational logic. The research doc's five contradictions (Codex = native app-server primary, OpenCode = HTTP API primary, Gemini = subprocess only, "No universal ACP protocol") are **operationally irrelevant** to `companion.mjs agent --name=codex`.

Claude's argument that "implementer reading both today gets contradictory ground truth" is true but **misattributes the risk window**. The risk is to Ship 2 adapter implementation, not Ship 1 routing. An implementer writing `core/agents/codex.mjs` in Ship 2 would be misled by stale research. An implementer wiring `runAgent()` to dispatch a single agent in Ship 1 is not.

However, the plan lists `docs/research/acp-feasibility.md` as a Ship 1 deliverable. That makes the rewrite a **Ship 1 exit criterion**, not a Ship 1 **start blocker**. The distinction matters: "blocker" implies coding cannot begin, which is false. "Exit criterion" means Ship 1 cannot be declared complete, which is true.

**I also sharpen opencode3's relabeling.** opencode3 says items 2–3 "block Ship 2 and Ship 1 correctness." This is half right. Item 2 (Claude pkg disambiguation) appears only in Ship 2's adapter strategy table. It has **zero impact** on Ship 1. Item 3 (Gemini re-lock) **does** affect Ship 1 because the current plan leaks Gemini into Ship 1 REGISTRY and commands. Item 3 is a Ship 1 plan-correctness fix; item 2 is not.

**My sharper position:**
- **Item 1 (research rewrite):** Ship 1 **exit criterion** / Ship 2 **start prerequisite**. Relabel from "(blocker)" to "(Ship 1 exit gate; blocks Ship 2 start)." Ship 1 coding begins immediately.
- **Item 2 (Claude pkg):** Ship 2 **start blocker only.** No Ship 1 impact.
- **Item 3 (Gemini re-lock):** Ship 1 **plan-correctness fix** AND Ship 2 **start blocker.** Must be edited before Ship 1 is marked complete.

---

### Challenge Angle 6 — Atomic vs Phased (10 Items)

All three debaters converge on atomic for the doc fixes. **I agree, and I sharpen the rationale from preference to necessity.**

The 10 items are **not an independent set** — they form a cyclic dependency graph, not a DAG:

- Item 1 rewrites research to say "ACP-first for all agents."
- Item 4 reframes OpenCode serve as fallback (not primary).
- Item 5 mandates client-side schema validation everywhere.
- Item 7 splits broker channels and names them.

If item 1 lands without item 4, the research says OpenCode is ACP-primary while the plan still frames `opencode serve` as first-class. If item 5 lands without item 1, the plan mandates client-side validation but the research still recommends Codex app-server `outputSchema`. If item 7 lands without item 1, the broker channel split lacks the ACP protocol context that justifies it.

**Phasing the 10 items is structurally impossible without temporary inconsistency.** Therefore: **atomic is mandatory, not preferred.** One documentation commit. One PR. One verified state.

I fully endorse opencode2's boundary: **docs atomic, implementation phased.** Ships 1–5 remain as scheduled. The atomic commit touches only `docs/plans/2026-05-05-acp-migration-plan.md` and `docs/research/acp-feasibility.md`. No code.

---

### Plan-Text Gap — Broker Channel Split

All three debaters correctly identify that item 7 names channels but does **not** enumerate concrete event types, producers, and consumers. **I agree this gap must be closed in the plan text itself.** The current revision draft says:

> "§Ship 2 broker.mjs line | Add 'Two pub/sub surfaces: broker.agents (ACP) + broker.events (internal)'"

**This one-line addition is insufficient.** The plan must include the following enumeration so that Ships 3 and 4 implementers know exactly what events to subscribe to and emit:

```markdown
Broker pub/sub surfaces:

1. `broker.agents[name]` — ACP protocol connections
   - **Event types**: `session/update` (streaming progress), `session/close`, `session/cancel`, `adapter:available`, `adapter:degraded`, `adapter:failed`
   - **Producers**: ACP stdio subprocesses (per agent), agent adapter wrappers (`core/agents/*.mjs`)
   - **Consumers**: broker session manager, observability NDJSON logger, council phase machine (Ship 3), verifier loop dispatcher (Ship 4)

2. `broker.events` — internal EventEmitter
   - **Event types**: `builder_stop`, `verifier:dispatch`, `verifier:report`, `lifecycle:session_start`, `lifecycle:session_end`, `broker:dlq_message`, `broker:circuit_breaker_trip`
   - **Producers**: session lifecycle hooks (`core/runtime/lifecycle.mjs`), verifier loop (`core/verifier/loop.mjs`), builder stop hook (`plugin-claude/scripts/verifier-stop-hook.mjs`), broker internal (DLQ, circuit-breaker state changes)
   - **Consumers**: observability NDJSON logger (`core/observability.mjs`), verifier composer (`core/verifier/composer.mjs`), lifecycle handlers (`core/runtime/lifecycle.mjs`)
```

This enumeration is load-bearing because:
- Ship 3 council port must know it reads agent outputs from `broker.agents[name]`, not `broker.events`.
- Ship 4 verifier loop must know it registers as `verifier:{id}` consumers on `broker.events` and that `builder_stop` is the trigger event.
- Ship 2 observability must know it must subscribe to **both** surfaces to capture full telemetry.
- Without explicit event names, implementers will invent ad-hoc conventions that fragment the broker contract across ships.

**The revision plan's edit table must be updated to replace the one-line channel name with the above enumeration.**

---

### Updated Position

- **Angles 2, 3, 4, 5:** Conceded as unanimous and correct. No deviation.
- **Angle 1 (blocker semantics):** Research rewrite is a **Ship 1 exit criterion** and **Ship 2 prerequisite**, not a Ship 1 start blocker. Relabel item 1 accordingly. Item 2 (Claude pkg) is Ship 2–only. Item 3 (Gemini re-lock) is Ship 1 plan-correctness + Ship 2 blocker.
- **Angle 6 (atomic vs phased):** The 10 items are **mandatorily atomic** as a single documentation commit because they form a cyclic dependency graph of mutual cross-references. Phasing would guarantee temporary inconsistency. Implementation ships (1–5) remain phased as planned.
- **Broker gap:** The plan edit must enumerate concrete event types, producers, and consumers for both `broker.agents` and `broker.events` as specified above. The one-line channel name in the current revision draft is insufficient and must be expanded before the plan is approved.
