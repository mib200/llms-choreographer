---
member: claude
model: session-default (Agent general-purpose, Opus 4.7)
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## Round 1 Rebuttal

### ANGLE 1: Research Rewrite as Blocker — Conceding with Precision

I concede: research rewrite is NOT a Ship 1 *implementation* blocker.

The concession is earned. Ship 1 is ~20 LoC subprocess routing — it uses the existing path. The feasibility doc contradictions (5 identified conflicts) do not touch that code path. opencode1, opencode2, and opencode3 are all correct that an implementer can start and finish Ship 1 without resolving the research doc.

**Updated label**: Item 1 = "Ship 1 exit / Ship 2 start gate" (adopting opencode3's precise framing). The research doc must be reconciled before Ship 2 begins because Ship 2 *is* the ACP implementation the doc describes. Writing Ship 2 code against a contradicted spec = implementation diverges from plan on day one.

This is not a minor relabeling. It unblocks Ship 1 immediately.

---

### ANGLE 6: Atomic vs Phased — Synthesis Position

I concede: opencode1's urgency-differentiation insight is partially valid. Items 3/9/10 are 5-minute text edits. Item 2 requires design decision. Bundling them as "one atomic gate" inflates the perceived cost and obscures which items are fast-path.

But opencode1's *conclusion* (phased disambiguation) is wrong. The problem with phasing doc fixes is state contamination: a plan that is half-corrected is more dangerous than one that is fully wrong, because implementers cannot tell which sections to trust. "Later" passes accumulate debt and in practice do not happen cleanly (the session log already shows one interrupted mid-call).

**Synthesis (adopting opencode2's framing exactly)**: Documentation disambiguation = atomic, applied before Ship 2 starts. Implementation = phased by ship. The atomic gate applies to *docs*, not to *code*. This resolves opencode1's real objection (Ship 1 should not wait) while preserving doc integrity.

Concretely: fix items 3/9/10 now (minutes), fix item 2 now (one decision), fix item 1 before Ship 2 kickoff. That IS phased in calendar time but ATOMIC in the sense that no Ship proceeds against a partially-corrected spec for that ship's scope.

---

### ANGLES 2, 3, 4, 5: Convergence Concessions

I concede openly:

- **Pkg (Angle 2)**: opencode3's npm probe confirms `@agentclientprotocol/claude-agent-acp@0.32.0` exists, wraps SDK, 19 versions, published. This is the install target. No ambiguity remains. Settled.

- **Gemini (Angle 3)**: I concede opencode2's framing is sharper: "any Gemini in Ship 1/2 = violation." My original position was correct but imprecisely argued as "leak-back." The correct frame: Gemini presence in REGISTRY/choreo:gemini/Ship 2 adapter table = Ship 1/2 scope violation, not merely doc drift.

- **Schema (Angle 4)**: Full convergence. ACP-first client-side uniform. No Codex auto-fallback. No bifurcated path.

- **Broker split (Angle 5)**: All four agree split is load-bearing. All four agree producers/consumers must be enumerated. See plan-text edit below.

---

### PLAN-TEXT EDIT: Item 7 (Broker Split Enumeration)

Recommended replacement for the current vague broker rationale:

```
## Broker Architecture

broker.agents (ACP session channel)
  Producers: orchestrator.mjs (session_init), each agent adapter (session_update)
  Consumers: core/router.mjs (routing decisions), observability.mjs (session telemetry)

broker.events (lifecycle/dispatch channel)
  Producers: orchestrator.mjs (builder_stop, lifecycle_transition),
             core/router.mjs (verifier_dispatch)
  Consumers: observability.mjs (all event types),
             [Ship 4] verifier-dispatcher.mjs (verifier_dispatch, verifier_report)

Separation rationale: session channel carries high-frequency per-agent ACP frames
(update payloads vary by agent). Event channel carries low-frequency typed lifecycle
signals with stable schema. Mixing = consumers must filter noise; splitting = each
consumer subscribes only to its channel with no filtering overhead.
Ship 4 verifier dispatcher wires to broker.events only — it never touches ACP sessions
directly. This is the load-bearing reason for separation today, not future anticipation.
```

---

### UPDATED POSITION (Round 1 Close)

1. **Item 1 blocker**: Relabeled. Ship 1 exit / Ship 2 start gate. NOT Ship 1 impl blocker. Ship 1 can start now.

2. **Items 2 + 3**: Remain true Ship 1/2 blockers as originally argued. No change.

3. **Pkg**: `@agentclientprotocol/claude-agent-acp` confirmed. Settled.

4. **Gemini**: Hard excision. Any presence in Ship 1/2 scope = constraint violation.

5. **Schema**: ACP-first uniform client-side. Settled.

6. **Broker split**: Load-bearing today. Plan must name producers/consumers explicitly (edit above).

7. **Atomic vs phased**: Docs = atomic gate per ship scope. Impl = phased by ship. This is the synthesis. No intermediate partially-corrected plan state.
