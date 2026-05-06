---
title: ACP Migration Foundation
date: 2026-05-05
last_updated: 2026-05-06
category: architecture-patterns
module: agent-protocol
problem_type: architecture_pattern
component: assistant
severity: high
applies_when:
  - "Migrating agent transport protocols from subprocess spawning to standardized protocol"
  - "Establishing multi-agent communication patterns with broker orchestration"
  - "Running council-based decision workflows to resolve architectural disagreements"
  - "Setting up fallback transport strategies for critical infrastructure"
tags:
  - acp
  - agent-protocol
  - transport
  - council
  - migration
  - broker
  - observability
---

# ACP Migration Foundation

## Context

The choreographer monorepo invoked Codex via `spawn('codex', ['exec', prompt])` from a single `core/companion.mjs` file. All agent commands (`/choreo:codex`, `/choreo:claude`, `/choreo:opencode`) silently routed through a fake 1-round council — a known deferred bug. No structured output, no thread resume, no streaming, no multi-agent deliberation.

Three external inputs shaped the target architecture: the `@openai/codex-plugin-cc` production plugin (JSON-RPC broker, structured schemas, thread resume), the global council skill (6-phase adversarial debate protocol), and the Pi Verifier pattern (Builder + Verifier two-agent loop with atomic-claim decomposition). The Agent Client Protocol (ACP) emerged as a unifying transport layer all four agents support.

An earlier council debate (artifacts at `debates/council/choreographer-acp-migration-plan-debate-a7f3e2/`) had concluded "adapter-first, not ACP-first." The current session reversed this: after reading primary ACP documentation and the TypeScript SDK, a 4-member council (claude moderator + 3 opencode debaters) produced binding amendments favoring ACP-first with native fallbacks.

## Guidance

### ACP-First Architecture with Native Fallbacks

Adopt ACP as the primary transport. The broker is an ACP client using `@agentclientprotocol/sdk@^0.21.0`. It speaks ACP over stdio to all agents. Each agent adapter wraps its ACP stdio spawn logic and falls back to its native transport if ACP fails.

**Package pinning**: `@agentclientprotocol/sdk@^0.21.0`, `@agentclientprotocol/claude-agent-acp@^0.32.0`. Both pre-1.0; pin with caret ranges, monitor for breaking changes.

**Per-agent adapter pattern**:
1. Try ACP stdio spawn → `initialize` → if success, use ACP for all operations
2. If ACP spawn fails, `initialize` fails, OR any ACP invocation throws → automatic fallback to native transport (try/catch in `invoke()`)
3. Report active transport via `checkAvailability()` → `{ available, transport: "acp" | "native", reason? }`

| Agent | ACP stdio spawn (PRIMARY) | Native fallback |
|-------|----------------|-----------------|
| Claude | `@agentclientprotocol/claude-agent-acp@0.32.0` | `@anthropic-ai/claude-agent-sdk@0.2.128` programmatic API, OR CLI subprocess |
| Codex | `codex` binary with ACP stdio (via `codex-acp` Zed adapter) | `codex app-server` JSON-RPC over Unix socket |
| OpenCode | `opencode` binary with ACP stdio (native) | `opencode serve` HTTP API + SSE |
| Gemini | ACP stdio (native) — Ship 5+ only | Subprocess `gemini -y -m <model> -p "<prompt>"` |

### Uniform Client-Side Schema Validation

ACP does not enforce schemas. Use `parseStructuredOutput(raw, schema)` for ALL agents. No auto-fallback to Codex native `outputSchema` — bifurcated validation compounds maintenance surface. This was a unanimous council decision.

### Broker Two-Lane Event Taxonomy

All event names use `snake_case`. Two separate EventEmitters:

**`broker.agents[name]`** — per-agent ACP client (disposed + recreated on each `lifecycle_session_start`):
- `session_update`, `permission_request`, `agent_error`, `agent_exit`, `adapter_available`, `adapter_degraded`, `adapter_failed`

