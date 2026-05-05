# Phase 0 — ACP Transport Feasibility Research

**Date**: 2026-05-05
**Status**: Rewritten per council decision `acp-migration-critical-review-plan-debate-b8d4c1`. Supersedes prior "adapter-interface-first" draft.
**Blocks**: Ship 2 implementation start (Ship 1 code is transport-independent and may proceed in parallel).
**Plan ref**: `docs/plans/2026-05-05-acp-migration-plan.md`
**Council decision**: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/decision.md`
**Council synthesis**: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/synthesis.md`

---

## Executive Summary

The **Agent Client Protocol (ACP)** is a standardized JSON-RPC 2.0 protocol over stdio for agent-client communication. All four choreographer agents have first-class ACP integration paths. ACP is the primary transport; native per-agent transports are fallbacks when ACP probe fails or the adapter is unavailable.

Protocol reference: <https://agentclientprotocol.com>. TypeScript SDK: `@agentclientprotocol/sdk@0.21.0`.

| Agent | ACP Primary Path | Native Fallback | Structured Output | Streaming | Session Resume | Cancellation |
|-------|------------------|-----------------|-------------------|-----------|----------------|--------------|
| **Claude** | `@agentclientprotocol/claude-agent-acp@0.32.0` (wraps Claude CLI in ACP stdio server) | `@anthropic-ai/claude-agent-sdk@0.2.128` programmatic SDK OR CLI subprocess `claude -p --output-format stream-json` | Client-side via `parseStructuredOutput(raw, schema)` | ACP `session/update` notifications | ACP `session/load` + `session/resume` | ACP `session/cancel` |
| **Codex** | ACP stdio via `codex-acp` adapter (Zed-maintained) | `codex app-server` JSON-RPC over Unix socket (native `outputSchema` available) | Client-side; **no auto-fallback** to app-server `outputSchema` (council-decided uniformity) | JSONL notifications (native) / `session/update` (ACP) | ACP `session/load` (primary) / `thread/resume` (native) | `session/cancel` / `turn/interrupt` |
| **OpenCode** | ACP stdio (native) | `opencode serve` HTTP API + SSE (invoked only if ACP spawn fails) | Client-side | SSE / `session/update` | ACP `session/load` / persistent HTTP sessions | `session/cancel` / `POST /session/:id/abort` |
| **Gemini** | ACP stdio (native CLI support — **Ship 5+ only per user lock**) | Subprocess `gemini -y -m <model> -o json -p "<prompt>"` | Client-side (no schema enforcement) | JSONL stdout / `session/update` | None (subprocess) / ACP `session/load` | SIGTERM / `session/cancel` |

**Hard constraint**: Gemini is **locked to Ship 5+** per user directive. It does NOT appear in Ship 1 REGISTRY, `/choreo:gemini` command, or Ship 2 adapter table. The lock prevents scope expansion before claude/codex/opencode ACP paths are proven + metrics-gated.

**Schema enforcement strategy** (council-decided, unanimous): uniform client-side validation via `parseStructuredOutput(raw, schema)` for ALL agents regardless of transport. No auto-fallback to Codex native `outputSchema`. Bifurcated validation would compound maintenance surface with every schema evolution; uniformity wins over the reliability gain.

---

## ACP Protocol Reference

Source: <https://agentclientprotocol.com> (protocol version 1). TypeScript SDK: `@agentclientprotocol/sdk@0.21.0` (Apache-2.0, maintained by the ACP org).

### Transport

JSON-RPC 2.0 over stdio (primary). Streamable HTTP in draft. Each agent is spawned as a subprocess with piped stdin/stdout; messages framed as newline-delimited JSON.

### Lifecycle

