---
member: opencode2
model: opencode/gpt-5.5
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

1. FINAL UNIFIED BROKER TAXONOMY

Adopt two lanes, with `snake_case` event names everywhere.

`broker.agents[name]`: per-agent ACP traffic only.

Purpose: carry normalized ACP session stream for one agent. No orchestration decisions live here.

Producers:
- Per-agent ACP client adapters: `claude.mjs`, `codex.mjs`, `opencode.mjs`, `gemini.mjs`
- Adapter wrappers around ACP stdio subprocesses

Events:
- `session_update`
- `content_delta`
- `tool_call`
- `tool_result`
- `permission_request`
- `agent_error`
- `agent_exit`
- `session_close`
- `session_cancel`
- `adapter_available`
- `adapter_degraded`
- `adapter_failed`

Consumers:
- Broker session manager
- Council phase machine
- Verifier loop dispatcher
- Agent transcript recorder
- Observability NDJSON logger
- Future terminal UI/dashboard stream

`broker.events`: choreography lifecycle and cross-agent coordination only.

Purpose: carry internal runtime facts, lifecycle transitions, and verifier coordination. No raw ACP frames live here.

Producers:
- Runtime lifecycle hooks
- Builder orchestration / builder stop hook
- Verifier dispatcher / verifier loop
- Broker internals

Events:
- `session_start`
- `session_end`
- `lifecycle_transition`
- `builder_stop`
- `verifier_dispatch`
- `verifier_report`
- `run_error`
- `dlq_message`
- `circuit_breaker_trip`

Consumers:
- `core/observability.mjs`
- Verifier loop / composer
- Runtime lifecycle handlers
- Final run summary
- Future dashboard/event sink

Borrowed:
- From Claude: clean split between ACP session channel and lifecycle/dispatch channel.
- From kimi: adapter health, DLQ, circuit-breaker events.
- From gpt-5.5: explicit rule that ACP frames stay on `broker.agents[name]`.
- From qwen: producer/consumer mapping to council, verifier loop, observability.

2. OPEN QUESTIONS

1. Ratchet thresholds: DEFER TO IMPL.
Reason: baseline-then-observe is the right doc-level commitment; hard numbers before telemetry would be false precision.

2. `/choreo:verify --agent=codex`: DEFER TO IMPL.
Reason: this is a Ship 4 affordance decision, and telemetry should decide whether ACP-first needs an app-server escape hatch.

3. ACP permission default: RESOLVE NOW.
Reason: non-interactive council/verifier contexts need predictable safety semantics; default should be auto-deny unless an explicit allowlist grants the request.

3. FINAL CRITIQUE

One remaining concern: the plan should explicitly define normalized event payload fields, not only event names. Without minimal schemas, producer/consumer agreement can still drift.

UPDATED POSITION

Converge. Use two-lane broker taxonomy, `snake_case`, auto-deny permission default, defer threshold and manual Codex trigger decisions until telemetry.
