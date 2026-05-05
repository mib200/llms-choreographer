---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-1-opening
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

**MY RECOMMENDED APPROACH**

1. **Blockers: research rewrite is NOT a Ship 1 blocker.** Ship 1 uses the existing subprocess path (`runAgent` + `parseClaudeStreamJson`). It needs ~20 LoC for the single-agent fix + observability wiring. The research rewrite is Ship 2 pre-work. **Claude package disambiguation IS a Ship 2 blocker** — you cannot write `core/agents/claude.mjs` without knowing whether it spawns an ACP stdio server or imports a native SDK. **Gemini re-lock IS a Ship 1 blocker** — the current plan violates the user's hard constraint by including Gemini in Ship 1 REGISTRY and `/choreo:gemini`. Remove it now; it's a 5-line surgical edit.

2. **`@agentclientprotocol/claude-agent-acp` wins unequivocally.** The `@anthropic-ai/claude-agent-sdk` is a native programmatic API — it does NOT speak ACP stdio. Calling it an "ACP adapter" is a category error. The ACP-first mandate requires ACP stdio transport. The SDK belongs in the fallback column alongside CLI subprocess, not as the primary path.

3. **Gemini Ship 5+ re-lock is correct; leak-back is a bug fix, not constraint violation.** The user's lock reason is empirical: "avoid scope-expand until claude/codex/opencode ACP paths proven and metrics-gated." The plan currently has Gemini in Ship 1 commands and Ship 2 adapter table — that is a de-facto constraint violation. Removing it is fixing a bug, not re-litigating the lock.

4. **ACP-first client-side validation wins over Codex native schema enforcement.** The primary directive from council + user is "cross-agent parity over shipping Codex value fast." If Codex gets native `outputSchema` enforcement while Claude/OpenCode/Gemini get client-side parsing, you create a two-tier reliability system. Council positions and verifier reports must behave identically regardless of which agent generated them. Uniformity outweighs the reliability gap.

5. **Broker channel split is real separation of concerns today, but the plan's rationale is insufficiently concrete.** The user clarified: lifecycle transitions + NDJSON observability need the internal channel from Ship 1/2 onward. The critical-review plan names `broker.agents` vs `broker.events` but fails to explicitly map **producers and consumers** for each. I would add: `lifecycle.mjs` publishes `SessionStart`/`SessionEnd` to `broker.events`; `observability.mjs` subscribes to BOTH channels; `verifier loop` (Ship 4) consumes from `broker.events`. Justify via today's observability needs, not Verifier Loop anticipation.

6. **Phased disambiguation, NOT bundled atomic revision.** The 10 items have different urgencies and block different ships. Items 3/9/10 are 5-minute text edits. Item 2 is a Ship 2 design decision. Item 1 is Ship 2 pre-work. Bundling them into one atomic "plan pass" means Ship 1 waits for a research rewrite it does not need.

---

**TOP 3 REASONS WHY**

1. **Ship 1's mandate is velocity, not completeness.** The single-agent fix is explicitly "~20 LoC" to close a deferred routing bug. Adding a full research rewrite to Ship 1 exit criteria contradicts that goal. The existing subprocess path is proven and tested; Ship 1 should ship it, not wait for ACP research that Ship 2 adapters actually need.

2. **Cross-agent parity is the user's highest-priority directive.** This is why ACP-first transport and uniform client-side schema validation are non-negotiable, even when native alternatives are "better" for one agent. A two-tier system where Codex outputs are structurally more reliable than Claude's destroys the council's deliberative equality.

3. **The Gemini lock exists for empirical gating, not sentiment.** "Prove claude/codex/opencode ACP paths first, then metrics-gate Gemini inclusion." Violating this to keep Gemini in an adapter table undermines the entire telemetry strategy. If you can't resist scope creep on a four-row table, you won't resist it when Ship 3 council integration gets hairy.

---

**KEY RISKS I ACCEPT**

1. **Client-side schema parsing will be less reliable than Codex native `outputSchema`.** We'll see more parse failures, need tighter `parseStructuredOutput` heuristics, and may need to relax schema strictness for council positions. I accept this cost for uniformity.

2. **Deferring the research rewrite risks Ship 2 starting with stale assumptions.** The current `acp-feasibility.md` has five factual errors. If Ship 2 pre-work doesn't happen promptly, an engineer might read the stale doc and design against it. Mitigation: add a prominent header comment in the stale doc: "SUPERSEDED — see Ship 2 pre-work for ACP-first revision."

3. **Phased disambiguation means temporary inconsistency between plan and research.** For a window of time, the repo plan says ACP-first while the research doc says "No universal ACP protocol." I accept this transient inconsistency over blocking Ship 1.

---

**WHAT I WOULD EXPLICITLY NOT DO — AND WHY**

1. **NOT bundle all 10 items into one atomic plan pass.** False economy. Different items block different ships. Atomic bundling is a coordination tax that delays user-visible value.

2. **NOT auto-fallback to Codex app-server for schema enforcement.** This creates the exact two-tier reliability system that violates the primary directive. Codex would produce structurally guaranteed outputs while other agents produce best-effort parsed outputs. Council deliberation requires structural equality.

3. **NOT justify the broker channel split by citing the Ship 4 Verifier Loop.** The user explicitly instructed: "justify via observability needs, not Verifier Loop anticipation." I would refuse to write any plan text that uses "future verifier needs" as the rationale for `broker.events`. Today's concrete consumers — `observability.mjs` and `lifecycle.mjs` — are sufficient justification.