1. **`initialize`** — client sends `{ protocolVersion, clientCapabilities }`; agent replies `{ protocolVersion, agentCapabilities, authMethods? }`. Version + capability negotiation.
2. **`authenticate`** — invoked when agent advertises auth methods. Agent returns auth state.
3. **`session/new`** — client requests a new session with `{ cwd, mcpServers?, mode? }`. Agent returns `{ sessionId }`. MCP servers can be injected at session creation.
4. **`session/load`** — client requests resume of a prior session by `sessionId`.
5. **`session/prompt`** — client sends user message; agent returns `{ stopReason }` after processing. Streaming updates flow via `session/update` notifications.
6. **`session/update`** (notification, agent → client) — streaming progress. Types include user/agent message chunks, tool calls, plans, permission requests, mode changes.
7. **`session/request_permission`** (request, agent → client) — agent asks for permission to perform a sensitive action. Client responds with allow/deny. **Council mandate: non-interactive choreographer sessions auto-deny by default; allowlist overrides declared per-verifier / per-council-member.**
8. **`session/cancel`** (notification, client → agent) — interrupt.
9. **`session/set_mode`** — agent supports `ask | architect | code` modes; switched mid-session.
10. **`fs/read_text_file`, `fs/write_text_file`, `terminal/*`** (requests, agent → client) — agent requests file operations or terminal access from the client.

### StopReason (from `session/prompt` response)

- `end_turn` — normal completion
- `max_tokens` — context budget exhausted
- `max_turn_requests` — too many tool-call iterations
- `refusal` — agent declined
- `cancelled` — client cancelled mid-turn

### Capability exchange (`initialize`)

- `clientCapabilities`: `{ fs: { readTextFile, writeTextFile }, terminal }`
- `agentCapabilities`: `{ loadSession, promptCapabilities, mcpCapabilities, authMethods, modes? }`

### SDK classes

- `AgentSideConnection` — for agent authors (not used by choreographer directly).
- `ClientSideConnection` — for client authors (this is the class the choreographer broker wraps per-agent).
- `ndJsonStream` — helper for reading/writing newline-delimited JSON.

Example agent: <https://github.com/agentclientprotocol/typescript-sdk> (`examples-agent.ts`). Example client: `examples-client.ts`.

---

## ACP vs Codex app-server Feature Comparison

Codex has a native `app-server` JSON-RPC protocol that predates its ACP adapter. Under ACP-first, Codex connects via `codex-acp` adapter and client-side schema validation is applied uniformly. Native `app-server` remains the fallback.

| Feature | Codex app-server (native) | ACP | Council decision |
|---------|:---:|:---:|---|
| Structured output (schema-enforced) | Yes (`outputSchema`) | No (client-side parse against schema) | Uniform client-side validation for all agents. No Codex auto-fallback. |
| Code review turn | Yes (`review/start`) | No | Adversarial review (Ship 5) uses regular ACP `session/prompt`. |
| BUSY/load management | Yes (broker-level) | No | Broker implements load queue + DLQ + idempotency + circuit-breaker (mandatory from Ship 2). |
| Mode switching | No | Yes (`session/set_mode`) | ACP-only capability; used for Ship 3 council roles + Ship 4 verifier modes. |
| MCP server injection | No | Yes (`session/new` param) | ACP-only; used for per-verifier tool injection. |
| Slash commands | No | Yes (advertise + execute) | Lower priority; revisit post-Ship-4. |
| Permission requests | App-level | Yes (`session/request_permission`) | ACP permission protocol used; default auto-deny per council mandate. |

**Gaps are not blockers.** Structured output is already handled client-side. BUSY/load management is in the Ship 2 broker spec.

---

## Per-Agent ACP Setup

### Claude

**Primary ACP path**: `@agentclientprotocol/claude-agent-acp@0.32.0`.

Package npm-verified: Apache-2.0, 19 versions, depends on `@agentclientprotocol/sdk@0.21.0`, `@anthropic-ai/claude-agent-sdk@0.2.126`, and `zod`. Ships the `claude-agent-acp` binary. Published by the ACP organization (continuity of maintenance established via the `@zed-industries/claude-code-acp` → `@agentclientprotocol/claude-agent-acp` transfer).

**Install + run**:
```bash
npm install @agentclientprotocol/claude-agent-acp
# Broker spawns: claude-agent-acp  (stdio server)
```

