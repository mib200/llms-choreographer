# Choreographer Migration Plan — ACP-First Revision

**Status**: revised 2026-05-05 after Phase 0 research + ACP protocol validation. Supersedes the council-debate draft.
**Mandate**: `/Users/mk/Repositories/mib200/AI/choreographer/debates/council/choreographer-acp-migration-plan-debate-a7f3e2/decision.md`
**Supersedes**: `docs/codex-appserver-migration-plan.md` (move to `docs/archive/`).
**ACP reference**: https://agentclientprotocol.com — protocol v1, `@agentclientprotocol/sdk` v0.21.0

---

## Context

The choreographer monorepo today invokes Codex via `spawn('codex', ['exec', prompt])` from `core/companion.mjs`. Codex is pinned as a SCOPE reviewer in a 1-round flat `Promise.all` "council" at `core/companion.mjs:45-84`. `/choreo:codex`, `/choreo:claude`, `/choreo:opencode` all silently route through this fake council — a documented deferred bug at `docs/project-overview-pdr.md:108`. There is no structured output, no thread resume, no streaming, no model or effort override, no adversarial path, no rescue path.

Meanwhile three external inputs shape the target:

1. **`@openai/codex-plugin-cc`** at `/Users/mk/Downloads/codex-plugin-cc-main/` demonstrates production Codex integration: JSON-RPC `app-server` with a shared broker daemon (`plugins/codex/scripts/app-server-broker.mjs`), structured `outputSchema` (`plugins/codex/schemas/review-output.schema.json`), thread resume, opt-in Stop-review gate hook, and a strong adversarial-review prompt template (`plugins/codex/prompts/adversarial-review.md`). No council.
2. **The global council skill** at `/Users/mk/.claude/skills/council/SKILL.md` (v1.9.12, 490 lines): 6-phase protocol with pre-flight dedup, rebuttals, anonymized synthesis, DEADLOCK veto, durable artifacts. Battle-tested elsewhere.
3. **The Pi Verifier pattern** demonstrated in Andy Devdann's YouTube video `EnXKysJNz_8` (April 2026): Builder + Verifier two-agent system with atomic-claim decomposition, mixed deterministic + LLM verification, feedback re-injection loop, narrow bash policy per verifier, stackable specialized verifiers. Materially more capable than the external plugin's simple single-reviewer Stop-review gate.
4. **The Agent Client Protocol (ACP)** at https://agentclientprotocol.com — a standardized JSON-RPC protocol for agent-client communication. All four target agents support ACP: Claude (via Zed SDK adapter), Codex (via Zed adapter), OpenCode (native), Gemini (native). Package: `@agentclientprotocol/sdk` v0.21.0.

**Goal**: converge these into a coherent migration that ships user-visible value early, uses ACP as the unified transport layer with native fallbacks, ports the global council protocol with a lean evolutionary subset, and adds a first-class **Verifier Loop** capability that replaces (not ports) the simple Stop-review gate.

**Explicit non-goals**: Pi.dev integration (separate plan), porting the external plugin's `gpt-5-4-prompting` skill, preserving `codex exec` as a code path once Ship 2 lands.

**Primary directive from council + user**: cross-agent parity over shipping Codex value fast.

---

## Overview of the 5 ships

| Ship | Contents | Why it goes here |
|---|---|---|
| **1** | `/choreo:codex` single-agent dispatch fix (~20 LoC) · `core/observability.mjs` NDJSON · Phase 0 research with hard success metrics as gate | Closes the deferred routing bug, gives users immediate UX win, establishes observability before anything else can ship |
| **2** | **ACP-first broker** + per-agent adapters (all agents speak ACP over stdio via `@agentclientprotocol/sdk`, with native transport fallbacks) + lifecycle hooks + **DLQ + idempotency + circuit-breaker mandatory** | Unified ACP IPC surface that Ships 3 and 4 piggyback on. The broker is an ACP client, not a protocol multiplexer. |
| **3** | Council port with evolutions A, B (best-effort for subprocess), E, G · `council.json` per-phase checkpoint · multi-bundle regression gate | Replaces the 1-round printer with real deliberation. A/B/E/G are safe additions; C/D defer; F dropped. |
| **4** | **Verifier Loop** — replaces the external-plugin Stop-review gate entirely | Multi-reviewer atomic-claim iteration on the Builder's Stop hook. Piggybacks on Ship 2 broker + Ship 3 structured-output contracts. |
| **5** | Adversarial review command + schema · retire `codex exec` code paths · docs + cleanup · archive `docs/codex-appserver-migration-plan.md` | Last mile. Adversarial review arrives late because Ship 4's Verifier Loop already exercises structured-schema-over-broker. |

---

## Phase 0 — Research & feasibility gates (blocking, part of Ship 1)

Before any adapter code. Deliver `docs/research/acp-feasibility.md`.

**Status: COMPLETE** (2026-05-05). All four transports researched. ACP protocol validated at https://agentclientprotocol.com with full documentation and TypeScript SDK (`@agentclientprotocol/sdk` v0.21.0).

