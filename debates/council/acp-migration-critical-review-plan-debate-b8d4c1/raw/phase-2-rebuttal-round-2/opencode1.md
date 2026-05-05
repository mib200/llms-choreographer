---
member: opencode1
model: opencode/kimi-k2.6
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## Round 2 Rebuttal — opencode1 (kimi-k2.6)

### (A) FINAL UNIFIED BROKER EVENT-NAME TAXONOMY

**Concessions:**
- **Convention:** `snake_case` throughout. I concede my Round 1 `session/update` and `adapter:available` forms. Slash-path mirrors ACP protocol method names but adds grep friction in Node.js EventEmitter code; colon-namespace is non-idiomatic. `snake_case` is the majority consensus (Claude, opencode2) and matches existing repo style.
- **Two-lane rule:** Adopt opencode2's formulation verbatim: *ACP protocol frames → `broker.agents[name]`; orchestration decisions + lifecycle facts → `broker.events`.*
- **`agent_exit` consolidation:** Concede to Claude. `session_close` and `session_cancel` are terminal state variants; a single `agent_exit` event with a `reason` field (`completed` | `cancelled` | `error`) reduces consumer branching and race conditions between close and exit handlers.

---

**`broker.agents[name]`** — per-agent ACP client EventEmitter, one instance per agent name

| Event | Producers | Consumers |
|---|---|---|
| `session_update` | ACP stdio adapter (`core/agents/*.mjs`) | council phase machine (Ship 3), verifier loop dispatcher (Ship 4), observability NDJSON logger, transcript recorder |
| `permission_request` | ACP stdio adapter | council phase machine, permission handler (`acp-client.mjs`) |
| `agent_error` | ACP stdio adapter | observability, circuit-breaker logic |
| `agent_exit` | ACP stdio adapter | lifecycle manager, broker session manager |
| `adapter_available` | broker session manager | council phase machine (Ship 3) |
| `adapter_degraded` | broker internal | observability, DLQ handler |
| `adapter_failed` | broker internal | circuit-breaker, observability |

**Held position:** I do *not* decompose `session_update` into `content_delta`, `tool_call`, `tool_result` as separate top-level events. Those are payload discriminant types *inside* the ACP `session/update` frame. Emitting them as distinct broker events couples the broker to the ACP schema evolution; a new ACP content type would require a broker code change. Consumers filter `session_update` by payload `type`. Borrowed from my Round 1 `session/update` semantics; dropped opencode2/Claude decomposition.

---

**`broker.events`** — single internal EventEmitter for choreography lifecycle

| Event | Producers | Consumers |
|---|---|---|
| `lifecycle_session_start` | `core/runtime/lifecycle.mjs` | observability, council phase machine |
| `lifecycle_session_end` | `core/runtime/lifecycle.mjs` | observability, run summary |
| `builder_stop` | `plugin-claude/scripts/verifier-stop-hook.mjs` | verifier loop dispatcher |
| `verifier_dispatch` | `core/verifier/loop.mjs` | verifier composer, observability |
| `verifier_report` | `core/verifier/loop.mjs` | lifecycle manager, observability |
| `dlq_message` | broker internal (DLQ) | observability, dead-letter handler |
| `circuit_breaker_trip` | broker internal | observability, adapter health tracker |

**Dropped from proposals:** `lifecycle_transition` (redundant with explicit `lifecycle_session_start` / `lifecycle_session_end`). `run_error` (too vague; runtime errors should be typed and either emitted as `agent_error` on the agent channel or as structured `verifier_report` failures).

**Borrowed:**
- `snake_case` convention: Claude + opencode2.
- Two-lane split rule + consumer mappings: opencode2.
- `agent_exit` consolidation: Claude.
- `permission_request` as distinct event: opencode2 (ACP permission model requires response, unlike fire-and-forget updates).
- Adapter health + broker internals: my Round 1, renamed to `snake_case`.
- Repo-grounded file paths: my Round 1 (`core/agents/*.mjs`, `core/runtime/lifecycle.mjs`, `core/verifier/loop.mjs`).

---

### (B) OPEN QUESTIONS

**1. Ratchet thresholds (task success %, p95 latency ms, citation ratio %)**
**DEFER TO IMPL.** Reason: Ship 1 has no production ACP traffic. Committing numbers now is false precision. The plan should name the three metrics, instrument them in `core/observability.mjs`, and block the Ship 2→3 gate on setting thresholds after a baseline week.

**2. `/choreo:verify --agent=codex` manual trigger under ACP-first**
**DEFER TO IMPL.** Reason: This is a Ship 4 affordance question. The plan should include a one-line placeholder in the Ship 4 spec: "Manual verifier trigger agent selection TBD post-telemetry." No decision needed now.

**3. ACP permission handling default (auto-allow vs auto-deny) in non-interactive council/verifier contexts**
**RESOLVE NOW.** Reason: Security posture is an architectural decision, not a file-level implementation detail. The plan must explicitly state **auto-deny** as the default for all non-interactive contexts, with an explicit allowlist override mechanism. Whoever writes `acp-client.mjs` should not make this call silently.

---

### (C) FINAL CRITIQUE

**One concern not addressed in Round 1 or other Round 2 rebuttals:**

The taxonomy defines *what* events flow on which channel, but the plan lacks a **teardown contract for `broker.agents[name]` emitters**. Node.js EventEmitters retain registered listeners until `removeAllListeners()` is called or the object is garbage-collected. If an agent session ends and a new session starts under the same agent name, `broker.agents[name]` must either be replaced (new emitter instance) or explicitly drained. Without a plan-level contract, Ship 1 implementation risks memory leaks and stale listener invocation across session restarts. One line suffices: "`broker.agents[name]` emitter is disposed and recreated on each `lifecycle_session_start`; listeners must re-register."

---

### UPDATED POSITION

- Converge on `snake_case`, two-lane broker taxonomy, and auto-deny permission default.
- Defer telemetry-dependent threshold and manual-trigger decisions.
- Hold on `session_update` consolidation: broker stays protocol-schema-agnostic by emitting one ACP stream event with discriminated payload, rather than fragmenting into `content_delta` / `tool_call` / `tool_result` top-level events.
- New concern: emitter teardown contract must be added to plan before Ship 1 implementation.