**Known gaps vs native**:
- Session resume semantics: ACP `session/load` is documented but the Claude adapter's mapping to Claude CLI session state is not yet independently verified. `@anthropic-ai/claude-agent-sdk` offers `threadId`-based resume via its own API. Treat as a Ship 2 implementation risk; validate via integration test before declaring Ship 2 complete.
- `@anthropic-ai/claude-agent-sdk@0.2.128` is Anthropic first-party (175 versions, actively maintained by the Anthropic team). It is the **alternate native fallback** alongside CLI subprocess. It does NOT itself speak ACP — it is a programmatic SDK.

**Availability probe**: spawn `claude-agent-acp` + send `initialize`. If spawn fails or `initialize` times out → fall back to SDK then to CLI subprocess.

### Codex

**Primary ACP path**: `codex-acp` (Zed-maintained adapter, repo `github.com/zed-industries/codex-acp` mirrored at `github.com/agentclientprotocol/codex-acp`). Spawns Codex CLI wrapped in ACP stdio.

**Native fallback**: `codex app-server` JSON-RPC over Unix socket. The external `@openai/codex-plugin-cc` plugin demonstrates this transport in production. Broker code at `/Users/mk/Downloads/codex-plugin-cc-main/plugins/codex/scripts/app-server-broker.mjs`.

**Known gaps**:
- Codex native path supports `outputSchema` on `turn/start` for server-side schema enforcement. ACP does not. **Council-decided**: no auto-fallback; uniform client-side validation regardless of transport.
- Codex app-server BUSY semantics (one active request per socket) are native-only. Under ACP the broker load queue handles the equivalent.

**Availability probe**: `codex --version` + `codex-acp --help` (if installed). If ACP adapter missing → fallback to `codex app-server` via broker endpoint resolution (Unix socket / named pipe).

### OpenCode

**Primary ACP path**: OpenCode CLI natively supports ACP stdio transport per OpenCode docs.

**Native fallback**: `opencode serve --port 4096` HTTP API + SSE. Fail-loud availability probe — serve is required only when ACP stdio is unavailable; the primary path is ACP stdio.

Homebrew binary at `/opt/homebrew/Cellar/opencode/1.14.33/bin/opencode` (verified Ship 0 inventory). `@opencode-ai/sdk` is the HTTP client library.

**Known gaps**:
- HTTP path offers session persistence beyond process lifetime. ACP session persistence via `session/load` + agent-side storage is model-dependent.
- `opencode serve` mandate: reframed (council mandate) as fallback-only. Plan README + `/choreo:opencode` command copy must say "serve is required when ACP stdio unavailable," not first-class onboarding.

**Availability probe**: spawn `opencode acp` (or equivalent native ACP entry) + `initialize`. If fails → check `opencode serve` health endpoint at `http://[::]:4096/global/health`. If both fail → fail loud with setup command.

### Gemini

**Primary ACP path**: Gemini CLI natively supports ACP stdio per Gemini docs. **Not exercised in choreographer until Ship 5+** per user lock.

**Native fallback**: subprocess `gemini -y -m <model> -o json -p "<prompt>"`.

Binary at `/Users/mk/.volta/bin/gemini` (version 0.37.1 verified Ship 0 inventory).

**Distinction from `--acp` flag**: Gemini's `--acp` flag starts an A2A (Agent-to-Agent) server — Google's inter-agent protocol, unrelated to our ACP. The native ACP stdio path is a separate CLI entry and does not use `--acp`.

**Ship 5+ inclusion criteria** (council-binding):
1. Ship 2 claude/codex/opencode ACP paths must be passing integration tests with <5% parse failure on council/verifier schemas.
2. Ship 3 council must run successfully across the three ACP-first agents for N consecutive invocations.
3. Ship 4 verifier loop must have demonstrated convergence on at least one real verifier spec.
4. Only then does Gemini's ACP adapter enter Ship 5+ scope.

**Availability probe (Ship 5+)**: spawn `gemini` in ACP mode + `initialize`. Retry + fallback + skip logic from council skill applies (2 primary attempts → 2 fallback attempts → skip).

---

## Hard Success Metrics — Ship 2→3 Gate

Council confirmed **defer exact threshold numbers to implementation** (baseline-then-observe for first week of Ship 2 runs). Metric *definitions* are final here; numeric thresholds land in `.choreographer/metrics-thresholds.json` after baseline collection.

### Metrics to instrument (Ship 1 deliverable via `core/observability.mjs`)

