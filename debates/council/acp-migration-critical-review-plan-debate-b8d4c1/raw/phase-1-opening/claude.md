---
member: claude
model: session-default (Agent general-purpose, Opus 4.7)
phase: phase-1-opening
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## YOUR RECOMMENDED APPROACH

**Angle 1 — Blocker classification: all three blockers are real, none defer.**

Research rewrite is a true blocker. The feasibility doc contradicts the plan in five concrete places — "No universal ACP protocol," Codex listed as primary, Gemini not locked. Any Ship 2 implementer reading both docs today gets contradictory ground truth. That is not a documentation debt problem; it is a correctness problem that will cause wrong implementation decisions. Claude disambiguation is a true blocker: the plan simultaneously lists `@anthropic-ai/claude-agent-sdk` and "Zed adapter" as ACP stdio candidates in Ship 2's adapter table. A developer picking up Ship 2 today cannot know which package to install without external research. That ambiguity in a plan document is a Ship 2 start blocker by definition. Gemini re-lock is a true blocker because the current plan text actively violates the hard user constraint — Ship 1 REGISTRY entry and Ship 2 adapter table both contain Gemini. Leaving that in place means Ship 1 implementation would produce Gemini-capable code, which is the constraint violation itself, not just documentation drift. All three resolve cheaply (doc edits, not code), so the argument for deferring them has no weight.

**Angle 2 — `@agentclientprotocol/claude-agent-acp` wins. No contest.**

`@anthropic-ai/claude-agent-sdk` does not speak ACP. It is a programmatic SDK that bundles the Claude CLI binary and exposes a generator-based JS API over native message types. Using it as the ACP path would require building a custom ACP shim on top — which is exactly what `@agentclientprotocol/claude-agent-acp` already is, maintained by the ACP org, confirmed on npm per Phase 0.5 preflight. The preflight also confirmed this package is maintained and was formerly `@zed-industries/claude-code-acp` — continuity of maintenance is established. `@anthropic-ai/claude-agent-sdk` is the correct native fallback: it gives programmatic access without ACP overhead when ACP probe fails. The plan must say this explicitly: ACP path = `@agentclientprotocol/claude-agent-acp`; native fallback A = `@anthropic-ai/claude-agent-sdk`; native fallback B = CLI subprocess. No ambiguity.

On session resume: the feasibility doc credits `@anthropic-ai/claude-agent-sdk` with thread resume via `threadId`. ACP's session resume story is less documented. This is a real gap — but it is an implementation risk to flag in the research doc, not a reason to flip the primary path. ACP uniformity across all agents is the strategic bet; losing session resume on Claude ACP is acceptable friction until the adapter layer matures.

**Angle 3 — Gemini leak is a constraint violation. Fix it now.**

The user constraint is hard. The debate instruction says "the lock is HARD per user — debate whether plan's current leak-back into Ship 1/2 is a de-facto bug fix or a de-facto constraint violation." It is a constraint violation, full stop. The argument for treating it as a bug fix would require showing that Gemini's native ACP stdio support is verified and that including it in Ship 1/2 shortens total delivery. Neither condition holds: Gemini native ACP stdio is explicitly unverified per the Phase 0.5 preflight ("not directly verified; distinguish from --acp (Google A2A)"), and the user's stated reason for the lock is preventing scope expansion before claude/codex/opencode paths are proven and metrics-gated. Including Gemini in Ship 1/2 adds scope before that gate. Remove it.

**Angle 4 — ACP-first client-side validation wins. Uniformity over native schema enforcement.**

The Codex app-server `outputSchema` provides server-side schema enforcement — genuinely superior for correctness. But the council architecture already handles this asymmetry today for Gemini (prompt + parse + flag on failure per Evolution B). Adding a Codex-special-path that switches to app-server for schema enforcement introduces a fork in the validation pipeline: every future schema change must be applied to both the ACP client-side parser and the Codex app-server schema definition. That maintenance surface compounds. The correct call is uniform client-side validation via `parseStructuredOutput(raw, schema)` for all agents, parse failures flagged in report, never crash. The plan already states this. Keep it. The reliability gain from Codex app-server schema enforcement does not outweigh the maintenance cost of a bifurcated validation path.

**Angle 5 — Broker channel split is justified. But the plan must name the concrete producers/consumers.**

The split is correct and load-bearing today, not premature. The user clarification is explicit: lifecycle transitions and NDJSON observability need the internal channel from Ship 1/2 onward. What the plan's current framing fails to do is name the concrete producers and consumers for each channel. `broker.agents[name]` carries ACP `session/update` events from each agent adapter. `broker.events` carries `builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_transition` — all internal, not ACP, consumed by the NDJSON observability emitter in `core/observability.mjs` and (in Ship 4) by the verifier dispatcher. The plan must state this explicitly. "Split broker channels" as a bare item in the plan is insufficient — an implementer needs to know which events go on which channel and who reads them. The critical-review plan's item 7 names the channels but does not enumerate the concrete event types or consumers. That gap must be closed in the plan edit, not left as a comment.

