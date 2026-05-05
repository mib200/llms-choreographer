---
slug: acp-migration-critical-review-plan-debate-b8d4c1
phase: 3
type: synthesis
author: moderator (claude Opus 4.7, session-default)
source: anonymized merge of 4 final positions from phase-2-rebuttal-round-2/
date: 2026-05-05
---

# Synthesis — ACP Migration Critical-Review Plan Debate

## Convergence summary

Four debaters deliberated on 6 challenge angles across 2 rebuttal rounds. Round 1 closed with full consensus on angles 2-5 (Claude package, Gemini re-lock, schema enforcement, broker-split existence). Round 1 also converged on angles 1+6 after opencode1's phased-disambiguation position yielded — all 4 accepted opencode3's relabel "Ship 1 exit / Ship 2 start gate" for the research rewrite and opencode2's "docs atomic, impl phased" framing for the 10 items.

Round 2 scoped to (A) unifying the broker event-name taxonomy, (B) resolving 3 open questions, (C) surfacing any final concerns. Full consensus on architecture. Editorial disagreement on naming convention (3-of-4 snake_case, 1-of-4 slash/colon) and on whether `session_update` should decompose into top-level `content_delta`/`tool_call`/`tool_result` events (2-of-4 decompose, 2-of-4 keep unified with payload discriminant).

## Locked architectural decisions (FULL CONSENSUS)

### Divergence items 1-10 from the critical-review plan

| # | Item | Verdict |
|---|---|---|
| 1 | Rewrite `docs/research/acp-feasibility.md` | **Ship 1 exit criterion / Ship 2 start prerequisite** (re-labeled from "Ship 1 blocker"). Ship 1 code (~20 LoC routing fix) can begin immediately in parallel with doc rewrite. Ship 1 is not *complete* until research doc lands. Ship 2 coding cannot *start* until research doc lands. |
| 2 | Claude ACP package disambiguation | **Ship 2 start blocker.** `@agentclientprotocol/claude-agent-acp` is primary ACP stdio path (verified on npm as 0.32.0, 19 versions, wraps `@anthropic-ai/claude-agent-sdk@0.2.126`). `@anthropic-ai/claude-agent-sdk` is alternate native fallback alongside CLI subprocess. No ambiguity remains. |
| 3 | Gemini re-lock to Ship 5+ | **Ship 1 plan-correctness fix + Ship 2 start blocker.** Any Gemini presence in Ship 1 REGISTRY entry, `/choreo:gemini` command, or Ship 2 adapter table is a hard-constraint violation. Excise all Ship 1/2 Gemini from plan text. |
| 4 | OpenCode serve framed as fallback | Reframe accepted. ACP stdio primary; `opencode serve` invoked only when ACP spawn fails. |
| 5 | Codex structured-output = ACP-first client-side validation | **Uniform client-side validation for all agents** via `parseStructuredOutput(raw, schema)`. No auto-fallback to Codex `app-server` outputSchema. Parse failures flagged, never crash. |
| 6 | `acp-client.mjs` revival rationale note | Accepted. Plan must state the original council kill-decision is superseded under ACP-first. |
| 7 | Broker channel split concrete enumeration | Accepted. Plan must enumerate event types, producers, consumers for both `broker.agents[name]` and `broker.events`. See unified taxonomy below. |
| 8 | ACP SDK package name resolution probe | Accepted. Probe via `npm view` as Ship 2 pre-work; record resolved package + version in top-of-file comment of `core/agents/acp-client.mjs`. (Note: `@agentclientprotocol/sdk@0.21.0` verified during this debate.) |
| 9 | Drop `acp-docs/` cleanup reference | Accepted. Directory does not exist in repo. |
| 10 | Retire `core/parsers.mjs` legacy exports in Ship 5 | Accepted. `parseClaudeStreamJson` + `parseOpenCodeOutput` deleted once subprocess fallbacks retire; `parseStructuredOutput` retained. |

### Atomic-vs-phased revision strategy

**Docs atomic, implementation phased.** All 10 items land in ONE documentation commit to `docs/plans/2026-05-05-acp-migration-plan.md` and `docs/research/acp-feasibility.md` BEFORE Ship 2 coding begins. Ship 1 code work begins in parallel with the doc revision. Implementation ships (1-5) remain phased as planned.

Rationale (sharpened by one debater as *mandatory*, not preferred): the 10 items form a cyclic dependency graph. Item 1 (research) and item 4 (OpenCode fallback framing) cross-reference. Item 5 (client-side schema) and item 1 cross-reference. Item 7 (broker split) has no context without item 1. Phasing the doc edits guarantees a temporary inconsistent state where implementers cannot tell which sections to trust.