**`broker.events`** — single internal EventEmitter for orchestration:
- `lifecycle_session_start`, `lifecycle_session_end`, `builder_stop`, `verifier_dispatch`, `verifier_report`, `dlq_message` (internal), `circuit_breaker_trip` (internal)

Boundary rule: ACP protocol frames → `broker.agents[name]`; orchestration + lifecycle → `broker.events`. No wildcard bridging.

### Buffered Emit with Drain-on-First-Listener

Lifecycle-critical events (`builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_session_start`, `lifecycle_session_end`) must buffer until the first listener registers. Node.js EventEmitter silently drops events with no listeners; buffering prevents startup races where `builder_stop` fires before the verifier loop dispatcher registers.

### ACP Permission Default

ALL sessions deny `session/request_permission` by default — both interactive and non-interactive. Only an explicit `permissionAllowlist` set grants access. The earlier "interactive auto-allow" was removed as a security regression (council review 2026-05-06). Unanimous consensus on deny-by-default posture.

### Broker Resilience (Mandatory from Day One)

- Dead-letter queue for failed messages
- Idempotency keys on all requests (bounded: 1000 entries, 1hr TTL, FIFO eviction)
- Circuit-breaker per adapter (half-open → open on probe failure)
- Load queue (sequential processing per agent)
- Default timeout: 5 minutes per invocation

**Production wiring (verified 2026-05-06):** `companion.mjs` and `council.mjs` both invoke agents exclusively through `broker.invoke()`. No direct subprocess spawning in production paths. Env scrubbing via `buildAgentEnv()` (from `core/env.mjs`) applied to all adapter spawns.

### Gemini Locked to Ship 5+

Hard constraint. Gemini excluded from Ship 1/2 REGISTRY and commands until claude/codex/opencode ACP paths are proven with metric gates.

### Observability Foundation

NDJSON event emitter at `core/observability.mjs` with 7-day retention, 100 MB/day cap, automatic rotation. Every adapter invocation, phase transition, broker request, verifier round emits structured events to `~/.choreo/logs/<date>.ndjson`.

## Why This Matters

Without ACP-first, each agent requires its own transport-specific integration — four separate code paths for spawning, streaming, cancellation, session management. ACP unifies these into one protocol surface. The native fallback ensures resilience when ACP is unavailable (missing binary, version mismatch, auth failure).

Uniform client-side schema validation prevents the "Codex gets server-side enforcement, everyone else gets client-side" bifurcation that compounds with every schema evolution.

The two-lane broker taxonomy prevents event namespace collisions between per-agent ACP frames and orchestration lifecycle facts. Without it, consumers subscribe to a flat namespace where `session_update` and `lifecycle_session_start` compete for attention.

Buffered emit prevents the startup race where `builder_stop` fires before the verifier loop dispatcher registers its listener — a silent failure that would break the Verifier Loop (Ship 4).

Auto-deny permission default is a security posture decision: non-interactive sessions should not grant agent permissions without explicit allowlist.

## When to Apply

- Building multi-agent orchestration systems where agents communicate through a broker
- Migrating from ad-hoc subprocess spawning to a standardized protocol
- Designing event taxonomies for pub/sub surfaces in agent systems
- Setting up fallback transport strategies for critical infrastructure
- Establishing observability before feature development begins
- Running council debates to resolve architectural disagreements among multiple stakeholders

## Examples

### Broker Event Taxonomy — Full Enumeration

```
broker.agents["claude"]  → session_update, permission_request, agent_error, agent_exit, adapter_available, adapter_degraded, adapter_failed
broker.agents["codex"]   → same events, separate EventEmitter instance
broker.agents["opencode"] → same events, separate EventEmitter instance
broker.events            → lifecycle_session_start, lifecycle_session_end, builder_stop, verifier_dispatch, verifier_report, dlq_message (internal), circuit_breaker_trip (internal)
```

### Adapter Availability Check