**Angle 6 — Bundled atomic revision. Ship all 10 items in one pass.**

The 10 items divide cleanly into: 3 blockers (must resolve before Ship 1/2 start), 5 design items (plan edits that make Ship 2 implementable without ambiguity), 2 minors (dead references, cleanup scheduling). All 10 are documentation edits. None require code changes. The cost of a phased approach — ship 3 blockers now, revisit 7 later — is that the plan remains partially inconsistent during the gap, and the "later" pass never happens cleanly because Ship 1 implementation begins in the meantime and the plan text gets treated as authoritative. Atomic revision eliminates that risk. One commit, one verified state, Ship 1/2 implementation begins from a clean baseline.

---

## TOP 3 REASONS WHY

**1. The feasibility doc is the ground truth anchor for Ship 2 implementation.** If it contradicts the plan in five places and is not rewritten before Ship 2 coding begins, the implementer has two authoritative but inconsistent documents. The research rewrite blocker is not bureaucratic — it prevents implementation from diverging on package choice, transport assumptions, and the ACP-first vs. native-first framing from day one.

**2. Package disambiguation is a Ship 2 blocker because it determines the install command.** The adapter table in Ship 2 currently has two Claude ACP entries pointing at different things. The implementer cannot write `acp-client.mjs` without knowing whether to `npm install @agentclientprotocol/claude-agent-acp` or `@anthropic-ai/claude-agent-sdk`. This is not a detail to resolve during implementation — it is a prerequisite to starting it.

**3. The uniformity argument for ACP-first client-side validation is a maintenance argument, not a purity argument.** The bifurcated validation path (ACP client-side for three agents, app-server schema for Codex) means every schema evolution — council position, verifier report, adversarial review — requires two synchronized changes. The council architecture will evolve these schemas. Single-path validation via `parseStructuredOutput` is strictly cheaper to maintain at the cost of losing one agent's server-side enforcement. That trade is correct given the project's trajectory.

---

## KEY RISKS I ACCEPT

**`@agentclientprotocol/claude-agent-acp` maintenance risk is real.** This package transferred org once (Zed → ACP org) and is confirmed maintained, but it is not an Anthropic first-party package. If Anthropic ships breaking CLI changes, the ACP adapter may lag. The native fallback (`@anthropic-ai/claude-agent-sdk`) mitigates this — but only if the adapter layer is written with the fallback path exercised from Ship 2, not added later.

**Session resume gap on Claude ACP is unresolved.** The feasibility doc credits `@anthropic-ai/claude-agent-sdk` with `threadId`-based thread resume. Whether `@agentclientprotocol/claude-agent-acp` supports equivalent session continuity is not documented in the research. This is a Ship 2 implementation risk that the rewritten feasibility doc must call out explicitly rather than paper over.

**Atomic revision creates a single large plan edit commit.** If that commit introduces an error in the plan text, it touches both the research doc and the plan simultaneously. The verification checklist in the critical-review plan (8 grep checks) is the mitigation — it must be executed, not skipped.

---

## WHAT I WOULD EXPLICITLY NOT DO

**Not defer the Gemini re-lock.** The argument "Gemini native ACP stdio might be cheap to add in Ship 2" is speculative against a hard constraint. The constraint exists precisely because the user does not want to evaluate that speculation until claude/codex/opencode paths are proven. Debating the lock's wisdom is out of scope; enforcing it in the plan is not.

**Not use `@anthropic-ai/claude-agent-sdk` as the ACP primary path.** It does not speak ACP. Retrofitting it into an ACP path means writing the adapter the `@agentclientprotocol/claude-agent-acp` package already provides. That is redundant work against a maintained solution.

**Not add Codex app-server `outputSchema` as a parallel validation path.** The maintenance cost of a bifurcated schema enforcement pipeline outweighs the correctness gain. One parser, one schema format, all agents.

**Not split the 10 items into phases.** The items are all doc edits. Phasing them leaves the plan inconsistent during Ship 1 implementation. The atomic pass is the correct call.

**Not leave broker channel split as a bare architectural note without naming event types and consumers.** "Split broker channels" in the plan text without enumerating what goes on each channel is an incomplete design decision. The plan edit must name `builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_transition` as `broker.events` producers, and name `core/observability.mjs` as the primary consumer. Otherwise the split is named but not implemented.
