---
slug: acp-migration-critical-review-plan-debate-b8d4c1
phase: 4
type: decision
date: 2026-05-05
members: [claude, opencode1, opencode2, opencode3]
models:
  claude: session-default (Opus 4.7 anonymous debater sub-agent + orchestrating moderator)
  opencode1: opencode-go/kimi-k2.6
  opencode2: opencode/gpt-5.5
  opencode3: opencode-go/qwen3.6-plus
rounds_run: 2
rounds_max: 3
confidence: PARTIAL CONSENSUS
supersedes: null
binds: /Users/mk/.claude/plans/there-is-a-prelimary-serene-wirth.md
binding_context: debates/council/choreographer-acp-migration-plan-debate-a7f3e2/decision.md (ship order, council evolutions, verifier loop placement)
---

# Council Decision: ACP Migration Critical-Review Plan

## Members

- **claude** — session-default (moderator orchestrator + anonymous Opus 4.7 debater sub-agent)
- **opencode1** — opencode-go/kimi-k2.6
- **opencode2** — opencode/gpt-5.5
- **opencode3** — opencode-go/qwen3.6-plus

## Consensus Position

Approve the critical-review plan at `/Users/mk/.claude/plans/there-is-a-prelimary-serene-wirth.md` with the following binding amendments (full synthesis rationale at `synthesis.md`).

### Divergence items — verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | Research doc rewrite | **Ship 1 exit criterion / Ship 2 start prerequisite** (re-labeled from "Ship 1 blocker"). Not a Ship 1 code blocker. Ship 1 (~20 LoC routing fix) begins in parallel. |
| 2 | Claude ACP package | **Ship 2 start blocker.** `@agentclientprotocol/claude-agent-acp@0.32.0` primary (verified wraps `@anthropic-ai/claude-agent-sdk@0.2.126`). `@anthropic-ai/claude-agent-sdk` alternate native fallback. |
| 3 | Gemini re-lock | **Ship 1 plan-correctness fix + Ship 2 start blocker.** Excise all Gemini from Ship 1 REGISTRY, `/choreo:gemini` command, Ship 2 adapter table. Constraint-hard. |
| 4 | OpenCode serve framed as fallback | Accepted. |
| 5 | Codex schema = ACP-first client-side validation | Accepted. No Codex `app-server` `outputSchema` auto-fallback. Uniform `parseStructuredOutput` pipeline. |
| 6 | `acp-client.mjs` revival rationale | Accepted. Plan must note supersedes prior council kill-decision. |
| 7 | Broker channel split concrete enumeration | Accepted. Plan must include full unified taxonomy (below). |
| 8 | ACP SDK package name resolution probe | Accepted. `npm view @agentclientprotocol/sdk version` probe verified `0.21.0`; pin in `package.json`. |
| 9 | Drop `acp-docs/` cleanup reference | Accepted. Directory does not exist. |
| 10 | Retire `core/parsers.mjs` legacy exports in Ship 5 | Accepted. `parseStructuredOutput` retained; `parseClaudeStreamJson` + `parseOpenCodeOutput` deleted. |

### Revision strategy

**Docs atomic, implementation phased.** All 10 items in ONE documentation commit to `docs/plans/2026-05-05-acp-migration-plan.md` + `docs/research/acp-feasibility.md` BEFORE Ship 2 coding begins. Ship 1 code begins in parallel. Implementation ships (1-5) remain phased per prior council.

Rationale: 10 items form a cyclic dependency graph. Phasing doc edits guarantees temporary partial-inconsistent state.

### Broker taxonomy — MANDATORY plan-text addition

Convention: **`snake_case`** (3-of-4; 1-of-4 minority preferred slash/colon but accepted majority as non-load-bearing).

Two-lane rule: ACP protocol frames → `broker.agents[name]`; orchestration + lifecycle facts → `broker.events`. No wildcard bridging.

#### `broker.agents[name]` — per-agent ACP client EventEmitter

| Event | Producers | Consumers |
|---|---|---|
| `session_update` | ACP stdio adapter (`core/agents/*.mjs`) | council phase machine (Ship 3), verifier loop dispatcher (Ship 4), observability NDJSON logger, transcript recorder |
| `permission_request` | ACP stdio adapter | council phase machine, permission handler in `core/agents/acp-client.mjs` |
| `agent_error` | ACP stdio adapter | observability, circuit-breaker logic |
| `agent_exit` | ACP stdio adapter | lifecycle manager, broker session manager |
| `adapter_available` | broker session manager | council phase machine (Ship 3) |
| `adapter_degraded` | broker internal | observability, DLQ handler |
| `adapter_failed` | broker internal | circuit-breaker, observability |