1. **Task success rate** — % of agent invocations that produce usable structured output (schema-parsed, no timeout, no auth failure). Per-agent breakdown.
2. **Synthesis latency p95** — wall-clock time from `/choreo:council` invocation to final deliverable write. Measured per round count.
3. **Evidence-to-claim ratio** — proportion of structured claims in council positions + verifier reports that cite `file + line_start + line_end`. Best-effort for subprocess agents; flagged `precision: line-approx` per Evolution B.
4. **Cancel reliability** — % of mid-flight `session/cancel` invocations that cleanly terminate the ACP session within 5 seconds. Per-agent breakdown.
5. **User selection rate** — when `/choreo:council --members=...` offers a member choice, which agents the user actually picks. Drives council-member defaults.

### Baseline capture method

Ship 1 writes NDJSON events at `~/.choreo/logs/<date>.ndjson` for every agent invocation, phase transition, broker request, and verifier round. Ship 2 runs one full week of real usage. `scripts/metrics-baseline.mjs` (created in Ship 2 pre-work) aggregates NDJSON → baseline report.

### Ratchet rules

After baseline week:
- Task success rate: commit threshold at floor = `baseline_p25 - 5pp` (never regress below 25th percentile minus 5 percentage points).
- Synthesis latency p95: commit threshold at ceiling = `baseline_p95 × 1.2`.
- Evidence-to-claim ratio: commit threshold at floor = `baseline_mean - 1σ`.
- Cancel reliability: commit threshold at floor = `95%` (hard minimum regardless of baseline).
- User selection rate: no threshold — observational signal for council-default tuning only.

**Gate behavior**: if any Ship 2→3 run violates a committed threshold on the critical path, Ship 3 readiness is revoked until root cause is identified and fixed.

### Council non-regression gate

Ship 3 council port must demonstrate non-regression vs baseline on all four load-bearing metrics (task success, synthesis latency, evidence ratio, cancel reliability). `user selection rate` is observational.

---

## Risks + Open Questions

### Risks

1. **ACP SDK version churn** — `@agentclientprotocol/sdk@0.21.0` and `@agentclientprotocol/claude-agent-acp@0.32.0` are both pre-1.0 (0.21 and 0.32 respectively; the latter published within past 24 hours). Pin versions in `package.json` with caret ranges `^0.21.0` and `^0.32.0`. Monitor for breaking changes; circuit-breaker tripped adapter probe reactivates only after successful `initialize` against pinned version.
2. **Claude ACP adapter session resume gap** — `@agentclientprotocol/claude-agent-acp` adapter's mapping of `session/load` to Claude CLI state is unverified. Mitigation: Ship 2 integration test dedicated to session resume round-trip; if fails, use native SDK resume via `@anthropic-ai/claude-agent-sdk` fallback path.
3. **`opencode serve` fallback availability** — if OpenCode ACP stdio path is missing in some installed versions, `serve` fallback must be runnable. Availability probe fails loud with exact setup command.
4. **Gemini native ACP verification** — Gemini ACP stdio support is documented but not independently verified in this research. Acceptable because Ship 5+ lock defers the issue.
5. **Prompt injection via verifier feedback** (cross-ref Ship 4) — sanitizer + 2K cap is mandatory before Builder context sees verifier text.
6. **Broker resilience single-point failure** — DLQ + idempotency + circuit-breaker mandatory from Ship 2 day one.

### Open questions (post-Ship-2-baseline)

- Exact ratchet threshold numbers per §Hard Success Metrics. Commit before Ship 3 gate.
- (Q2 dropped by council — manual `/choreo:verify --agent=codex` trigger already handled by uniform client-side schema; placeholder in Ship 4 spec only.)
- (Q3 resolved by council — ACP permission default = auto-deny in non-interactive with explicit per-member allowlist override. See plan §14.)

---

## Phase 0 Gate: PASS

All four transports have clear ACP-first paths with native fallbacks. Package identities are npm-verified. Schema enforcement strategy is uniform across agents. Metrics are defined + ready to instrument. Risks are enumerated with mitigations.

Ship 2 adapter implementation may proceed once the atomic plan + research commit lands.
