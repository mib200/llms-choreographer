---
member: claude
model: opus-4.7
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

## RECOMMENDED APPROACH

Adopt the ACP-first migration plan (Path B, Option 1+ council) with one mandatory deviation: **Phase 0 must complete and gate before any Phase 1 code is written.** Codex ACP feasibility is genuinely unknown (app-server thread/resume → ACP mappability unverified), and writing a generalized broker before that verdict is waste. Adopt the plan's phasing discipline as written — not as a formality, but as a hard gate.

The Option 1+ council evolutions (A-G) are correct to include wholesale. The current companion.mjs council (lines 45-84) is a 39-line flat Promise.all with no rebuttals, no synthesis, no structured output, no durable artifacts. Porting a half-council is worse than porting none — it would carry the illusion of deliberation without the substance.

## TOP 3 REASONS WHY

**1. The current council is architecturally broken in a way that makes partial fixes actively harmful.** companion.mjs:45-84 runs three agents with hardcoded roles and prints raw text. /choreo:codex also routes to this code (project-overview-pdr.md:108 marks it deferred). Every agent-named command secretly runs a 3-agent council. Fixing the routing without fixing the council produces worse behavior: a real single-agent path next to a fake council path. Fix both together.

**2. Cross-agent parity is only achievable through ACP — subprocess parity is a ceiling, not a destination.** Existing runAgent (runners.mjs:57-81) gives every agent stdout-as-text + 300s timeout. That's parity at the lowest common denominator. The adversarial review schema (review-output.schema.json) requires structured output that raw stdout cannot deliver. Evolutions B (JSON positions) and G (structured synthesis) require structured output from every member. ACP-first is not optional if structured parity is the goal.

**3. The external plugin already solved the hardest Codex transport problem — reusing it prevents rebuilding 1,500+ lines.** app-server-broker.mjs alone handles Unix socket creation, pid files, stream thread ID tracking (buildStreamThreadIds, lines 14-24), BUSY RPC error code routing, socket ownership. stop-review-gate-hook.mjs handles first-line ALLOW:/BLOCK: parse (lines 80-95), 15-min timeout, session-scoped job filtering. Writing these from scratch is strictly worse.

## KEY RISKS I ACCEPT

1. Ship 1 may take longer. ACP feasibility for Codex partially unknown — if Phase 0 shows thread/resume has no ACP equivalent, codex-shim.mjs becomes a nontrivial translation layer. Acceptable — adapter boundary isolates it.

2. OpenCode's fail-loud probe breaks users who haven't started opencode serve. Right call. Silent subprocess fallback re-introduces the inconsistency the migration exists to eliminate.

3. Option 1+ council is significant scope. A partial port produces a council that appears complete but isn't; users won't discover gaps until they need the missing behavior.

## WHAT I WOULD EXPLICITLY NOT DO

1. Not adopt the old docs/codex-appserver-migration-plan.md as fallback. Reverting there sacrifices cross-agent parity to protect Ship 1 timing.
2. Not ship council port (Ship 3) before adapter layer (Ship 1). Council calling adapters.invoke() without adapters means fallback to subprocess — kills Option 1+ structured output.
3. Not enable Stop-review gate by default. 15-minute blocking hook on every session end is a bad default.
4. Not include Pi.dev. No ACP analog, no structured output contract, drags design down to lowest common denominator.

## POSITIONS ON NUMBERED DECISIONS

**Decision 1 — ACP-first broker:** Path B. Cross-agent parity is the primary goal. Path A gives Codex preferential treatment. Incremental cost of Path B over A is writing two more adapters (claude.mjs, opencode.mjs) with well-understood transports. Low marginal cost for the primary goal.

**Decision 2 — Codex ACP shim:** Dual-protocol broker as Phase 0-gated primary, not fallback. The shim is the right first attempt — if Phase 0 confirms mappability, shim is thin and justified. If not, dual-protocol preserves parity on everything except wire format. Dropping ACP for Codex abandons outputSchema, thread/resume, background jobs, streaming — unacceptable.

**Decision 3 — opencode serve mandate:** Mandatory, fail-loud, no fallback. Silent degradation produces inconsistent structured output.

**Decision 4 — Pi.dev deferral:** Correct deferral.

**Decision 5 — Option 1+ council:** Wholesale Option 1+. Evolution A required for G; D reuses adversarial-review template being ported in Phase 5; F has near-zero implementation cost and addresses "debates are ephemeral" gap; G separates readable markdown from queryable decision artifact. Dropping B/D/F/G produces a council that does rebuttals/synthesis but cannot be consumed programmatically, has no adversarial challenge, forgets every debate.

**Decision 6 — Ship ordering:** Plan's order is correct with ONE exception: Ship 4's single-agent dispatch fix moves to Ship 1. The bug is explicitly documented at project-overview-pdr.md:108 — every agent-named command routes to council. Fix is 2 lines. Leaving it for Ship 4 means three ships of incorrect behavior in production.

**Decision 7 — Stop-review gate:** Yes, as implemented in external plugin — off by default, workspace-toggled. Surface area is minor (185 lines). Default-off protects users.

**Decision 8 — Fundamental gap:** The plan has no multi-bundle regression testing strategy. companion.mjs is bundled into three outputs (plugin-claude/, plugin-codex/, plugin-opencode/). Every Phase 4 council change touches this file directly. The council rewrite is the highest-risk change; it will silently break Codex and OpenCode council invocations if bundle drift is not caught immediately. Per-phase verification must add `npm run check-bundles` + basic smoke test of council through each bundled path before marking Phase 4/5 complete.