- `session_update` **NOT** decomposed (keep ACP schema-agnostic; consumers filter by payload `type`).
- `session_close` + `session_cancel` **consolidated** into `agent_exit` with `reason: completed|cancelled|error`.

#### `broker.events` — single internal EventEmitter

| Event | Producers | Consumers |
|---|---|---|
| `lifecycle_session_start` | `core/runtime/lifecycle.mjs` | observability, council phase machine |
| `lifecycle_session_end` | `core/runtime/lifecycle.mjs` | observability, run summary |
| `builder_stop` | `plugin-claude/scripts/verifier-stop-hook.mjs` | verifier loop dispatcher (Ship 4) |
| `verifier_dispatch` | `core/verifier/loop.mjs` (Ship 4) | verifier composer (Ship 4), observability |
| `verifier_report` | `core/verifier/loop.mjs` (Ship 4) | lifecycle manager, observability |
| `dlq_message` *(internal)* | broker internal DLQ | observability, dead-letter handler |
| `circuit_breaker_trip` *(internal)* | broker internal | observability, adapter health tracker |

- Events marked `(internal)` MUST NOT be subscribed by non-broker consumers (wrong abstraction layer).
- Dropped from proposals: `lifecycle_transition` (redundant), `run_error` (too vague; typed errors go on agent channel or in `verifier_report`).

### 4 additional plan-text mandates

Surfaced by debate, not in original 10 items:

1. **Absent-consumer-at-emit-time contract**: lifecycle-critical events (`builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_session_start`, `lifecycle_session_end`) use **buffered emit with drain-on-first-listener**. Others fire-and-forget.
2. **Emitter teardown contract**: `broker.agents[name]` disposed + recreated on each `lifecycle_session_start`. Consumers re-register.
3. **Minimal payload schemas**: plan commits Ship 2 to defining minimal field contracts per event (not just names). Internal-only events carry `(internal)` annotation.
4. **ACP permission default**: non-interactive ACP sessions default to **auto-deny** on `session/request_permission`. Explicit allowlist overrides per verifier / per council member. `core/agents/acp-client.mjs` enforces.

### Open question verdicts

| # | Question | Verdict |
|---|---|---|
| 1 | Exact ratchet thresholds | **DEFER TO IMPL** (unanimous). Ship 1 instruments metrics; Ship 2 runs baseline week; thresholds committed before Ship 3 gate. |
| 2 | `/choreo:verify --agent=codex` schema enforcement | **DROP from open-questions list.** One-line Ship 4 spec placeholder: "Manual verifier trigger agent selection TBD post-telemetry." |
| 3 | ACP permission default in non-interactive | **RESOLVE NOW** (unanimous). Auto-deny. See plan-text mandate #4 above. |

## Key Agreements (unanimous across 4 debaters)

1. All 10 divergence items accepted with blocker-label refinements (item 1 = exit/prerequisite, item 2 = Ship 2 only, item 3 = Ship 1 plan + Ship 2 start).
2. Docs atomic, implementation phased.
3. `@agentclientprotocol/claude-agent-acp@0.32.0` primary ACP stdio path; SDK alternate fallback. Verified via npm probe.
4. Gemini excised from Ship 1/2 entirely. Hard constraint.
5. Uniform ACP-first client-side schema validation. No Codex auto-fallback.
6. Broker two-lane rule; `broker.agents[name]` for ACP, `broker.events` for orchestration.
7. Auto-deny ACP permission default; allowlist overrides explicit.
8. Broker taxonomy must enumerate producers + consumers + event types (not channel names alone).

## Resolved Debates

1. **Research rewrite blocker semantics.** Original plan labeled it "blocker." opencode1 + opencode2 + opencode3 argued Ship 1 code is transport-independent, so the label is wrong. Claude (Round 1) conceded. Final: "Ship 1 exit criterion / Ship 2 start prerequisite."
2. **Atomic vs phased revision strategy.** opencode1 Round 1 argued phased; Round 2 conceded after the cyclic-dependency-graph argument showed phasing guarantees partial-inconsistent state. Final: docs atomic, impl phased.
3. **Broker event naming convention.** opencode1 Round 1 used slash/colon (matching ACP spec); Claude + opencode2 used snake_case. Round 2: opencode1 conceded. opencode3 maintained slash/colon dissent but accepted majority. Final: snake_case.
4. **`session_update` decomposition.** Round 2: 2-of-4 proposed separate `content_delta`/`tool_call`/`tool_result` top-level events; 2-of-4 argued unified `session_update` with payload discriminant. Schema-agnostic argument is load-bearing. Final: unified.
5. **`agent_exit` consolidation.** `session_close` + `session_cancel` merged into `agent_exit` with `reason` field. Reduces consumer branching.