```
checkAvailability("claude") → { available: true, transport: "acp" }
checkAvailability("codex")  → { available: true, transport: "native", reason: "codex-acp adapter not installed" }
checkAvailability("opencode") → { available: false, reason: "opencode binary not found", setupCommand: "brew install opencode" }
```

### Phased Delivery with Metric Gates

Ship 1 establishes observability + single-agent fix. Ship 2 runs one full week of real usage to collect baseline metrics. Ship 3 readiness gated by committed thresholds:
- Task success rate floor = baseline_p25 - 5pp
- Synthesis latency p95 ceiling = baseline_p95 × 1.2
- Evidence-to-claim ratio floor = baseline_mean - 1σ
- Cancel reliability hard floor = 95%

### Council Debate Process

4-member council (claude moderator + 3 opencode debaters), 2 rounds run (round 3 skipped after architectural full-consensus), 10 divergence items resolved, 4 additional plan-text mandates surfaced during debate, PARTIAL CONSENSUS verdict with 3 dissenting opinions preserved as editorial-only.

## What Didn't Work (session history)

1. **Write tool parameter stripping** — Session `5f7e6589` suffered 50+ consecutive Write tool failures over ~2 hours while attempting to consolidate the earlier adapter-first plan. Agent tried explicit JSON formatting, simple payloads, even `/tmp/test-write.txt` (which succeeded). Root cause unknown — something in the session context was stripping Write parameters. User eventually interrupted.

2. **Research doc stale with factual errors** — `docs/research/acp-feasibility.md` contained 5 factual errors that contradicted its own plan. Agent flagged it as "stale" and rewrote it completely (-405 net lines).

3. **Context pruning** — Main session hit context pruning 6+ times. Team state was restored from `.claude/team-checkpoint.md` each time. Task list persisted across prunings.

4. **Bridgeswarm sessions failed** — Sessions `94f51856` (Scout) and `b1831186` (Coordinator) both failed immediately with 401 authentication errors. No substantive work produced.

## Prevention

- **Pin pre-1.0 packages with caret ranges** — `@^0.21.0` not `@latest`. Monitor for breaking changes before upgrading.
- **Validate research docs against primary sources** — The stale research doc contained 5 factual errors. Always verify against upstream documentation before building plans on top.
- **Use council debates for architectural reversals** — The shift from "adapter-first" to "ACP-first" was validated through a structured 4-member council with binding amendments. This prevents unilateral decisions on high-stakes architecture.
- **Establish observability before feature development** — The NDJSON emitter was mandated in Ship 1, not deferred. Baseline metrics are required before Ship 3 gates can be evaluated.
- **Buffer lifecycle events** — Any event that fires during startup before consumers register must buffer until the first listener attaches. This is a general pattern, not specific to this project.

## Related

- Migration plan: `docs/plans/2026-05-05-acp-migration-plan.md` (641+ lines)
- Research doc: `docs/research/acp-feasibility.md` (215 lines + 3 appendices, Phase 0 gate: PASS)
- Council decision: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/decision.md`
- Prior council (overridden): `debates/council/choreographer-acp-migration-plan-debate-a7f3e2/`
- ACP protocol reference: https://agentclientprotocol.com
- ACP TypeScript SDK: `@agentclientprotocol/sdk@0.21.0` (Apache-2.0)
- Related tooling bug: `docs/solutions/developer-experience/write-tool-empty-params-large-content-2026-05-05.md` (Write tool parameter stripping encountered during plan authoring)
- Codex adversarial review: `docs/reviews/codex-adversarial-2026-05-05/README.md` (Phase D fixes FF1/F6/F8)
- ce-code-review (9-persona): `docs/reviews/ce-adversarial/ship1-foundation-2026-05-05.md` (2 P0 + 10 P1 deferred pending security plan)
- Broker wiring lesson: `docs/solutions/architecture-patterns/broker-wiring-dead-code-prevention-2026-05-06.md` (verifying production callers exist before claiming a feature ships)
