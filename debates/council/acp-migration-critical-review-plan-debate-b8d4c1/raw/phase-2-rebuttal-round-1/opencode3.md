---
member: opencode3
model: opencode-go/qwen3.6-plus
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## opencode3/qwen3.6-plus — Rebuttal Round 1

### Concessions (where others are right)

**I concede: Angle 2 (Claude package).** All four agree `@agentclientprotocol/claude-agent-acp` is primary ACP stdio; SDK is fallback. My opening said "one contains the other" — imprecise. The ACP adapter wraps the CLI binary; the SDK is a separate programmatic API. Corrected: adapter = primary, SDK = alternate native fallback.

**I concede: Angle 3 (Gemini).** Unanimous: Gemini excised from Ship 1/2. My opening already agreed. No change.

**I concede: Angle 4 (Schema).** Unanimous ACP-first client-side, no Codex auto-fallback. No change.

**I concede: Angle 5 (Broker split).** Unanimous: keep split, name producers/consumers. My opening already agreed. I sharpen the concrete text below.

---

### CHALLENGE ANGLE 1 — Research rewrite IS a Ship 1 blocker

opencode1 says "Ship 1 uses existing subprocess path, ~20 LoC, doesn't need research rewrite." This is technically true for the *code* but misses the implementer reality.

The feasibility doc at `docs/research/acp-feasibility.md` says:
- Line 19: "No universal ACP protocol"
- Line 14: Claude = "SDK (`@anthropic-ai/claude-agent-sdk`)"
- Line 15: Codex = "Native `app-server` JSON-RPC via broker"
- Line 16: OpenCode = "HTTP API via `opencode serve`"
- Line 17: Gemini = "Subprocess Only"

The plan says:
- ACP stdio is primary for ALL agents
- `@agentclientprotocol/claude-agent-acp` for Claude
- `@agentclientprotocol/sdk` as the broker's ACP client library

These are **directly contradictory**. An implementer reading both docs today gets two different architectures. That is not "research project" — it is a correctness hazard.

**Updated position:** The research rewrite is a **Ship 1 documentation exit blocker**, not a Ship 1 code blocker. Ship 1 code (~20 LoC) can start immediately. But Ship 1 cannot be declared *done* until the research doc is rewritten, because Ship 2 implementers will read it as ground truth. If we phase it, the gap between "Ship 1 code done" and "research doc rewritten" is when implementers get poisoned by stale facts.

**This means: atomic bundle of all 10 items before Ship 2 starts, but Ship 1 code work can begin in parallel.** The plan edit + research rewrite must land before anyone writes adapter code.

---

### CHALLENGE ANGLE 6 — Atomic vs Phased

opencode1 says phase the 10 items by urgency. opencode2 says atomic doc revision before Ship 2 coding. Claude says atomic bundled.

**I agree with opencode2 and Claude.** Here's why phasing fails:

The 10 items are not independent. Item 1 (research rewrite) changes the architectural ground truth. Item 2 (Claude pkg) changes the adapter strategy table. Item 3 (Gemini re-lock) changes Ship 1 scope. Item 7 (broker split) changes the broker design. If you apply items 3/9/10 now and defer 1/2/7, the plan is in a *partially inconsistent state* — Gemini removed from Ship 1 but the research doc still says "Gemini = Subprocess Only" as if it's in scope, the Claude row still says SDK, the broker still unnamed.

**Phased doc edits = plan that contradicts itself during the gap.** The "later" pass never happens cleanly because implementers start reading the half-edited plan as authoritative.

**Updated position:** All 10 items land in one commit to the plan + research docs. This is a *documentation* atomic operation, not an implementation one. Ship 1 code can start in parallel. Ship 2 coding waits for the atomic doc commit.

---

### PLAN-TEXT GAP — Broker channel split concrete enumeration

All 4 agree the broker split is load-bearing. The plan item 7 says "broker.agents (ACP) + broker.events (internal)" but does not enumerate **what flows on each channel**. Here is the exact text the plan edit must include:

**Replace plan §Ship 2 broker.mjs line with:**

```
core/runtime/broker.mjs — the daemon. Two pub/sub surfaces:

broker.agents[name] — ACP client connections.
  Producer: Each per-agent adapter (claude.mjs, codex.mjs, opencode.mjs, gemini.mjs)
  Events: ACP session/update notifications (tool calls, progress, permission requests, stop reasons)
  Consumers: council phase machine (Phase 1 openings, Phase 2 rebuttals), Verifier Loop (builder output capture), observability NDJSON

broker.events — internal EventEmitter (not ACP).
  Producer: core/runtime/lifecycle.mjs (session start/end), core/verifier/loop.mjs (verifier dispatch/report), core/companion.mjs (builder_stop detection)
  Events:
    - builder_stop — fired when Builder agent completes a turn; consumed by Verifier Loop dispatcher
    - verifier_dispatch — fired to trigger a specific verifier; consumed by core/verifier/loop.mjs
    - verifier_report — fired when a verifier emits its structured report; consumed by Verifier Loop composer + observability NDJSON
    - lifecycle_transition (SessionStart, SessionEnd) — consumed by core/runtime/lifecycle.mjs for broker spawn/teardown + observability NDJSON
  Consumers: core/observability.mjs (subscribes to all events for NDJSON logging), core/verifier/loop.mjs (builder_stop + verifier_report), core/runtime/lifecycle.mjs (lifecycle_transition)
```

This closes the gap. Every event has a named producer and consumer. No ambiguity about what is ACP vs in-process.

---

### Remaining sharpened disagreements

**vs opencode1 on blocker semantics:** opencode1 says research rewrite "NOT a Ship 1 blocker." I say it IS a Ship 1 *exit* blocker and Ship 2 *start* blocker. The distinction matters: if we call it "not a blocker," the implementer ships Ship 1 code, marks Ship 1 done, and the stale research doc persists into Ship 2 start. That is the exact failure mode phasing creates.

**vs opencode1 on Gemini framing:** opencode1 says "leak-back = bug fix, not constraint violation." Semantics. The result is the same: Gemini excised from Ship 1/2. I don't fight this label.

**vs all on broker justification:** opencode1 says "justify via TODAY's observability needs NOT Verifier Loop anticipation." I partially agree — the broker split IS load-bearing today for observability. But the *specific event types* (builder_stop, verifier_dispatch, verifier_report) are Ship 4 concerns. The plan should name them now because the channel design must accommodate them, not because we're pre-building Ship 4.

---

### UPDATED POSITION

1. **Blockers:** Research rewrite = Ship 1 exit / Ship 2 start blocker (not Ship 1 code blocker). Claude pkg disambiguation = Ship 2 blocker. Gemini re-lock = Ship 1 exit blocker. All 3 must land before Ship 2 coding begins.

2. **Package:** `@agentclientprotocol/claude-agent-acp` primary ACP stdio. `@anthropic-ai/claude-agent-sdk` = alternate native fallback.

3. **Gemini:** Hard excision from Ship 1/2. Ship 5+ only.

4. **Schema:** ACP-first uniform client-side validation. No Codex auto-fallback.

5. **Broker split:** Keep both channels. Plan must enumerate concrete event types, producers, consumers as specified above. Justification: observability needs today + channel design must accommodate Ship 4 events without retrofit.

6. **Atomic revision:** All 10 items land in one documentation commit before Ship 2 coding. Ship 1 code (~20 LoC) can start in parallel. No phased doc edits.

7. **Won't do:** Defer Gemini excision. Hybrid schema. Phase 10 items. Treat research rewrite as open-ended research project.