1. **Claude ACP**: Confirmed. Primary ACP stdio path is `@agentclientprotocol/claude-agent-acp@0.32.0` (published by the ACP org; wraps Claude CLI in an ACP stdio server). Alternate native fallbacks: `@anthropic-ai/claude-agent-sdk@0.2.128` programmatic SDK (does NOT speak ACP — it is Anthropic's programmatic agent API), or CLI subprocess `claude --output-format stream-json --print`.
2. **Codex ACP**: Confirmed. Codex supports ACP via Zed's adapter (`github.com/zed-industries/codex-acp`). ACP stdio transport is the primary path. Native `codex app-server` JSON-RPC is the fallback.
3. **OpenCode ACP**: Confirmed. OpenCode natively supports ACP stdio transport. `opencode serve` HTTP API is the fallback.
4. **Gemini ACP**: Confirmed. Gemini CLI natively supports ACP stdio. Subprocess `gemini -y -m <model> -p "<prompt>"` is the fallback.

### ACP protocol summary

ACP is a JSON-RPC 2.0 protocol over stdio (primary) or Streamable HTTP (draft). Core message flow:
1. `initialize` — version negotiation + capability exchange
2. `session/new` — create session (with optional MCP server injection)
3. `session/prompt` — send user message
4. `session/update` notifications — streaming progress (agent messages, tool calls, plans)
5. `session/prompt` response — returns `StopReason` (`end_turn`, `cancelled`, `max_tokens`, etc.)
6. `session/cancel` — interrupt ongoing operations

Key capabilities: session load/resume, mode switching (ask/architect/code), MCP server injection, file system ops, terminal access, permission requests, slash commands.

### ACP vs Codex app-server feature gaps

| Feature | Codex app-server | ACP | Impact |
|---------|:---:|:---:|--------|
| Structured output (schema-enforced) | Yes (`outputSchema`) | No (prompt + parse client-side) | Must validate JSON client-side for council/verifier schemas |
| Code review turn | Yes (`review/start`) | No | Ship 5 adversarial review uses regular ACP prompt |
| BUSY/load management | Yes (broker-level) | No | Broker must implement queue/circuit-breaker |
| Mode switching | No | Yes (`session/set_mode`) | New capability — can set agent to "code" mode for coding tasks |
| MCP server injection | No | Yes (in `session/new`) | New capability — can inject MCP tools per session |
| Slash commands | No | Yes (advertise + execute) | New capability — agents can expose custom commands |
| Permission requests | App-level | Yes (`session/request_permission`) | ACP has richer permission model |

**Neither gap is a blocker.** Structured output is already handled client-side (same as Gemini today). BUSY/load management is already in the plan (DLQ + circuit-breaker).

### Hard success metrics (Phase 0 gate criteria)

The plan is blocked until these metrics are defined and instrumented:

- **Task success rate** — % of agent invocations that produce usable output (parsed structured result, no timeout, no auth failure)
- **Synthesis latency p95** — end-to-end wall time for `/choreo:council` invocation
- **Evidence-to-claim ratio** — for council and verifier outputs, proportion of claims that cite file + line
- **Cancel reliability** — % of mid-flight cancels that cleanly terminate the agent process
- **User selection rate** — which agent does the user actually pick when offered multiple (via `/choreo:council` `--members=...`)?

Instrumentation lives in `core/observability.mjs` (see Ship 1). Success-metric gate blocks Ship 2 from starting.

---

## Ship 1 — foundation (observability + single-agent fix + Phase 0)

### Files to create

- `core/observability.mjs` — NDJSON event emitter. Exports `emit(event)` and `rotate()`. Every adapter invocation, phase transition, broker request, verifier round emits structured events to `~/.choreo/logs/<date>.ndjson`. 7-day retention, 100 MB per-day cap, automatic rotation.
- `docs/research/acp-feasibility.md` — Phase 0 deliverable (see above).

### Files to modify

- `core/companion.mjs` — add a new `agent` subcommand: `companion.mjs agent --name=<claude|codex|opencode> [--model=...] [--effort=...] <task>`. Passes the task through unchanged; no role prompt; single agent dispatched via existing `runAgent()` in `core/runners.mjs`. No adapter layer yet — deliberately uses the subprocess path already proven by tests. **Gemini is excluded from Ship 1 per user lock — it lands in Ship 5+.**
- `plugin-claude/commands/codex.md` — change body from `companion.mjs council "$ARGUMENTS"` to `companion.mjs agent --name=codex "$ARGUMENTS"`.
- `plugin-claude/commands/claude.md` — same fix with `--name=claude`.
- `plugin-claude/commands/opencode.md` — same fix with `--name=opencode`.
- Mirror the three into `plugin-codex/skills/{codex,claude,opencode}/SKILL.md` and `plugin-opencode/.opencode/commands/choreo-{codex,claude,opencode}.md`. **No `/choreo:gemini` command in Ship 1** — Gemini locked to Ship 5+ per user directive.
- Update frontmatter descriptions so command name matches behavior ("Delegate a task to Codex" means delegate, not council).

### Verification (Ship 1 exit criteria)

1. `/choreo:codex "hello"` invokes Codex alone, not a council. Verified via `~/.choreo/logs/<date>.ndjson` showing exactly one `agent_invocation` event with `name=codex`.
2. Same for `/choreo:claude` and `/choreo:opencode`. `/choreo:gemini` does NOT exist in Ship 1 — introduced in Ship 5+.
3. `docs/research/acp-feasibility.md` contains per-agent verdicts and setup instructions.
4. `core/observability.mjs` emits events for at least one call on each agent; rotation tested; on-disk NDJSON validates against a shared event schema.
5. Hard success metrics are instrumented; baseline measurements recorded.

### Reuse

- `runAgent()` from `core/runners.mjs` (existing subprocess path, no change)
- `parseClaudeStreamJson`, `parseOpenCodeOutput` in `core/parsers.mjs`
- Fake-agent test harness `core/tests/helpers/fake-agents.mjs` extended to assert single-agent paths

---

## Ship 2 — ACP-first broker + per-agent adapters with native fallbacks

**Architectural framing**: the broker is an **ACP client** using `@agentclientprotocol/sdk`. It speaks ACP over stdio to all agents. Each adapter wraps its ACP stdio spawn logic and falls back to its native transport if ACP fails. This gives a unified protocol layer with resilience.

### ACP protocol lifecycle (broker responsibility)

The broker manages the full ACP lifecycle for each agent:
1. **Spawn** agent subprocess with ACP stdio transport
2. **Initialize** — `initialize` request with capabilities (`fs.readTextFile`, `fs.writeTextFile`, `terminal`)
3. **Authenticate** — `authenticate` if agent requires it
4. **Session management** — `session/new`, `session/load`, `session/resume`, `session/close`
5. **Prompt turns** — `session/prompt` with `session/update` streaming notifications
6. **Cancellation** — `session/cancel` notification
7. **Teardown** — kill subprocess, clean up resources

### Broker resilience (MANDATORY, per opencode1's validation flag)

The broker is not useful unless it survives partial failure. Required from day one:

- **Dead-letter queue** for failed verifier/agent messages (in-memory; surfaced to user via observability events)
- **Idempotency keys** on all requests so retries don't double-execute
- **Circuit-breaker** per adapter: N consecutive failures → adapter trips to degraded mode, availability probe required before re-enabling
- **Load queue** — ACP has no BUSY mechanism. Broker queues concurrent requests per agent and processes them sequentially. Queue depth surfaced via observability.

Without these the Verifier Loop (Ship 4) cannot trust the broker as its IPC surface.

### Per-agent adapter strategy

Each adapter follows the same pattern:
1. Try ACP stdio spawn → `initialize` → if success, use ACP for all operations
2. If ACP spawn fails or `initialize` fails → fall back to native transport
3. Report active transport via `checkAvailability()` → `{ available, transport: "acp" | "native", reason?, setupCommand? }`

| Agent | ACP stdio spawn (PRIMARY) | Native fallback | Notes |
|-------|----------------|-----------------|-------|
| **Claude** | `@agentclientprotocol/claude-agent-acp@0.32.0` (wraps Claude CLI in ACP stdio server; pinned in `package.json`) | `@anthropic-ai/claude-agent-sdk@0.2.128` programmatic API, OR CLI subprocess `claude -p --output-format stream-json` | ACP adapter is primary. SDK is alternate native fallback — it does NOT speak ACP. |
| **Codex** | `codex` binary with ACP stdio (via `codex-acp` Zed-maintained adapter) | `codex app-server` JSON-RPC over Unix socket | Native transport has `outputSchema`. **Council mandate: no auto-fallback to app-server for schema enforcement — uniform client-side validation for all agents.** |
| **OpenCode** | `opencode` binary with ACP stdio (native; primary path) | `opencode serve` HTTP API + SSE (invoked only when ACP stdio unavailable) | Reframed: `opencode serve` is fallback-only, not first-class onboarding. |

**Gemini: deliberately excluded from Ship 2 adapter scope.** Gemini ACP adapter lands in Ship 5+ per user lock. Rationale: prevent scope expansion before claude/codex/opencode ACP paths are proven + metrics-gated. Ship 5+ inclusion criteria documented in `docs/research/acp-feasibility.md` §Gemini.

### Files to create

- `core/agents/base.mjs` — `AgentAdapter` interface contract:
  ```
  invoke({prompt, model, effort, structuredSchema, timeout, onProgress, sandbox, resumeSessionId, mode})
    → {output, error, exitCode, structured?, sessionId?, transport: "acp"|"native"}
  checkAvailability() → {available, transport?, reason?, setupCommand?}
  supports: {streaming, structuredOutput, sessionResume, cancellation, background, modeSwitching, mcpInjection}
  ```
- `core/agents/acp-client.mjs` — **NEW** (Supersedes prior council kill-decision — under ACP-first, the shared client abstraction has 3 real consumers, not 1; the original kill-reason no longer holds). Shared ACP client using `@agentclientprotocol/sdk@^0.21.0`. Top-of-file comment pins resolved ACP SDK package name + version (`@agentclientprotocol/sdk@0.21.0`, `@agentclientprotocol/claude-agent-acp@0.32.0`). Handles:
  - Agent subprocess spawn with stdio transport
  - `initialize` / `authenticate` handshake
  - `session/new` / `session/load` / `session/resume` / `session/close`
  - `session/prompt` with `session/update` streaming
  - `session/cancel`
  - Structured output parsing (client-side JSON validation against schema) — uniform across all agents
  - Permission request handling: **auto-deny default in non-interactive contexts** (council mandate — security posture, not impl detail). Explicit allowlist overrides declared per-verifier / per-council-member.
- `core/agents/claude.mjs` — ACP stdio via `@agentclientprotocol/claude-agent-acp`. Fallback A: `@anthropic-ai/claude-agent-sdk` programmatic API. Fallback B: CLI subprocess `claude -p --output-format stream-json`.
- `core/agents/codex.mjs` — ACP stdio via Zed's `codex-acp` adapter. Fallback: `codex app-server` JSON-RPC (port from external plugin's `scripts/lib/app-server.mjs`). **No auto-fallback to app-server for schema enforcement**.
- `core/agents/opencode.mjs` — ACP stdio primary. Fallback: `opencode serve` HTTP API (invoked only when ACP stdio unavailable). Availability probe fails loud: `"opencode ACP stdio unavailable. Start HTTP fallback with: opencode serve &"`.
- `core/runtime/broker.mjs` — the daemon. Manages N ACP connections keyed by agent name. Includes:
  - ACP client lifecycle (spawn, init, session management, teardown)
  - Load queue (sequential processing per agent, no BUSY concept)
  - DLQ + idempotency + circuit-breaker
  - Unix socket endpoint for internal choreographer communication
  - **Two pub/sub surfaces (council mandate)**:

    **Convention**: `snake_case` for all event names (3-of-4 council consensus; 1-of-4 dissent on slash/colon recorded as non-load-bearing editorial).

    **Boundary rule**: ACP protocol frames → `broker.agents[name]`; orchestration decisions + lifecycle facts → `broker.events`. No wildcard bridging.

    **`broker.agents[name]`** — per-agent ACP client EventEmitter, one instance per agent name; disposed + recreated on each `lifecycle_session_start` (consumers must re-register listeners):

    | Event | Producers | Consumers |
    |---|---|---|
    | `session_update` | ACP stdio adapter (`core/agents/*.mjs`) | council phase machine (Ship 3), verifier loop dispatcher (Ship 4), observability NDJSON logger, transcript recorder |
    | `permission_request` | ACP stdio adapter | council phase machine, permission handler in `core/agents/acp-client.mjs` |
    | `agent_error` | ACP stdio adapter | observability, circuit-breaker logic |
    | `agent_exit` | ACP stdio adapter | lifecycle manager, broker session manager |
    | `adapter_available` | broker session manager | council phase machine (Ship 3) |
    | `adapter_degraded` | broker internal | observability, DLQ handler |
    | `adapter_failed` | broker internal | circuit-breaker, observability |

    - `session_update` NOT decomposed — payload discriminant `type` tells consumers what's inside (keeps broker ACP-schema-agnostic).
    - `session_close` + `session_cancel` consolidated into `agent_exit` with `reason: completed | cancelled | error`.

    **`broker.events`** — single internal EventEmitter:

    | Event | Producers | Consumers |
    |---|---|---|
    | `lifecycle_session_start` | `core/runtime/lifecycle.mjs` | observability, council phase machine |
    | `lifecycle_session_end` | `core/runtime/lifecycle.mjs` | observability, run summary |
    | `builder_stop` | `plugin-claude/scripts/verifier-stop-hook.mjs` | verifier loop dispatcher (Ship 4) |
    | `verifier_dispatch` | `core/verifier/loop.mjs` (Ship 4) | verifier composer (Ship 4), observability |
    | `verifier_report` | `core/verifier/loop.mjs` (Ship 4) | lifecycle manager, observability |
    | `dlq_message` *(internal)* | broker internal DLQ | observability, dead-letter handler |
    | `circuit_breaker_trip` *(internal)* | broker internal | observability, adapter health tracker |

    - Events annotated `(internal)` MUST NOT be subscribed by non-broker consumers (wrong abstraction layer).
    - Dropped from consideration: `lifecycle_transition` (redundant with explicit start/end); `run_error` (too vague; typed errors go on agent channel or in structured `verifier_report`).

    **Absent-consumer-at-emit-time contract**: `broker.events` uses **buffered emit with drain-on-first-listener** for `builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_session_start`, `lifecycle_session_end`. Node.js EventEmitter silently drops events with no listeners; buffering prevents startup races where the verifier loop dispatcher hasn't yet registered when `builder_stop` fires. Other events are fire-and-forget.

    **Minimal payload schemas**: each event carries a typed payload with a minimal field contract (not just a name). Examples: `builder_stop` → `{ session_id, agent_name, reason }`; `verifier_report` → `{ verifier_id, builder_run_id, round, status, ... }` matching Ship 4 report schema. Ship 2 defines exact JSON schemas; producer/consumer agreement is contract-tested.
  - Dependencies (pinned in root `package.json`): `@agentclientprotocol/sdk@^0.21.0`, `@agentclientprotocol/claude-agent-acp@^0.32.0`. Ship 2 pre-work includes `npm view` probe to verify resolved versions before install.