## Broker taxonomy — FINAL UNIFIED ENUMERATION

**Convention: `snake_case` for all event names.** 3-of-4 consensus. Dissenting debater argued slash-for-protocol/colon-for-internal gives visual boundary; the majority position noted `:` and `/` are grep-unfriendly in Node.js EventEmitter code and inconsistent with repo style. Snake_case adopted.

**Two-lane rule:** ACP protocol frames → `broker.agents[name]`; orchestration decisions + lifecycle facts → `broker.events`. No wildcard bridging between channels.

### `broker.agents[name]` — per-agent ACP client EventEmitter

One instance per agent name key. Disposed and recreated on each `lifecycle_session_start`; consumers must re-register.

| Event | Producers | Consumers |
|---|---|---|
| `session_update` | ACP stdio adapter (`core/agents/*.mjs`) | council phase machine (Ship 3), verifier loop dispatcher (Ship 4), observability NDJSON logger, transcript recorder |
| `permission_request` | ACP stdio adapter | council phase machine, permission handler in `core/agents/acp-client.mjs` |
| `agent_error` | ACP stdio adapter | observability, circuit-breaker logic |
| `agent_exit` | ACP stdio adapter | lifecycle manager, broker session manager |
| `adapter_available` | broker session manager | council phase machine (Ship 3) |
| `adapter_degraded` | broker internal | observability, DLQ handler |
| `adapter_failed` | broker internal | circuit-breaker, observability |

**Decomposition decision:** `session_update` is **not** fragmented into top-level `content_delta`/`tool_call`/`tool_result` events. Those are payload discriminant types inside the ACP `session/update` frame. Fragmenting couples the broker to ACP schema evolution. Consumers filter `session_update` by payload `type`.

**Consolidation decision:** `session_close` and `session_cancel` are covered by `agent_exit` with a `reason` field (`completed | cancelled | error`). Reduces consumer branching.

### `broker.events` — single internal EventEmitter

Choreography lifecycle and cross-agent coordination. Low-frequency, stable schema.

| Event | Producers | Consumers |
|---|---|---|
| `lifecycle_session_start` | `core/runtime/lifecycle.mjs` | observability, council phase machine |
| `lifecycle_session_end` | `core/runtime/lifecycle.mjs` | observability, run summary |
| `builder_stop` | `plugin-claude/scripts/verifier-stop-hook.mjs` | verifier loop dispatcher (Ship 4) |
| `verifier_dispatch` | `core/verifier/loop.mjs` (Ship 4) | verifier composer (Ship 4), observability |
| `verifier_report` | `core/verifier/loop.mjs` (Ship 4) | lifecycle manager, observability |
| `dlq_message` (internal) | broker internal DLQ | observability, dead-letter handler |
| `circuit_breaker_trip` (internal) | broker internal | observability, adapter health tracker |

**Dropped from proposals:** `lifecycle_transition` (redundant with explicit start/end); `run_error` (too vague; typed errors belong on agent channel or in structured verifier reports); separate `session/close`+`session/cancel` (consolidated into `agent_exit`).

**Internal events marked `(internal)`:** `dlq_message` and `circuit_breaker_trip` are produced + consumed by the broker itself. Only observability should also subscribe. Non-broker consumers (verifier loop, council phase machine) MUST NOT listen for these — wrong abstraction layer.

### Absent-consumer-at-emit-time contract

