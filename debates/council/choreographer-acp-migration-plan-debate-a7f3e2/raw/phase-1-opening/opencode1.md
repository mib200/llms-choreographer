---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

**POSITION: REJECT the plan as written. It inverts risk and value, over-specifies the council port, and front-loads unproven infrastructure.**

---

## DECISION 1: ACP-First Broker (Path B) vs Per-Agent Adapters

**RECOMMENDED APPROACH:** Reject ACP-first as the wire protocol for all agents. Adopt a **protocol-agnostic adapter boundary**: native app-server for Codex (proven), ACP for Claude *only if* Phase 0 confirms viability, HTTP/WS for OpenCode, subprocess for Gemini. The broker multiplexes by agent name, not by protocol. Uniform **features** (streaming, structured output, cancellation) are the goal — uniform **wire format** is an unnecessary constraint.

**REASONS:**
1. ACP feasibility is explicitly uncertain; plan's Phase 0 is a "blocking" feasibility gate. Building the entire architecture on a protocol whose stability is unknown for 3 of 4 agents is putting the foundation on sand.
2. The "dual-protocol broker" fallback is already the correct design (plan line 284). If it's acceptable as fallback, it's superior as primary design.
3. OpenCode and Gemini have no ACP implementation today. Calling this "ACP-first" is marketing, not engineering.

**RISKS ACCEPTED:**
- Heterogeneous protocol maintenance (3-4 clients vs 1) — accepted vs maintaining 1 ACP client + 3 shims.
- Subprocess Gemini never supports streaming/cancellation natively — acceptable.

**WOULD NOT DO:** Write core/runtime/codex-shim.mjs. Block Ship 1 on Claude ACP feasibility.

---

## DECISION 5: Option 1+ Council Port (Wholesale + All Evolutions A-G)

**RECOMMENDED APPROACH:** Reject Option 1+. Port the base 6-phase council protocol verbatim with ZERO evolutions in Ship 2. Defer all evolutions A-G to post-Ship-2 increments. The current council is 39 lines; base skill is 490 lines — already a 12x complexity jump. Adding 7 evolutions on top is scope death.

**REASONS:**
1. Evolutions are speculative and mutually dependent. A requires G; D requires base rebuttal stable first; F requires durable artifact layout the base protocol already defines.
2. Base council skill is battle-tested (v1.9.12); evolutions are design ideas from this plan, not proven patterns.
3. User-facing value of the base protocol alone is massive (no rebuttals/synthesis/convergence/DEADLOCK veto/anonymization today).

**WOULD NOT DO:** Implement evolution A/G JSON schemas in Ship 2. Implement F cross-session memory. Implement B evidence citations (breaks anonymization because subprocess-based agents can't guarantee line-number precision).

---

## DECISION 6: Ship Ordering — INVERT

**RECOMMENDED APPROACH:** Ship 1 = real single-agent dispatch (Phase 6) + Codex adapter only. Ship 2 = base council port (no evolutions). Ship 3 = adversarial review. Ship 4 = broker + lifecycle. Ship 5 = ACP research + generalization.

**REASONS:**
1. /choreo:codex routing to council is the most user-visible bug today (docs/project-overview-pdr.md:108). Plan puts it in Ship 4 — should be Ship 1.
2. Codex adapter is already proven by external plugin. Front-loading ACP risk means users get nothing for months; back-loading means immediate Codex improvements.
3. Broker provides no user value until multiple sessions are run — an optimization, not a blocker for council or adversarial review.

**WOULD NOT DO:** Ship ACP feasibility research (Phase 0) as Ship 1 — research documents have no runtime value. Ship broker before council — council doesn't need broker.

---

## DECISION 7: Opt-in Stop-Review Gate — DROP

**RECOMMENDED APPROACH:** Drop the Stop-review gate entirely. User admitted "not validated for choreographer's users; speculative." Not low-cost: 3 new files, hook registration across 3 plugins, state schema changes, 15-min blocking timeout.

**REASONS:**
1. External plugin's gate is Codex-specific; choreographer is multi-agent. Which agent reviews which is unaddressed.
2. Result-handling stop-before-fix rule (Phase 7a) achieves 80% of safety value with 0% of infra — behavioral contract, no code.
3. Default-off features die. Speculative features with non-trivial surface area should not ship.

---

## DECISION 8: Fundamental Gap — Observability

**RECOMMENDED APPROACH:** Add core/observability.mjs from Ship 1. Every adapter invocation, council phase transition, broker request, adversarial review emits structured JSON logs to ~/.choreo/logs/<date>.ndjson. Plan has job tracking for Codex but no unified observability.

**REASONS:**
1. Current codebase has zero observability. runAgent() discards captured output after resolution.
2. External plugin has per-job logs but plan only ports Codex side. Council debates, adapter health checks, broker lifecycle invisible.
3. Non-interactive runs (CI, sub-agent Bash) require debuggability — structured logs are the only debugging interface.

---

## SUMMARY

| Decision | Position |
|----------|----------|
| 1. ACP-first broker | REJECT. Protocol-agnostic adapters. |
| 2. Codex ACP shim | DROP. Dual-protocol broker primary, not fallback. |
| 3. opencode serve mandate | ACCEPT with CHOREO_OPENCODE_MODE=subprocess escape hatch. |
| 4. Defer Pi.dev | ACCEPT. |
| 5. Option 1+ council | REJECT. Base 6-phase only in Ship 2. |
| 6. Ship ordering | INVERT. Single-agent dispatch first, broker last. |
| 7. Stop-review gate | DROP. |
| 8. Fundamental gap | ADD observability from Ship 1. |

The plan prioritizes elegant abstractions over user value. Recommend feature-first, risk-calibrated rewrite.