- `core/runtime/endpoint.mjs` — Unix socket on macOS/Linux; named-pipe-style on Windows. Reuse patterns from `plugins/codex/scripts/lib/broker-endpoint.mjs`.
- `core/runtime/lifecycle.mjs` — SessionStart / SessionEnd hook handlers. On SessionStart: spawn broker detached, inject `CHOREO_BROKER_ENDPOINT` + `CHOREO_SESSION_ID` + `CLAUDE_PLUGIN_DATA` into `$CLAUDE_ENV_FILE`. On SessionEnd: `broker/shutdown`, teardown.
- `core/parsers.mjs` extensions — `parseStructuredOutput(raw, schema)` — client-side JSON validation for ACP (since ACP doesn't enforce schemas).
- `plugin-claude/hooks/hooks.json` — register SessionStart, SessionEnd hooks. Stop hook registration is deferred to Ship 4 (Verifier Loop).
- `plugin-claude/scripts/lifecycle.mjs` — thin entrypoint → `core/runtime/lifecycle.mjs`.

### Files to modify

- `core/runners.mjs` — extend `REGISTRY` entries with an `adapter` key. `runAgent` delegates to `REGISTRY[name].adapter.invoke(...)` when adapter is defined; falls back to existing subprocess path otherwise. This lets Ship 1's `agent` subcommand opt into adapter behavior gradually.
- `core/companion.mjs` — `agent` subcommand starts honoring `--model`, `--effort`, `--resume`, `--mode` flags that adapters now support.

### Per-workspace state layout

Mirrors external plugin's shape (`plugins/codex/scripts/lib/state.mjs` + `workspace.mjs`):

```
<CLAUDE_PLUGIN_DATA>/state/<slug>-<sha256-16>/
├── state.json        # broker config, per-workspace settings (verifier toggles, gate toggles, autonomous defaults)
├── broker.json       # socket path, pid, log file
├── jobs/<job-id>.json
└── jobs/<job-id>.log
```

Cap jobs at 50, prune oldest.

### Verification

- Unit: `core/tests/runtime/*.test.mjs` round-trip a session/prompt against a fake ACP agent; DLQ test; idempotency test (same-key retry returns cached result); circuit-breaker test (N failures trip, probe re-enables); load queue test (concurrent requests processed sequentially).
- Per-adapter: `core/tests/agents/{claude,codex,opencode}.test.mjs`. Use fake fixtures (port `tests/fake-codex-fixture.mjs` from external plugin; build equivalents for others). Gemini adapter test lands in Ship 5+.
- Integration: open a Claude Code session, confirm `CHOREO_BROKER_ENDPOINT` exported, `ps | grep broker` shows daemon, SessionEnd cleanly tears down (no orphan process).
- ACP fallback: kill ACP stdio spawn for one agent, confirm it falls back to native transport and still produces output. Observability NDJSON shows `transport: "native"`.
- Hard success metrics from Phase 0 re-measured: task success rate, cancel reliability, etc. Must not regress vs Ship 1 baseline.

### Reuse

- `@agentclientprotocol/sdk` — ACP client implementation (`AgentSideConnection`, `ClientSideConnection`, `ndJsonStream`, types)
- `plugins/codex/scripts/app-server-broker.mjs` — broker skeleton, endpoint resolution (for Codex native fallback)
- `plugins/codex/scripts/lib/{app-server,broker-endpoint,broker-lifecycle,state,workspace}.mjs`
- `plugins/codex/scripts/session-lifecycle-hook.mjs` — session-env injection
- ACP example agent from SDK — reference implementation for stdio transport

---

## Ship 3 — council port with subset evolutions

Port the global council skill (`~/.claude/skills/council/SKILL.md` v1.9.12) with a lean evolutionary subset. Drop Evolution F entirely. Defer Evolutions C and D to post-Ship-5 increments — both change control flow and must wait until the base 6-phase protocol is stable in production.

### Evolutions in scope (KEEP)

- **A — Structured JSON positions**: every debater's opening, rebuttal, and final position is a JSON object matching a schema: `{recommendation, top_reasons[], risks_accepted[], wont_do[], confidence: 0-100, citations: [{file, line_start, line_end}]}`. Schema lives in `core/schemas/council-position.schema.json`. Parse failure → flag in Debate Summary; don't crash the council.
- **B — Evidence citations, best-effort for subprocess agents**: positions must cite file + line. Subprocess agents (Gemini; OpenCode when running through `opencode run` instead of `serve`) can't guarantee line-number precision — their citations are flagged as `precision: line-approx` in the schema. If Ship 3 post-launch measurement shows false-positive rate > threshold, demote Evolution B to advisory and revisit.
- **E — Minority position preservation**: if any member holds a position through Phase 3 Synthesis that the synthesis does NOT fully adopt, the final deliverable's `Remaining Disagreements` section preserves that minority view verbatim. Rule 5 made mechanical.
- **G — Structured JSON synthesis**: synthesis output is `{consensus, key_agreements[], resolved_debates[], remaining_disagreements[], confidence: "FULL"|"PARTIAL"|"DEADLOCK", debate_summary: {...}}`. Schema at `core/schemas/council-synthesis.schema.json`. Renderer converts to markdown for display.

### Evolutions deferred / dropped

- **C — Adaptive rounds**: deferred. Council stays at `--rounds=N` (default 3, clamp 1-5).
- **D — Adversarial round at round N-1**: deferred; adversarial review arrives as a standalone skill in Ship 5.
- **F — Cross-session `debates/_index.json`**: **dropped** (council consensus). Per-debate artifacts under `debates/council/<SLUG>/` already give durable history. Indexing is archival machinery before usage justifies it.

### Crash recovery: `council.json` per-phase checkpoint (unanimous gap adoption)

The broker persists its own state, but the council phase machine does not. A multi-round debate that loses its phase machine mid-flight is dead weight. Fix: write `debates/council/<SLUG>/council.json` on every phase transition recording `{phase, round, members, positions_collected_for_phase, generation}`. On `/choreo:council` invocation against an existing SLUG, detect interrupted council and prompt user: resume (replay from last checkpoint), restart from zero, or abort.

### Multi-bundle regression gate (unanimous gap adoption)

`core/companion.mjs` is bundled into three outputs by `scripts/bundle.mjs` — `plugin-claude/scripts/companion.mjs`, `plugin-codex/scripts/companion.mjs`, `plugin-opencode/dist/companion.mjs`. Every Phase 4/5 step that touches `companion.mjs` MUST be gated by:

1. `npm run bundle` regenerates all three outputs.
2. `npm run check-bundles` passes (no drift).
3. Smoke test `/choreo:council` through EACH bundled path, not just plugin-claude. One command per bundle, verified via observability NDJSON.

Without this gate, the council rewrite silently breaks Codex-hosted and OpenCode-hosted invocations.

### Files to modify / create

- `core/companion.mjs` `council` command (lines 47-84 today) — **rewrite**. Replace the fixed-role `Promise.all` with a 6-phase state machine:
  - Phase 0: Frame (parse flags, compute `<SLUG>`, init `debates/council/<SLUG>/`, write `council.json` phase=0)
  - Phase 0.25: Confirm launch plan via `AskUserQuestion` (or skip in `--non-interactive`)
  - Phase 0.5: Pre-flight clarifications with Question Routing
  - Phase 1: Opening positions in parallel (call adapters with structuredSchema pointing at council-position.schema.json)
  - Phase 2: Rebuttals up to `--rounds=N` with convergence check
  - Phase 3: Synthesis with always-on anonymization + parallel Synthesis-Validation + DEADLOCK-veto aggregation, producing JSON synthesis conforming to schema
  - Phase 4: Render JSON synthesis to markdown deliverable; write `debates/council/<SLUG>/decision.md` + `.json`
- Add flag parsing for `--members`, `--model=<member:model,...>`, `--claude-role={debater|moderator}`, `--rounds=<1..5>`, `--skip-preflight`, `--gemini-fallback=<model>`, `--non-interactive`. Preserve existing `--json`.
- `core/schemas/council-position.schema.json` — new.
- `core/schemas/council-synthesis.schema.json` — new.
- `plugin-claude/commands/council.md` — update argument-hint + description. Body unchanged (still delegates to `companion.mjs council "$ARGUMENTS"`).
- `plugin-codex/skills/council/SKILL.md` and `plugin-opencode/.opencode/commands/choreo-council.md` — update descriptions to match new flag surface.
- `plugin-claude/skills/choreo/SKILL.md` — update command catalog.
- Bug fix: clean up tempfiles with `.txt` extension (global skill line 462 has `.md` glob — port forward with the correct extension). Use `/tmp/choreo-council-*.txt` throughout.

### Non-interactive path (required for CI + sub-agent Bash + `--autonomous`)

When no TTY, `--non-interactive`, or autonomous mode is active: skip Phase 0.25 confirmation and Phase 0.5 clarifications. Use `"user did not specify — use your best judgment and state your assumption."` for every slot. Same for mid-debate Question Routing.

### Verification

- Integration: `/choreo:council --members=claude,codex --rounds=3 "Should we use Map or Object for this lookup?"` produces full deliverable, 3 rounds visible in `debates/council/<SLUG>/raw/phase-2-rebuttal-round-{1,2,3}/`.
- Moderator path: `/choreo:council --claude-role=moderator --members=claude,codex,gemini ...` exercises anonymized synthesis + DEADLOCK-veto validation.
- Gemini fallback: with gemini unavailable, skip probe drops gemini, runs with quorum. Confirmed via observability event.
- Crash recovery: kill council mid-Phase-2; re-invoke; confirm resume prompt fires.
- Non-interactive: `/choreo:council --non-interactive ...` runs end-to-end without any AskUserQuestion fires.
- Regression: `npm run check-bundles` green. `/choreo:council` invoked through plugin-codex bundle AND plugin-opencode bundle produces valid output.

### Reuse

- Protocol, prompt templates, anonymization rule, DEADLOCK aggregation, Gemini skip, durable artifact frontmatter: all from `~/.claude/skills/council/SKILL.md`.
- `requireAvailable`, `printDelimited`, `printJSON` from `core/runners.mjs`.

---

## Ship 4 — Verifier Loop (REPLACES the original Stop-review gate)

The Pi Verifier pattern from `https://youtu.be/EnXKysJNz_8` operationalized as a first-class choreographer capability. **Replaces** the simple Codex-reviews-Claude BLOCK/ALLOW gate from `@openai/codex-plugin-cc` — this is a strictly more capable feature, not a port.

### Concept

Builder (primary coding agent) writes code. On Builder's Stop hook:
1. One or more configured Verifiers kick off (parallel by default; optional sequential chains via `depends_on`).
2. Each Verifier decomposes the Builder's work into **atomic claims** — individual units of truth (e.g., "image file exists at path X", "size < N bytes", "schema has column Y", "no more than 10 text blocks in diagram").
3. Each claim is checked using **mixed methods**: deterministic (scripts, filesystem asserts, SQL probes) + non-deterministic (LLM judgment against rules).
4. Verifier emits a **structured report** (see schema below).
5. If any claim fails, the Broker injects targeted feedback into the Builder's next turn via Stop-hook BLOCK reason + file-based detail handoff.
6. Builder iterates.
7. Loop until **convergence** (all claims verified AND no improvement needed) OR **round cap** OR **oscillation escalation** OR **critical fork escalation**.

### Replaces the simple gate

The original plan's Ship 7b Stop-review gate is **dropped**. A single-reviewer BLOCK/ALLOW on every Stop event is strictly less capable than the Verifier Loop: the Loop handles the same trigger, but supports multi-reviewer lineups, structured atomic claims, re-prompt feedback (not just BLOCK reason), and stackable specialized verifiers. Shipping both would be duplicated surface area.

### Report schema (extends adversarial review schema)

`core/schemas/verifier-report.schema.json`:

```json
{
  "verifier_id": "sql-schema",
  "builder_run_id": "<uuid>",
  "round": 1,
  "status": "pass | fail | feedback | error",
  "confidence": 0.0,
  "verified_claims": [
    {"id": "c1", "claim": "users table has email index",
     "method": "deterministic", "evidence": "scripts/verify-schema.sh line 12 exit 0"}
  ],
  "failed_claims": [
    {"id": "c2", "claim": "no N+1 in listing",
     "method": "llm", "expected": "single JOIN",
     "actual": "for-loop at routes/list.mjs:12"}
  ],
  "couldnt_verify": [
    {"id": "c3", "claim": "p95 latency < 100ms",
     "reason": "no load harness available",
     "needed": "k6 script path"}
  ],
  "feedback_given": "string|null — sanitized, 2K char cap",
  "improvement_needed": "string|null — the flywheel field",
  "script_outputs": [
    {"script": "scripts/verify-schema.sh", "exit_code": 0, "stdout": "..."}
  ]
}
```

`atomic_claims[]` is **not** a separate top-level field — it is derived as the union of `verified_claims + failed_claims + couldnt_verify`. Keeps the schema flat.

The `improvement_needed` field is the **flywheel**. Periodically compacted into the verifier's system prompt by the compaction skill (see Mitigations below).

### IPC — piggyback the Ship 2 broker (NOT a separate Unix socket)

Verifiers register as named broker consumers `verifier:{id}`. Builder-completion fires as an NDJSON event on the broker stream. Verifier subscribes, runs, posts its report back as a broker event. One IPC surface → unified observability, single DLQ, single circuit-breaker. A separate Unix socket for verifier alone would duplicate the broker's connection-lifecycle code.

### Re-prompt mechanism — file + Stop-hook BLOCK

File-based handoff + Stop-hook BLOCK. On any `failed_claims[]` OR `improvement_needed != null` AND `round < max_rounds`:

1. Verifier writes `.choreographer/verifier/{id}/feedback-round-{n}.json` — the full report.
2. Builder's Stop hook checks for pending feedback files before exit.
3. If present, Stop hook emits a JSON envelope `{"decision":"block","reason":"<compact summary>"}` containing the summary; Claude receives it as a new turn.
4. Builder reads the full report from disk to get atomic-claim details.

No new slash command. Full audit trail in `.choreographer/verifier/`. Deterministic reconstruction of the loop from disk.

### Multi-verifier composition — PARALLEL default (user decision)

Three verifiers (`image-quality`, `sql-schema`, `accessibility`) at 30s each = 30s wall time, not 90s. Declare sequential chains explicitly via `depends_on`:

```yaml
verifiers:
  - id: sql-schema
    ...
  - id: api-contract
    depends_on: [sql-schema]   # runs only after sql-schema passes
```

**Conflict resolution**: when parallel verifiers disagree on the same claim ID, the composite report flags it in `couldnt_verify[]` with `reason: "conflict"` and lists both verdicts. In **non-autonomous mode**, user resolves. In **autonomous mode**, the conflict escalates as a critical fork.

### Narrow bash policy

Each verifier declares exactly ONE `allowed_script` path in its YAML. Broker wraps bash tool calls; rejects non-matching `argv[0]`. If a verifier genuinely needs multiple scripts → it becomes multiple named verifiers. Structurally enforces the video's "one agent, one prompt, one purpose" principle.

Plus declarative sandboxing per verifier:

```yaml
sandbox:
  allowed_tools: [sqlite3]
  max_runtime_sec: 30
  network: false
  filesystem: "readonly:artifacts/"
```

### Round cap + convergence

- Default cap: 3 rounds. Configurable per verifier via `max_rounds: N`.
- **Convergence**: all `failed_claims[]` empty AND `improvement_needed: null`.
- **Non-convergence at cap**: escalate to user with summary + delta between round 1 and round N + decision prompt (accept partial, extend cap, abort, rewrite goals).
- **Oscillation detection**: identical `failed_claims` set across 2 consecutive rounds → immediate escalate (no more rounds burned on ping-pong).

### Goal-definition assistant — core module + skill front-end (user decision)

Both surfaces. Module does the work; skill provides the user-invocable entry point.

**Core module** at `core/goal-assistant.mjs`:
- 3-phase interview:
  1. **Scope** — 3–5 questions: what the builder produces, what "done" means, what failure looks like.
  2. **Claim extraction** — converts answers into candidate atomic claims grouped by verifier type.
  3. **Output** — writes `.choreographer/goals.json` (machine-readable) + per-verifier system prompts to `.choreographer/verifier/{id}/system-prompt.md`.
- Invocable via `companion.mjs goals [--init | --verifier=<id>]`.
- Auto-triggers on first Verifier Loop invocation if `.choreographer/verifiers.yaml` exists but no goals yet.

**Skill front-end** at `.claude/skills/verifier-setup/SKILL.md`:
- User-invocable via `/verifier-setup` (Claude Code) or equivalent per host.
- Wraps the core module with the platform's question-asking primitive (AskUserQuestion on Claude Code, request_user_input on Codex, ask_user on OpenCode).
- Modeled after Claude's skill-builder — interactive multi-turn producing concrete files, not a chat summary.

**Goal sources (all four supported)**:
1. Per-verifier system prompt with rules baked in (the video's approach)
2. Plan file — read acceptance criteria from the active `docs/plans/<*>.md`
3. `goals.json` per task — structured `{goals: [{id, description, verify: 'reviewer-name|script'}]}`
4. Inline `--goal="..."` flag

Freeform mode always works — skill is optional help, not mandatory.

### Autonomous mode (user requirement)

Per-invocation `--autonomous` flag + per-repo default in `.choreographer/config.yaml`. In autonomous mode, LLM drives; user is pulled in ONLY at these critical forks:

1. **Plan deviation** — verifier wants to relax an acceptance criterion defined in the active plan file.
2. **Oscillation + exhausted alternates** — round cap hit, tried model swap + cap extension, still failing.
3. **Security-sensitive** — verifier attempts bash outside `allowed_script` allowlist, or filesystem write outside declared `sandbox.filesystem` scope. Hard wall; no autonomy override.
4. **Ambiguous fork** — verifier declines to pick between multiple viable interpretations.
5. **Budget caps** — `>N` tokens or `>M` minutes elapsed. Configurable. Soft wall.

Claim approval in autonomous mode: **skipped** when goal-assistant's `confidence >= threshold` (default 0.85, per-repo configurable). Below threshold: flag to user. `goals.json` is always written for post-hoc audit regardless.

### Design-concern mitigations (all baked into Ship 4)

- **Oscillation detection** — identical `failed_claims` 2 rounds → immediate escalate. Hard stop on builder-breaks-A-fixing-B ping-pong.
- **Claim-decomposition quality gate** — in non-autonomous mode, goal-definition assistant shows proposed claims for user approval. In autonomous mode, confidence threshold gate (default 0.85).
- **Feedback sanitization + 2K char cap** — verifier `feedback_given` strings pass through a sanitizer (strip imperative instructions masquerading as data, allowlist tokens, 2K-char cap) before the Builder's context sees them. Prevents verifier-to-builder prompt injection.
- **Flywheel prompt compaction** — periodic compaction of accumulated `improvement_needed` entries in verifier system prompts. Dedicated skill invocation at `.claude/skills/verifier-compact/SKILL.md`, modeled after the existing `/caveman:compress` skill. Prevents verifier prompts from bloating over time.

### Config schema — `.choreographer/verifiers.yaml`

```yaml
verifiers:
  - id: sql-schema
    description: "Validates schema against goals.json"
    model: codex/gpt-5.5              # optional, inherits adapter default
    system_prompt: .choreographer/verifier/sql-schema/system-prompt.md
    allowed_script: scripts/verify-schema.sh
    sandbox:
      allowed_tools: [sqlite3]
      max_runtime_sec: 30
      network: false
      filesystem: "readonly:artifacts/"
    parallel: true
    depends_on: []
    max_rounds: 3
    goal_sources: [goals.json, plan, inline]
    triggers: [builder_stop]
    confidence_threshold: 0.85
```

`triggers` is forward-compatible: future extensions (PR trigger, manual `/choreo:verify` trigger, scheduled trigger) slot in without schema breakage.

### Files to create

- `core/verifier/loop.mjs` — the phase machine: trigger detection, atomic-claim decomposition dispatch, broker event handling, re-prompt emission, round cap enforcement, oscillation detection, escalation routing.
- `core/verifier/sanitizer.mjs` — feedback sanitization (strip instructions, allowlist, 2K cap).
- `core/verifier/composer.mjs` — parallel/sequential composition, conflict detection.
- `core/goal-assistant.mjs` — 3-phase interview module.
- `core/schemas/verifier-report.schema.json` — the report schema.
- `core/schemas/goals.schema.json` — `goals.json` format.
- `plugin-claude/scripts/verifier-stop-hook.mjs` — Stop hook that emits BLOCK envelopes when `.choreographer/verifier/*/feedback-round-*.json` is present. Port shape from `plugins/codex/scripts/stop-review-gate-hook.mjs` with the BLOCK/ALLOW logic adapted for structured report inputs (not just first-line parse).
- `plugin-claude/commands/verifier-setup.md` — invocable skill command.
- `plugin-claude/commands/verify.md` — `/choreo:verify` for manual trigger (out of the builder_stop path).
- `.claude/skills/verifier-setup/SKILL.md` — skill front-end.
- `.claude/skills/verifier-compact/SKILL.md` — flywheel compaction skill.
- Mirror verifier-setup, verify, compact into `plugin-codex/skills/` and `plugin-opencode/.opencode/commands/`.

### Files to modify

- `plugin-claude/hooks/hooks.json` — register the new Stop hook (not the simple gate). Timeout 900s per external plugin's contract with Claude Code.
- `core/companion.mjs` — add `verify` subcommand (manual Verifier Loop trigger outside Stop hook) and `goals` subcommand (assistant invocation).
- `core/runtime/broker.mjs` — add `verifier:{id}` consumer registration + DLQ handling for verifier messages.

### Verification

- Config validation: `.choreographer/verifiers.yaml` parses; missing `allowed_script` rejects load; unknown `depends_on` rejects.
- Unit: `core/tests/verifier/*.test.mjs` — sanitizer strips instruction-like text; composer runs parallel vs sequential correctly; oscillation detector trips on identical failed_claims.
- Integration:
  1. Configure one verifier (image-quality) with a failing claim. Builder makes an edit, Stop fires, verifier runs, BLOCK emitted, Builder re-prompted with feedback, verifier passes on round 2, loop converges. Observability NDJSON shows all phases.
  2. Two parallel verifiers disagree on a claim → conflict flagged, user prompted (non-autonomous) or critical-fork escalated (autonomous).
  3. Goal assistant interview produces `goals.json` + per-verifier system-prompt files.
  4. Autonomous mode with low-confidence claim → user-gated approval fires; with high-confidence → silent accept.
  5. Autonomous + oscillation + exhausted alternates → user critical-fork escalation.
  6. Security violation: verifier attempts `bash -c rm -rf /` → broker hard-rejects, logged, user notified.

### Reuse

- Stop-hook shape + timeout contract: `plugins/codex/scripts/stop-review-gate-hook.mjs`
- Broker plumbing: Ship 2's `core/runtime/broker.mjs`
- Result-handling behavioral rule: `plugins/codex/skills/codex-result-handling/SKILL.md` — "After review, STOP. Do not fix." — port as a rule in `.claude/skills/verifier-setup/SKILL.md`
- Compaction skill shape: existing `/caveman:compress`

---

## Ship 5 — adversarial review + cleanup + retirement

Adversarial review lands last because Ship 4's Verifier Loop already exercises structured-schema-over-broker — the adversarial command reuses the same plumbing.

### Files to create

- `core/prompts/adversarial-review.md` — port verbatim from `/Users/mk/Downloads/codex-plugin-cc-main/plugins/codex/prompts/adversarial-review.md`. Substitutions: `{{TARGET_LABEL}}`, `{{USER_FOCUS}}`, `{{REVIEW_COLLECTION_GUIDANCE}}`, `{{REVIEW_INPUT}}`.
- `core/schemas/review-output.schema.json` — port verbatim from `plugins/codex/schemas/review-output.schema.json`. Strict: `verdict ∈ {approve, needs-attention}`, `findings[]` with `severity ∈ {critical, high, medium, low}`, `confidence 0..1`.
- `core/git.mjs` — port `collectReviewContext` from `plugins/codex/scripts/lib/git.mjs`. Working-tree and branch modes, 256 KB inline-diff cap, 24 KB per-untracked-file cap, self-collect fallback guidance.
- `core/review-render.mjs` — port `renderReviewResult` from external plugin.
- `plugin-claude/commands/adversarial-review.md` — `disable-model-invocation: true`. Allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion. Invokes `companion.mjs adversarial-review "$ARGUMENTS"`. Flags: `--wait|--background|--base <ref>|--scope auto|working-tree|branch <focus text>`.
- Mirror into `plugin-codex/skills/adversarial-review/SKILL.md` and `plugin-opencode/.opencode/commands/choreo-adversarial-review.md`.

### Files to modify

- `core/companion.mjs` — add `adversarial-review` subcommand. Loads template + schema, interpolates, calls Codex adapter with `structuredSchema: review-output.schema.json`, `sandbox: 'read-only'`, `approvalPolicy: 'never'`. Returns structured JSON rendered via `renderReviewResult`.
- Update `plugin-{claude,codex,opencode}/skills/choreo/SKILL.md` and relevant README/docs to describe the adversarial flow.

### Cleanup / retirement

- Remove `codex exec` code paths from `core/companion.mjs` and `core/runners.mjs`. All Codex calls go through the ACP adapter (with app-server fallback).
- Similarly retire direct `claude --print`, `opencode run` subprocess spawns in the council / adversarial / verifier paths. Adapter boundary is mandatory for multi-agent code.
- Move `docs/codex-appserver-migration-plan.md` → `docs/archive/codex-appserver-migration-plan.md` with a top-of-file note redirecting to this plan.
- Delete `parseClaudeStreamJson` + `parseOpenCodeOutput` exports from `core/parsers.mjs`; retain `parseStructuredOutput` only. Legacy stdout parsers are dead code once subprocess fallbacks retire.
- Update `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md`, `docs/delegation.md` to describe the ACP-first broker + council + Verifier Loop architecture.
- Update `CLAUDE.md` / `AGENTS.md` to include a note on the ACP broker + Verifier Loop entry points.
- Extend `core/tests/helpers/fake-agents.mjs` with a fake ACP agent fixture (mirror SDK's `examples-agent.ts`) so existing tests run unchanged against the new transport.
- Final bundle pass: `npm run bundle && npm run check-bundles`.

### Verification

- `/choreo:adversarial-review` on a real diff in the repo returns structured JSON parsed + rendered by severity, `verdict ∈ {approve, needs-attention}`, each finding cites file + line_start + line_end + confidence + recommendation.
- `/choreo:adversarial-review --scope=branch --base=main` produces base-branch-scope merge-base diff.
- `grep -r "codex exec" core/` returns no results in production paths.
- `git log --follow docs/archive/codex-appserver-migration-plan.md` shows the move.
- End-to-end smoke: fresh clone → `npm install` → `npm run bundle` → `npm test` → start Claude Code in repo → run `/choreo:codex`, `/choreo:council`, `/choreo:adversarial-review`, and trigger a Verifier Loop → confirm each uses the adapter layer via `state.json.jobs`.

---

## Preserved disagreements (per council Rule 5 — honest synthesis)

The council reached PARTIAL CONSENSUS. These disagreements are carried forward into the plan so future decisions can revisit them with empirical evidence rather than re-litigate.

1. **Broker timing** — opencode1 and opencode3 held that the broker should extract later, only after telemetry proves multi-agent contention is a real problem. The final plan ships it in Ship 2 so the council (Ship 3) and Verifier Loop (Ship 4) can piggyback on it. **Re-check after Ship 2**: if multi-agent invocation volume is below a threshold that would benefit from multiplexing, consider whether the broker added value proportional to its infrastructure cost.

2. **Evolution B precision for subprocess agents** — opencode1, opencode3, opencode4 wanted Evolution B dropped entirely because subprocess agents can't guarantee line-number precision. Others kept it best-effort. **Demotion clause**: if Ship 3 post-launch measurement shows a false-positive rate on subprocess-agent citations above a threshold (to be defined at Phase 0), demote Evolution B to advisory-only (positions no longer required to cite).

3. **Verifier Loop ship timing** — opencode5 strongly argued for Ship 1 ("killer app"). User-confirmed Ship 4 to leverage broker + structured-output infrastructure. **If Ship 1 post-launch shows users are ignoring the single-agent fix and asking for review capabilities immediately**, consider pulling a simpler Verifier Loop variant forward.

4. **Council port scope** — opencode1 and opencode3 held "verbatim v1.9.12, zero evolutions in Ship 3." Final plan includes A, B (best-effort), E, G. **Retreat clause**: if Ship 3 reveals that any of A/B/E/G destabilizes the council (test flakiness, user complaints, schema parse failures), demote that specific evolution to a follow-up increment and ship the base protocol alone.

5. **opencode serve mandate strictness** — opencode4 wanted the mandate scoped to OpenCode-backed features only. Final plan is whole-system fail-loud with no silent subprocess fallback. **Revisit** if Phase 0 + Ship 2 show that forcing OpenCode-serve setup is blocking more users than it helps.

---

## Unanimous gaps adopted

All 5 unanimous-across-debaters gaps are baked into the ship where they belong:

| Gap | Ship | Where |
|---|---|---|
| `core/observability.mjs` NDJSON structured logs | 1 | Foundation |
| Hard success metrics as Phase 0 gate | 1 | Phase 0 deliverable |
| `council.json` per-phase checkpoint | 3 | Council crash recovery |
| Multi-bundle regression verification | 3 and beyond | Gate on every `companion.mjs` change |
| Broker DLQ + idempotency + circuit-breaker | 2 | Broker resilience (mandatory) |

---

## Critical files summary

**Will be created**:
- `core/agents/{base,acp-client,claude,codex,opencode}.mjs` (Ship 5+ adds `gemini.mjs`)
- `core/runtime/{broker,endpoint,lifecycle}.mjs`
- `core/verifier/{loop,sanitizer,composer}.mjs`
- `core/goal-assistant.mjs`
- `core/observability.mjs`
- `core/git.mjs`
- `core/review-render.mjs`
- `core/prompts/adversarial-review.md`
- `core/schemas/{council-position,council-synthesis,verifier-report,goals,review-output}.schema.json`
- `plugin-claude/commands/{adversarial-review,verifier-setup,verify}.md` (Ship 5 also adds `gemini.md` as part of Gemini adapter introduction)
- `plugin-claude/hooks/hooks.json`
- `plugin-claude/scripts/{lifecycle,verifier-stop-hook}.mjs`
- `plugin-codex/skills/{adversarial-review,verifier-setup,verify}/SKILL.md` (Ship 5+ adds gemini skill)
- `plugin-opencode/.opencode/commands/choreo-{adversarial-review,verifier-setup,verify}.md` (Ship 5+ adds choreo-gemini)
- `.claude/skills/verifier-setup/SKILL.md`
- `.claude/skills/verifier-compact/SKILL.md`
- `docs/research/acp-feasibility.md`

**Will be modified**:
- `core/companion.mjs` — council rewrite, agent/adversarial-review/verify/goals subcommands
- `core/runners.mjs` — adapter registry
- `core/parsers.mjs` — add `parseStructuredOutput`
- `plugin-claude/commands/{codex,claude,opencode,council}.md`
- `plugin-codex/skills/{codex,claude,opencode,council}/SKILL.md`
- `plugin-opencode/.opencode/commands/choreo-{codex,claude,opencode,council}.md`
- `plugin-claude/skills/choreo/SKILL.md`
- `docs/{system-architecture,codebase-summary,project-overview-pdr,delegation}.md`
- `CLAUDE.md` / `AGENTS.md`

**Will be retired**:
- `docs/codex-appserver-migration-plan.md` → `docs/archive/`
- `core/parsers.mjs` legacy exports (`parseClaudeStreamJson`, `parseOpenCodeOutput`) → deleted after Ship 5 subprocess fallback retirement; only `parseStructuredOutput` remains.
- `codex exec` direct-spawn paths in `core/companion.mjs` + `core/runners.mjs`

---

## Reuse inventory (don't reinvent)

From `@agentclientprotocol/sdk` (npm, v0.21.0):
- Core protocol: `AgentSideConnection`, `ClientSideConnection`, `ndJsonStream`
- Type definitions: all ACP types from OpenAPI spec (`types.gen.ts`)
- Example agent: minimal stdio agent implementation (`examples-agent.ts`)
- Example client: minimal client implementation (`examples-client.ts`)

From https://agentclientprotocol.com (protocol documentation):
- Initialization flow, capability negotiation, version negotiation
- Session lifecycle: `session/new`, `session/load`, `session/resume`, `session/close`
- Prompt turn lifecycle with `session/update` streaming notifications
- Tool call reporting, permission requests, cancellation
- MCP server injection, mode switching, slash commands
- 30+ ACP-compatible agents list

From `/Users/mk/Downloads/codex-plugin-cc-main/plugins/codex/`:
- Broker pattern, endpoint resolution: `scripts/app-server-broker.mjs`, `scripts/lib/{app-server,broker-endpoint,broker-lifecycle}.mjs` (for Codex native fallback)
- Workspace-state layout: `scripts/lib/{state,workspace}.mjs`
- Session-env injection: `scripts/session-lifecycle-hook.mjs`
- Adversarial prompt + schema: `prompts/adversarial-review.md`, `schemas/review-output.schema.json`
- Review context collection: `scripts/lib/git.mjs`
- Structured-output parsing + rendering: `scripts/lib/codex.mjs`
- Stop-hook shape + timeout contract: `scripts/stop-review-gate-hook.mjs` (NOT the logic — the logic is replaced by the Verifier Loop)
- Result-handling behavioral rule: `skills/codex-result-handling/SKILL.md`
- Fake CLI fixture: `tests/fake-codex-fixture.mjs`

From `~/.claude/skills/council/SKILL.md` (v1.9.12):
- 6-phase protocol (Frame, Confirm, Pre-flight, Opening, Rebuttals, Synthesis, Present) + Cleanup
- Member Invocation Recipes (codex / gemini / opencode flag sets)
- Question Routing heuristic with 2-loop cap
- Always-on anonymization before synthesis (shuffle + relabel)
- Parallel Synthesis-Validation with DEADLOCK-veto aggregation
- Gemini retry + fallback + skip probe (lines 203-234)
- Durable artifact layout under `debates/council/<SLUG>/` with per-file frontmatter
- Final Council Decision deliverable template

From the video (Andy Devdann's Pi Verifier agent):
- Builder + Verifier pattern triggered on Stop hook
- Atomic-claim decomposition (one claim = one provable unit)
- Mixed deterministic + non-deterministic verification
- Structured report with `improvement_needed` flywheel
- Narrow bash policy per verifier
- Multiple specialized verifiers stack ("one agent, one prompt, one purpose")
- Template-engineering-as-habit (rules into system prompts, not one-off)

From the existing choreographer repo:
- `parseClaudeStreamJson`, `parseOpenCodeOutput` in `core/parsers.mjs`
- `requireAvailable(agents, 2)` quorum in `core/runners.mjs`
- `printDelimited` / `printJSON` in `core/runners.mjs`
- Fake-agent test harness `core/tests/helpers/fake-agents.mjs`
- Bundle infra `scripts/bundle.mjs`, `npm run check-bundles`

---

## Flagged risks

1. **ACP stdio spawn stability per agent is uneven.** Each adapter's availability probe must return a clear `{available, transport, reason, setupCommand}` result so the council run degrades gracefully. A `--transport=auto|acp|native` override per agent for debugging is recommended. Ship 1 defines this shape.
2. **Broker resilience must be present at first use.** DLQ + idempotency + circuit-breaker + load queue are not nice-to-have; Ship 2 is gated on them.
3. **`opencode serve` reframed as fallback-only** (council mandate). Primary OpenCode path is ACP stdio; `serve` invoked only when ACP spawn fails. Availability probe fails loud with exact setup command when ACP stdio is unavailable. README + `/choreo:opencode` command copy says "`opencode serve` required only when ACP stdio unavailable."
4. **Stop-hook timeout is 900 seconds (Claude Code's max).** Verifier Loop cannot exceed this or it will silently time out. Per-verifier `max_runtime_sec` × `max_rounds` must budget under 900s.
5. **Non-interactive council runs** (from CI, from sub-agent Bash tools, from `--autonomous`) must skip Phase 0.25 and Phase 0.5 explicitly. Not a bug — a deliberate design.
6. **Bundle drift** — every change to `core/` must be rebundled into all three plugin targets. `npm run check-bundles` is wired; CI must enforce it. Already a Ship-3-onward verification gate.
7. **Prompt-injection via verifier feedback** — sanitizer + 2K cap is mandatory before the Builder's context sees verifier text. Do not ship Ship 4 without `core/verifier/sanitizer.mjs` unit tests passing.
8. **Oscillation escalation path** must not deadlock itself. Oscillation detection → escalate → user (or autonomous critical-fork) → if user says "extend," round cap extends; if exhausted alternates are also consumed, final escalation must terminate the loop cleanly.
9. **ACP structured output gap** — ACP doesn't enforce JSON schemas. Council positions and verifier reports must be prompted to emit JSON and validated client-side. Parse failures must be handled gracefully (flag in summary, don't crash).
10. **`@agentclientprotocol/sdk` is a new dependency** (v0.21.0). Pin version. Monitor for breaking changes. Fallback to native transports if SDK breaks.

---

## Ship ordering & gates

| Ship | Gates before start | Gates before complete |
|---|---|---|
| 1 | None | Phase 0 feasibility doc complete; hard success metrics baseline recorded; single-agent fix shipping through all 3 plugin bundles |
| 2 | Ship 1 complete; Phase 0 gate green | Broker resilience (DLQ + idempotency + circuit-breaker) unit-tested; per-adapter availability probes + fake fixtures passing; SessionStart/SessionEnd lifecycle round-trip |
| 3 | Ship 2 complete; `npm run check-bundles` green | Full council invocable via all 3 bundles; `council.json` crash recovery exercised; evolutions A/B/E/G schemas validated |
| 4 | Ship 3 complete; Verifier Loop can piggyback broker | Verifier config parses, sandbox enforced, sanitizer unit tests green, oscillation detection triggers correctly, autonomous-mode critical-fork routing exercised |
| 5 | Ship 4 complete | Adversarial review produces structured JSON; `codex exec` fully retired from production paths; docs refreshed; old migration plan archived |

---

## GitNexus safety discipline

Per `CLAUDE.md`, before editing each of these existing symbols run `gitnexus_impact({target, direction: "upstream"})` and report blast radius to the user:

- `core/companion.mjs` — `council`, `review`, `debug`, `second-opinion`, `vote` commands; will be extended with `agent`, `verify`, `goals`, `adversarial-review` subcommands
- `core/runners.mjs` — `REGISTRY`, `runAgent`, `requireAvailable`, `filterAvailable`, `printDelimited`, `printJSON`
- `core/parsers.mjs` — `parseClaudeStreamJson`, `parseOpenCodeOutput`

Do not skip this step — `companion.mjs` has 3 bundled copies downstream, so every change has guaranteed non-trivial impact.

Before every commit: `gitnexus_detect_changes()` to confirm the change set matches the phase being shipped.

---

## Audit trail

- Debate artifacts (preserved forever): `/Users/mk/Repositories/mib200/AI/choreographer/debates/council/choreographer-acp-migration-plan-debate-a7f3e2/`
- Decision doc: `debates/council/choreographer-acp-migration-plan-debate-a7f3e2/decision.md` (final Council Decision, PARTIAL CONSENSUS)
- Synthesis doc: `debates/council/choreographer-acp-migration-plan-debate-a7f3e2/synthesis.md` (anonymized merge)
- Session memory: `/Users/mk/.claude/projects/-Users-mk-Repositories-mib200-AI-choreographer/memory/project_session_choreographer_acp_migration_council.md`
- Phase 0 ACP research: `docs/research/acp-feasibility.md` (transport contracts for all 4 agents + ACP protocol validation)
- ACP protocol reference: https://agentclientprotocol.com (authoritative; TypeScript SDK: https://github.com/agentclientprotocol/typescript-sdk). No local copy required.
- Superseded draft: original version of this file, captured in git history before this revision