Node.js `EventEmitter` silently drops events with no listeners. For lifecycle-critical events (specifically `builder_stop` when verifier loop dispatcher hasn't registered yet due to startup ordering), the event is lost and downstream consumers never fire.

**Required plan contract:** `broker.events` uses **buffered emit with drain-on-first-listener** for these lifecycle-critical events: `builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_session_start`, `lifecycle_session_end`. Fire-and-forget for the rest.

### Emitter teardown contract

`broker.agents[name]` EventEmitter is **disposed and recreated on each `lifecycle_session_start`**. Consumers must re-register listeners after each session start. Prevents memory leaks and stale-listener invocation across session restarts.

### Payload minimal schemas

Event names alone are insufficient — producer/consumer agreement drifts without field contracts. Plan must define minimal payload field schemas for each event type (for example: `builder_stop` carries `{ session_id, agent_name, reason }`; `verifier_report` carries `{ verifier_id, builder_run_id, round, status, ... }` matching the Ship 4 report schema). Defer exact JSON schema definitions to Ship 2 implementation, but plan must state the minimal-contract discipline.

## Open question verdicts

| # | Question | Verdict |
|---|---|---|
| 1 | Exact ratchet thresholds per metric (task success %, p95 latency, citation ratio) | **DEFER TO IMPL (unanimous).** No baseline exists. Ship 1 instruments metrics; Ship 2 runs one week; thresholds committed before Ship 3 gate. |
| 2 | `/choreo:verify --agent=codex` accepting app-server schema enforcement | **DEFER (3-of-4) / DROP AS NON-ISSUE (1-of-4).** Effective decision: drop from open-questions list; add one-line placeholder to Ship 4 spec: "Manual verifier trigger agent selection TBD post-telemetry." No plan-level decision required now. |
| 3 | ACP permission default in non-interactive council/verifier contexts | **RESOLVE NOW (unanimous): auto-deny.** Security posture is architectural, not file-level. Plan states: "Non-interactive ACP sessions default to auto-deny on `session/request_permission`; explicit allowlist overrides must be declared per verifier / per council member." `core/agents/acp-client.mjs` enforces. |

## Required plan-text additions (beyond original 10 items)

The debate surfaced four additions that the critical-review plan's item 7 does not cover:

1. **Enumerated broker event taxonomy** — plan-text edit must include the snake_case tables above, replacing the one-line "Two pub/sub surfaces" note.
2. **Absent-consumer contract** — one plan paragraph on buffered-emit-with-drain-on-first-listener for lifecycle-critical events.
3. **Emitter teardown contract** — one plan line on `broker.agents[name]` disposal + re-registration on `lifecycle_session_start`.
4. **Minimal payload schemas** — plan line committing Ship 2 implementation to define minimal field contracts per event, not just names. Internal-only event annotation rule.

## Remaining disagreements (Rule 5 — preserved honestly)

1. **Naming convention** (3-of-4 snake_case, 1-of-4 slash/colon).
   - Majority position (adopted in synthesis): snake_case for grep-friendliness, EventEmitter idiom, repo consistency.
   - Minority position: slash for ACP protocol names (matches ACP spec `session/update`), colon for internal events, gives visual boundary. Dissenting debater acknowledged the file references would need reconciliation if the convention was adopted.
   - Load-bearing? No. Both conventions are functionally equivalent. Adopt majority.

2. **`session_update` decomposition** (2-of-4 decompose, 2-of-4 keep unified).
   - Decompose position (2): separate top-level `content_delta`, `tool_call`, `tool_result` events for direct subscription ergonomics.
   - Unified position (2): emit one `session_update` event with payload `type` discriminant; keeps broker schema-agnostic as ACP evolves.
   - Synthesis adopts **unified** — the schema-agnosticism argument is load-bearing; direct subscription ergonomics is recoverable via consumer-side filter helpers.

3. **`run_error` and `lifecycle_transition`** (kept by 2, dropped by 2).
   - Synthesis drops both. `run_error` is too vague; typed errors belong on agent channel or in verifier reports. `lifecycle_transition` is redundant with explicit `lifecycle_session_start` / `lifecycle_session_end`.

## Confidence

**FULL CONSENSUS** across all 4 debaters on:
- All 10 divergence items (verdicts in table above)
- Atomic-docs-phased-impl revision strategy
- Two-lane broker rule
- Auto-deny permission default
- Defer-ratchet-thresholds + drop-/choreo:verify-agent-question
- Four plan-text additions (broker taxonomy, absent-consumer contract, teardown contract, minimal payload schemas)

**PARTIAL** on editorial items preserved as honest disagreements above. None are architecturally load-bearing.

## Debate Summary

- Members: 4 (claude moderator + opencode1 kimi-k2.6 + opencode2 gpt-5.5 + opencode3 qwen3.6-plus)
- Rounds run: 2 (round 3 skipped after Round 2 hit architectural full-consensus)
- Pre-flight unique questions answered: 4 (from 7 raw, deduped)
- Pre-flight failures: 0
- Concessions by debater: each conceded multiple Round 1 positions to achieve Round 2 convergence
- User clarifications requested mid-debate: 0 (all absorbed from Phase 0.5)
- Key insight that emerged: the 10 divergence items form a cyclic dependency graph (not DAG), which upgrades "atomic is preferable" to "atomic is mandatory" — phasing doc edits guarantees partial-inconsistent state that implementers cannot detect automatically.
