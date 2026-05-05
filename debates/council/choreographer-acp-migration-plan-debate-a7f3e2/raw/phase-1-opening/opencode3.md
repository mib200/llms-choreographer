---
member: opencode3
model: opencode-go/deepseek-v4-pro
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

### Decision 5 (Option 1+ council port — wholesale + all evolutions A-G)

**REJECT wholesale Option 1+. Ship the base 6-phase protocol as-is; defer evolutions A/C/D/E/F/G.**

The plan's Option 1+ combines two largely orthogonal concerns:
1. Porting the battle-tested 6-phase council from `~/.claude/skills/council/SKILL.md` (proven flow, real failure modes handled — Gemini skip, DEADLOCK veto, anonymization, Question Routing)
2. Bolting on seven design evolutions invented specifically for this migration (A through G)

The base port is high-value because it replaces a broken 39-line Promise.all (`core/companion.mjs:47-84`) with a mature multi-round deliberation. The evolutions are speculative improvements over a protocol that already works at v1.9.12.

- **(A) Structured JSON positions + (G) Structured JSON synthesis** — the stated justification is "machine-readable deliverable." But who is the consumer? The plan doesn't name one. Adding JSON schemas to every debater's output adds parse-failure paths, version drift risk, and prompt-fragility.
- **(B) Evidence citations required** — reasonable in intent but unenforceable across heterogeneous agents. Claude can cite accurately; Gemini in subprocess mode often hallucinates line numbers. Down-weighting positions for missing citations penalizes the weakest agents, skewing synthesis.
- **(C) Adaptive rounds** — a marginal tweak with non-trivial implementation. Optimization without a measured problem.
- **(D) Adversarial round** — Phase 5 already delivers `/choreo:adversarial-review` as standalone. Embedding it in the council conflates two separate capabilities; the adversarial review is Codex-only structured-output (sandbox: read-only, structuredSchema, approvalPolicy: never — plan:169).
- **(E)/(F)/(G)** — nice-to-haves, none necessary for a working council. `debates/council/_index.json` is a data-retention liability.

**Recommendation:** Ship 3 = verbatim port of v1.9.12 6-phase protocol. Ship 3.5 = evolutions A-G as a separate increment AFTER users exercise the core protocol.

### Decision 1 (ACP-first broker)

**No. Dual-protocol broker from the start. Do not build the ACP-only broker and then "fall back."**

Phase 0 will almost certainly produce:

| Agent | Phase 0 Verdict |
|-------|----------------|
| Claude | "assumed viable" (not verified — plan:24) |
| Codex | "shim-required" (no native ACP — plan:25) |
| OpenCode | "HTTP/WS serve" (not ACP — plan:27) |
| Gemini | "subprocess-fallback" (plan:28) |

Zero of four agents speak native ACP. Three of four need shims or alternate transports. The "ACP-first" framing is fiction. The real architecture is heterogeneous transports with an adapter boundary — which is what Phase 2 already builds.

**What I'd do:** Build the broker to manage connections per-agent whatever protocol each agent speaks. Generalize the external plugin's broker to manage ACP connections for Claude, HTTP/WS for OpenCode, app-server for Codex, and subprocess for Gemini. Kill `acp-client.mjs` until an agent ACTUALLY speaks ACP.

### Decision 6 (Ship ordering)

**Ship 1 MUST include Phase 6 (single-agent dispatch).**

`docs/project-overview-pdr.md:108` documents that `/choreo:codex` misleadingly routes to the full council — a UX bug, not a missing feature.

Fix: ~15 lines for `agent` subcommand + 4 files with 1-line changes = 20 lines total. No adapters. No broker. No ACP. Just `spawn('codex', ['exec', task])` using the existing subprocess path.

**Recommendation:** Ship 1 should be Phase 6 (single-agent dispatch) + Phase 7a (result-handling rule) + Phase 0 (feasibility research). Zero-infra, high-value, immediate UX improvements. Then Ships 2+ bring the adapter layer, council port, etc.

### Decision 7 (Stop-review gate)

**Remove from scope.** Speculative value + non-trivial surface area + unclear use case = cut it. By Ship 5, choreographer has retired `codex exec` entirely (plan:206). The gate would intercept... what? The use case doesn't transfer.

### Decision 8 (Fundamental gap): **No council crash recovery.**

The broker persists state. But the council phase machine has NO persistence. If the broker crashes during a 5-member, 3-round council, restart from scratch.

**Fix:** write `council.json` to `debates/council/<SLUG>/` after each phase completes, recording `{phase, round, members, positionsCollected, generation}`. On `/choreo:council` invocation, check for interrupted council and offer resume.

### Summary

| Decision | Position |
|----------|----------|
| 1 (ACP-first broker) | No. Dual-protocol from start. Kill `acp-client.mjs` until an agent ACTUALLY speaks ACP. |
| 2 (Codex ACP shim) | Don't build. Dual-protocol is plan's option (b). Translator is leaky abstraction. |
| 3 (opencode serve) | Agree with mandate. Fail-loud with exact command. |
| 4 (Pi.dev deferral) | Agree. |
| 5 (Option 1+ council) | Verbatim port in Ship 3. Evolutions A-G to Ship 3.5. |
| 6 (Ship ordering) | Ship 1 must include single-agent dispatch. |
| 7 (Stop-review gate) | Remove. |
| 8 (Gap) | Add `council.json` checkpoint file for crash recovery. |
