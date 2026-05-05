---
member: claude
model: session-default (Agent general-purpose, Opus 4.7)
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## Round 2 Rebuttal — Claude Opus 4.7

### (A) UNIFIED BROKER EVENT-NAME TAXONOMY

**Concessions from Round 1:**
Kimi's file paths (`core/agents/*.mjs`, `core/runtime/lifecycle.mjs`, `core/verifier/loop.mjs`) are grounded in actual repo structure. My Round 1 used speculative paths (`orchestrator.mjs`, `router.mjs`). I concede those paths. The actual paths from opencode proposals should anchor the taxonomy.

GPT-5.5's routing rule is the cleanest formulation and I adopt it verbatim: *ACP protocol frames → broker.agents[name]; orchestration decisions + lifecycle facts → broker.events.*

**Convention decision: snake_case throughout.**

Rationale: The codebase is Node.js/ESM. All four proposals mix conventions (Kimi uses `session/update`, `adapter:available`; GPT uses `session_update`; Qwen uses `lifecycle_transition`). Colon-namespace (`adapter:available`) conflicts with Node.js EventEmitter convention where `:` is legal but unusual and grep-unfriendly. Slash-path (`session/update`) mimics HTTP routes — wrong semantic domain for an EventEmitter. Snake_case is consistent, grep-safe, and matches GPT-5.5 and Qwen's dominant choices.

---

**FINAL UNIFIED TAXONOMY:**

**`broker.agents[name]`** — per-agent ACP client EventEmitter, one instance per agent name

| Event | Producers | Consumers |
|---|---|---|
| `session_update` | ACP stdio adapter (`core/agents/*.mjs`) | terminal UI, transcript recorder |
| `content_delta` | ACP stdio adapter | terminal UI, observability |
| `tool_call` | ACP stdio adapter | transcript recorder, observability |
| `tool_result` | ACP stdio adapter | transcript recorder, observability |
| `agent_error` | ACP stdio adapter | observability, circuit-breaker logic |
| `agent_exit` | ACP stdio adapter | lifecycle manager |
| `adapter_available` | broker session manager | council phase machine (Ship 3) |
| `adapter_degraded` | broker internal | observability, DLQ handler |
| `adapter_failed` | broker internal | circuit-breaker, observability |

Note: `session_close` and `session_cancel` (Kimi) are covered by `agent_exit` with a `reason` field. Consolidating reduces consumer branching.

---

**`broker.events`** — single internal EventEmitter for choreography lifecycle

| Event | Producers | Consumers |
|---|---|---|
| `lifecycle_session_start` | `core/runtime/lifecycle.mjs` | observability, council phase machine |
| `lifecycle_session_end` | `core/runtime/lifecycle.mjs` | observability, run summary |
| `lifecycle_transition` | `core/runtime/lifecycle.mjs` | observability |
| `builder_stop` | `plugin-claude/scripts/verifier-stop-hook.mjs` | verifier loop dispatcher |
| `verifier_dispatch` | `core/verifier/loop.mjs` | verifier composer, observability |
| `verifier_report` | `core/verifier/loop.mjs` | lifecycle manager, observability |
| `run_error` | `core/runtime/lifecycle.mjs` | observability, error sink |
| `broker_dlq_message` | broker internal (DLQ) | observability, dead-letter handler |
| `broker_circuit_breaker_trip` | broker internal | observability, adapter health tracker |

**Dropped from proposals:** `session/update` on broker.events (redundant — that's broker.agents domain). `verifier:dispatch` colon-form renamed `verifier_dispatch`.

---

### (B) OPEN QUESTIONS

**1. Ratchet thresholds (task success %, p95 latency, citation ratio)**

**DEFER TO IMPL** — Ship 1 has no production traffic. Committing thresholds before baseline data is engineering theater. Record the *metrics* now (name them, instrument them), commit *numbers* after first week of Ship 2 runs. Plan should say: "Thresholds TBD post-Ship-2 week-1 baseline; block Ship 3 gate on missing numbers."

**2. `/choreo:verify --agent=codex` under ACP-first**

**DEFER TO IMPL** — The question is valid but Ship 4 doesn't exist yet. Deferring until post-Ship-4 telemetry is correct as stated. No change needed. Drop from open-questions list; add one-line note in Ship 4 spec placeholder.

**3. ACP permission handling default (auto-allow vs auto-deny) in non-interactive contexts**

**RESOLVE NOW** — This is a security posture decision, not an implementation detail. Deferring it to `acp-client.mjs` means whoever writes that file makes a security call silently. The plan must state the default explicitly: **auto-deny in council/verifier contexts** (fail-safe). `acp-client.mjs` then enforces it. The *why* belongs in the plan; the *how* belongs in the file.

---

### (C) FINAL CRITIQUE

**One concern not raised in Round 1:**

The taxonomy above defines producers and consumers but the plan currently has no contract for *what happens when a consumer is absent at emit time*. Node.js EventEmitter silently drops events with no listeners. For `builder_stop` in particular — if the verifier loop dispatcher hasn't registered yet when the stop-hook fires (race condition during startup sequencing) — the event is lost and the verifier never runs. This is not a Ship 2 problem, it's a Ship 1 architecture decision: the plan must specify whether broker.events uses buffered/queued delivery for lifecycle-critical events or requires listener registration ordering guarantees. Neither Round 1 proposal addressed this. It should be one line in the plan: buffered emit with drain-on-first-listener, or explicit startup ordering constraint.

---

### UPDATED POSITION

Round 1 positions hold. Concessions:
- File paths: adopt Kimi/Qwen's `core/runtime/lifecycle.mjs`, `core/verifier/loop.mjs`, `core/agents/*.mjs` over my speculative paths.
- Event consolidation: `session_close` + `session_cancel` → `agent_exit` with `reason` field (GPT-5.5 influence).
- Convention: snake_case wins over colon/slash forms.

Held positions:
- Items 2+3 (broker taxonomy, ACP permission default) are Ship 1 blockers.
- Item 1 (exit gate) is Ship 1→2 transition gate, not Ship 1 code.
- Question 3 must resolve now (security posture, not impl detail).
- Missing concern: buffered-vs-ordered delivery for lifecycle-critical events must be stated in plan before Ship 1 impl begins.