## Remaining Disagreements (Rule 5 — preserved honestly)

1. **Naming convention** — opencode3 dissents (slash for ACP protocol, colon for internal). Synthesis adopts snake_case majority. Editorial. Not architecturally load-bearing.
2. **`session_update` decomposition** — 2-of-4 still prefer top-level events for subscription ergonomics. Synthesis adopts unified-with-discriminant on schema-agnostic grounds. Not load-bearing.
3. **`run_error` and `lifecycle_transition` dropped** — 2-of-4 would keep them. Synthesis drops on vagueness/redundancy grounds. Not load-bearing.

## Confidence Level

**PARTIAL CONSENSUS**

Validation tally:
- FULL CONSENSUS: opencode1, opencode2 (2)
- PARTIAL CONSENSUS: opencode3 (1; dissents preserved in §Remaining Disagreements as editorial-only)
- DEADLOCK: none (0)

No DEADLOCK veto fired. opencode3's PARTIAL matches the synthesis's own self-assessment and flags no load-bearing architectural gaps.

## Debate Summary

- Members: 4 (claude moderator + 3 opencode debaters)
- Rounds run: 2 (round 3 skipped after Round 2 architectural full-consensus)
- Pre-flight raw questions collected: 7 total across 3 non-Claude members
- Pre-flight unique questions answered (after dedup): 4
- Pre-flight failures: 0
- Concessions per member: multi-item concessions in both Round 1 and Round 2 (tracked verbatim in `raw/phase-2-*/` files)
- User clarifications mid-debate (Question Routing): 0 — all routed into Phase 0.5 preflight
- Skipped members: 0

## Key Insight

**The 10 divergence items form a cyclic dependency graph, not a DAG.** This upgraded the "atomic is preferable" framing to "atomic is mandatory" — because items 1, 4, 5, 7 cross-reference each other's content, phasing any subset creates a plan state where the research doc and plan disagree on architectural fundamentals. No single model stated this argument in isolation; it emerged in Round 1 rebuttal (opencode1's Round 2 rebuttal formalized it) and drove the unanimous convergence away from opencode1's original Round 1 phased position.

The secondary insight: **Four plan-text additions surfaced during debate are not in the original 10 items.** They are mandatory for Ship 2 implementation: enumerated broker taxonomy, absent-consumer buffered-emit contract, emitter teardown contract, minimal payload schemas. Adopting the 10-item plan without these would leave Ship 2 with known architectural gaps.

## Artifacts

- Synthesis: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/synthesis.md`
- Topic: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/topic.md`
- Raw Phase 0.5 preflight: `raw/phase-0-preflight/{opencode1,opencode2,opencode3}.md`
- Raw Phase 1 opening: `raw/phase-1-opening/{claude,opencode1,opencode2,opencode3}.md`
- Raw Phase 2 round 1: `raw/phase-2-rebuttal-round-1/{claude,opencode1,opencode2,opencode3}.md`
- Raw Phase 2 round 2: `raw/phase-2-rebuttal-round-2/{claude,opencode1,opencode2,opencode3}.md`
- Raw Phase 3 validation: `raw/phase-3-validation/{opencode1,opencode2,opencode3}.md`

## Next actions (binding for implementation session)

1. Update `/Users/mk/.claude/plans/there-is-a-prelimary-serene-wirth.md` or its repo replacement to absorb:
   - Item 1 re-label to "Ship 1 exit criterion / Ship 2 start prerequisite"
   - Broker taxonomy full enumeration (tables above)
   - 4 plan-text mandates (buffered emit, teardown contract, payload schemas, auto-deny permission)
   - Open-question verdicts (defer 1, drop 2, resolve 3)
2. Execute the atomic doc revision to `docs/plans/2026-05-05-acp-migration-plan.md` + `docs/research/acp-feasibility.md` per the amended plan.
3. Begin Ship 1 code work in parallel. Ship 2 coding blocked until atomic doc commit lands.
