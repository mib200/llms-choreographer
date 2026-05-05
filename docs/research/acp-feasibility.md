# Phase 0 — Transport Feasibility Research

**Date**: 2026-05-05
**Status**: Complete
**Blocks**: Ship 2 (adapter + broker implementation)
**Plan ref**: `docs/plans/2026-05-05-acp-migration-plan.md`

---

## Executive Summary

| Agent | Recommended Transport | Fallback | Structured Output | Streaming | Session Resume | Cancellation |
|-------|----------------------|----------|-------------------|-----------|----------------|--------------|
| **Claude** | SDK (`@anthropic-ai/claude-agent-sdk`) | CLI subprocess (`claude -p --output-format stream-json`) | Yes (JSON Schema) | Yes (async generator / JSONL) | Yes (`resume` option / `--resume` flag) | Break generator / SIGTERM |
| **Codex** | Native `app-server` JSON-RPC via broker | Direct stdio spawn (bypass broker) | Yes (`outputSchema` param) | Yes (JSONL notifications) | Yes (`thread/resume`) | `turn/interrupt` method |
| **OpenCode** | HTTP API via `opencode serve` | CLI subprocess (`opencode run --format json`) | Yes (OpenAPI typed responses) | Yes (SSE via `/event`) | Yes (persistent sessions) | `POST /session/:id/abort` |
| **Gemini** | Subprocess (`gemini -y -m <model> -o json -p`) | N/A (subprocess is the only path) | Partial (JSON envelope, no schema enforcement) | Partial (`-o stream-json` JSONL) | No (one-shot only) | SIGTERM |

**Key decision**: No universal "ACP" protocol. Each agent speaks its own native wire format. The broker multiplexes heterogeneous connections — it does NOT impose a uniform wire format. This validates the plan's "adapter-interface-first" architectural framing.

---

## 1. Claude — Agent SDK + CLI Subprocess

### Primary: `@anthropic-ai/claude-agent-sdk`

**Package**: `@anthropic-ai/claude-agent-sdk` (TypeScript) — bundles a native Claude Code binary.

**Note**: `claude-code-acp` (npm) is a third-party Zed Editor adapter by `carlrannaberg`. Not relevant to choreographer. There is no official "ACP" protocol for Claude Code.

#### Core API

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Fix the failing tests",
  options: {
    allowedTools: ["Read", "Bash", "Edit"],
    permissionMode: "acceptEdits",
    model: "sonnet",
    maxTurns: 10,
    maxBudgetUsd: 5.0,
    includePartialMessages: true,
    outputFormat: { type: "json_schema", schema: { /* JSON Schema */ } }
  }
})) {
  // message.type: SystemMessage | AssistantMessage | UserMessage | StreamEvent | ResultMessage
}
```

#### Message Types

| Type | Description |
|------|-------------|
| `SystemMessage` (subtype `init`) | Session metadata, `session_id` |
| `AssistantMessage` | Claude's response (text + tool calls) |
| `UserMessage` | Tool results fed back |
| `StreamEvent` | Raw API events (requires `includePartialMessages`) |
| `ResultMessage` | Final result with `.result`, `.session_id`, `.cost` |

#### Session Model

- **Capture**: `session_id` from `ResultMessage` or `SystemMessage.data.session_id`
- **Resume**: `options: { resume: sessionId }` — continues with full context
- **Fork**: `options: { resume: sessionId, forkSession: true }` — branches history

#### Structured Output

```typescript
options: {
  outputFormat: {
    type: "json_schema",
    schema: { type: "object", properties: {...}, required: [...] }
  }
}
// Result in message.structured_output
```

#### Cancellation

Break out of the `for await` loop — generator cleanup runs automatically. No explicit `AbortController` needed.

### Fallback: CLI Subprocess

```bash
claude -p "prompt" \
  --output-format stream-json \
  --verbose \
  --model sonnet \
  --permission-mode bypassPermissions \
  --allowedTools "Bash,Read,Edit" \
  --max-budget-usd 5 \
  --json-schema '{"type":"object",...}'
```

**Key flags**:

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive headless mode |
| `--output-format stream-json` | JSONL events on stdout |
| `--include-partial-messages` | Token-level streaming |
| `--json-schema` | Structured output schema |
| `--resume <id>` | Resume conversation |
| `--session-id <uuid>` | Set explicit session |
| `--bare` | Skip hooks/plugins/MCP/CLAUDE.md |
| `--input-format stream-json` | Bidirectional multi-turn via stdin |

**stream-json event types**: `system` (init), `assistant`, `stream_event`, `result`

### Verdict

**Use the SDK for Ship 2.** It provides typed streaming, session resume, structured output, and no process management. Keep CLI subprocess as fallback for environments where SDK can't be installed. The existing `parseClaudeStreamJson()` in `core/parsers.mjs` already handles the CLI output format.

### Setup Command (for availability probe)

```bash
npm install @anthropic-ai/claude-agent-sdk
# OR for CLI fallback:
# Requires: claude binary at ~/.local/share/claude/versions/<version>/claude
```

---

## 2. Codex — Native `app-server` JSON-RPC

### Transport

Newline-delimited JSON (JSONL) over Unix socket. JSON-RPC 2.0 protocol (id = request/response, no id = notification).

### Method Inventory

| Method | Direction | Params | Result |
|--------|-----------|--------|--------|
| `initialize` | C→S | `{ clientInfo, capabilities }` | `{ userAgent }` |
| `initialized` | C→S | `{}` | _(notification)_ |
| `thread/start` | C→S | `{ cwd, model, approvalPolicy, sandbox, serviceName, ephemeral }` | `{ thread: { id } }` |
| `thread/resume` | C→S | `{ threadId, cwd, model, approvalPolicy, sandbox }` | `{ thread: { id } }` |
| `thread/list` | C→S | `{ cwd, limit, sortKey, sourceKinds, searchTerm }` | `{ data: Thread[] }` |
| `thread/name/set` | C→S | `{ threadId, name }` | `{}` |
| `thread/compact/start` | C→S | _(streaming)_ | _(streaming)_ |
| `turn/start` | C→S | `{ threadId, input, model, effort, outputSchema }` | `{ turn: { id } }` |
| `turn/interrupt` | C→S | `{ threadId, turnId }` | `{}` |
| `review/start` | C→S | `{ threadId, delivery, target }` | `{ reviewThreadId? }` |
| `account/read` | C→S | `{ refreshToken }` | Account info |
| `config/read` | C→S | `{ includeLayers, cwd }` | Config object |
| `broker/shutdown` | C→S | `{}` | `{}` |

### Streaming Notifications (S→C)

| Method | Meaning |
|--------|---------|
| `turn/started` | Turn began executing |
| `item/started` | Item started (agentMessage, fileChanged, etc.) |
| `item/completed` | Item finished |
| `turn/completed` | Turn finished (status field) |
| `error` | Server-side error |

**Item types**: `agentMessage` (with `phase`: `"final_answer"`), `fileChanged`, `commandOutput`, `reasoning`

### Structured Output

Pass `outputSchema` (JSON Schema object) in `turn/start`:
```javascript
client.request("turn/start", {
  threadId,
  input: [{ type: "text", text: prompt }],
  model, effort,
  outputSchema: jsonSchemaObject
});
// Result: turnState.lastAgentMessage (phase: "final_answer") → JSON.parse()
```

### Broker Lifecycle

1. **Spawn**: `ensureBrokerSession(cwd)` creates temp dir, generates endpoint (`unix:<dir>/broker.sock`), spawns detached `node app-server-broker.mjs serve --endpoint <ep> --cwd <cwd> --pid-file <path>`
2. **Ready check**: Poll socket every 50ms, timeout 2000ms
3. **Persist**: Write `<stateDir>/broker.json` with `{ endpoint, pidFile, logFile, sessionDir, pid }`
4. **Teardown**: `broker/shutdown` method → broker responds, closes sockets, exits. Then kill PID, remove files.

### Socket Endpoint Resolution

```
unix:<sessionDir>/broker.sock     (macOS/Linux)
pipe:\\.\pipe\<name>-codex-app-server  (Windows)
```

Resolution priority:
1. Explicit `brokerEndpoint` option
2. `CODEX_COMPANION_APP_SERVER_ENDPOINT` env var
3. `loadBrokerSession(cwd)?.endpoint` from `broker.json`
4. Spawn new broker
5. If `disableBroker: true` → stdio transport (direct `codex app-server` child)

### BUSY Fallback

Broker allows **one active request per socket**. Second request gets:
```json
{ "error": { "code": -32001, "message": "Shared Codex broker is busy." } }
```
Client retries with `disableBroker: true` (direct spawn).

**Exception**: `turn/interrupt` is allowed during active stream from a different socket.

### Thread Resume

```javascript
client.request("thread/resume", { threadId, cwd, model, approvalPolicy, sandbox });
// Discovery: thread/list with sourceKinds: ["appServer"], searchTerm prefix match
```

### Stop Hook Contract

- **Timeout**: 15 minutes (`900,000ms`)
- **Input** (stdin): `{ session_id, cwd, last_assistant_message }`
- **Output** (stdout): `{ decision: "block", reason: "..." }` or nothing (allows stop)
- **Parse**: `"ALLOW: ..."` → pass, `"BLOCK: ..."` → reject

### Env Vars (Session Lifecycle)

| Variable | Injected On | Purpose |
|----------|-------------|---------|
| `CODEX_COMPANION_SESSION_ID` | SessionStart | Track jobs per session |
| `CLAUDE_PLUGIN_DATA` | SessionStart | Plugin data directory |
| `CODEX_COMPANION_APP_SERVER_ENDPOINT` | Broker spawn | Socket address |
| `CODEX_COMPANION_APP_SERVER_PID_FILE` | Broker spawn | Process tracking |
| `CODEX_COMPANION_APP_SERVER_LOG_FILE` | Broker spawn | Log location |

### Verdict

**Use native `app-server` JSON-RPC directly.** No ACP shim needed. The wire format is well-documented in the external plugin. Structured output, thread resume, streaming, and cancellation all work over the broker's Unix socket. BUSY fallback to direct spawn provides resilience.

### Setup Command (for availability probe)

```bash
codex --version
# Requires: codex CLI installed, authenticated
```

---

## 3. OpenCode — HTTP API via `opencode serve`

### Transport

HTTP REST API with SSE streaming. **No WebSocket** — streaming uses Server-Sent Events.

### Installation

| Item | Value |
|------|-------|
| Binary | `/opt/homebrew/Cellar/opencode/1.14.33/bin/opencode` |
| Version | 1.14.33 |
| Package | Homebrew formula |

### Server Start

```bash
opencode serve --port 4096 --hostname 127.0.0.1
```

| Flag | Default | Purpose |
|------|---------|---------|
| `--port` | `4096` | HTTP port |
| `--hostname` | `127.0.0.1` | Bind address |
| `--pure` | `false` | Disable external plugins |
| `--mdns` | `false` | mDNS discovery |

### HTTP API Endpoints

#### Core Operations

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/global/health` | Health check → `{ healthy: true, version }` |
| POST | `/session` | Create session → `{ id, title }` |
| GET | `/session` | List sessions |
| GET | `/session/:id` | Get session details |
| DELETE | `/session/:id` | Delete session |
| **POST** | **`/session/:id/message`** | **Send message, wait for response** |
| POST | `/session/:id/prompt_async` | Send message, return 204 immediately |
| POST | `/session/:id/abort` | Cancel running session |
| GET | `/session/:id/message` | List messages (`?limit=`) |
| GET | `/event` | SSE stream (global) |
| GET | `/doc` | OpenAPI 3.1 spec |

#### Request Shape (POST `/session/:id/message`)

```json
{
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-20250514" },
  "agent": "coder",
  "system": "optional system prompt override",
  "parts": [{ "type": "text", "text": "Fix the failing tests" }]
}
```

#### Response Shape

```json
{
  "info": { "id": "msg_...", "role": "assistant", "sessionID": "...", "createdAt": "..." },
  "parts": [
    { "type": "text", "text": "I'll fix those tests..." },
    { "type": "tool_use", "toolName": "Bash", "input": {...}, "output": {...} }
  ]
}
```

### Streaming (SSE)

```
GET /event
Accept: text/event-stream

data: {"type": "server.connected", ...}
data: {"type": "message.start", "sessionID": "...", ...}
data: {"type": "message.delta", "content": "...", ...}
data: {"type": "message.complete", ...}
```

### SDK (`@opencode-ai/sdk`)

```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client } = await createOpencode({ signal, timeout: 5000 })

const session = await client.session.create({ body: { title: "review" } })
const response = await client.session.prompt({
  path: { id: session.id },
  body: { parts: [{ type: "text", text: "Fix tests" }], model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" } }
})
await client.session.abort({ path: { id: session.id } })
```

### Session Model

- Persistent server-side sessions
- `parentID` enables session forking
- Sessions survive server restarts
- Status tracking: `GET /session/status` → `{ [id]: "running" | "idle" }`

### Cancellation

`POST /session/:id/abort` → returns boolean success.

### Verdict

**`opencode serve` is fully viable.** Provides structured I/O, SSE streaming, session persistence, and clean abort. The availability probe must fail loud with setup instructions per the plan.

### Setup Command (for availability probe fail-loud message)

```bash
opencode serve --port 4096 &
# User must start this manually before choreographer can use OpenCode as an agent.
```

---

## 4. Gemini — Subprocess Only

### Transport

Subprocess spawn. No programmatic API beyond CLI invocation. `--acp` flag starts an A2A server mode (Google's Agent-to-Agent protocol) — not useful for subprocess orchestration.

### Installation

| Item | Value |
|------|-------|
| Binary | `/Users/mk/.volta/bin/gemini` |
| Version | 0.37.1 |
| Package | `@google/gemini-cli` (npm global) |

### Invocation Pattern

```bash
# Production invocation
gemini -y -m gemini-2.5-pro -o json -p "your prompt here"

# With streaming events
gemini -y -m gemini-2.5-flash -o stream-json -p "your prompt here"

# Stdin piping (appended to -p)
echo "context" | gemini -y -o json -p "analyze this"
```

### Key Flags

| Flag | Purpose |
|------|---------|
| `-p "prompt"` | Non-interactive headless mode (required) |
| `-y` / `--yolo` | Auto-approve all tool actions (required for subprocess) |
| `-m <model>` | Model selection |
| `-o json` | Structured JSON output |
| `-o stream-json` | JSONL streaming events |
| `-s` / `--sandbox` | Sandbox mode |
| `--resume <id>` | Resume session (interactive only) |

### Output Format (`-o json`)

```json
{
  "session_id": "uuid",
  "response": "model's text response",
  "stats": {
    "models": {
      "gemini-2.5-pro": {
        "api": { "totalRequests": 1, "totalErrors": 0, "totalLatencyMs": 1234 }
      }
    }
  }
}
```

### Stream-JSON Events (`-o stream-json`)

| Event Type | Content |
|-----------|---------|
| `init` | Session metadata |
| `message` | User/assistant chunks |
| `tool_use` | Tool call requests |
| `tool_result` | Tool outputs |
| `error` | Non-fatal warnings |
| `result` | Final outcome with stats |

### Retry/Fallback/Skip Logic (from council skill)

1. **Probe**: `gemini -m <model> -p "ping"` — 2 attempts
2. **Failure signals**: `unknown model`, `not found`, `MODEL_CAPACITY_EXHAUSTED`, `429`, `rate limit`, `quota`, non-zero exit
3. **Fallback**: If primary fails 2x, try `--gemini-fallback=<model>` with same 2-attempt probe
4. **Skip**: If all probes fail, remove gemini from participation — don't crash

### Structured Output Limitations

- JSON envelope (`-o json`) provides `response` as a string — no schema enforcement
- No `--json-schema` or `outputSchema` equivalent
- Structured output must be prompted (instruct model to emit JSON) then parsed client-side
- Parse failure → flag as `precision: line-approx` per Evolution B

### Session Model

- **One-shot only** for subprocess. No headless resume mechanism.
- `--resume <id>` exists but requires interactive TTY.
- `session_id` returned in JSON output but not reusable in `-p` mode.

### Cancellation

SIGTERM. No graceful protocol. Process terminates immediately.

### Current Choreographer Status

Gemini is **NOT in the choreographer REGISTRY** (`core/runners.mjs`). Ship 1 adds it.

### Verdict

**Subprocess-only confirmed.** The `--acp` mode (A2A server) is a Google protocol for agent-to-agent communication — different from what we need. Subprocess invocation with `-y -o json -p` is the only viable programmatic interface.

### Setup Command (for availability probe)

```bash
gemini --version
# Requires: @google/gemini-cli installed, GOOGLE_API_KEY or equivalent auth
```

---

## Cross-Cutting Concerns

### Adapter Interface Contract (Ship 2 shape)

Based on the research, the adapter interface should be:

```typescript
interface AgentAdapter {
  invoke(params: {
    prompt: string;
    model?: string;
    effort?: string;
    structuredSchema?: object;  // JSON Schema
    timeout?: number;
    onProgress?: (event: StreamEvent) => void;
    sandbox?: string;
    resumeThreadId?: string;
  }): Promise<{
    output: string;
    error?: string;
    exitCode?: number;
    structured?: object;
    threadId?: string;
  }>;

  checkAvailability(): Promise<{
    available: boolean;
    reason?: string;
    setupCommand?: string;
  }>;

  supports: {
    streaming: boolean;
    structuredOutput: boolean;
    threadResume: boolean;
    cancellation: boolean;
    background: boolean;
  };
}
```

### Capabilities Matrix

| Capability | Claude (SDK) | Codex (app-server) | OpenCode (HTTP) | Gemini (subprocess) |
|-----------|:---:|:---:|:---:|:---:|
| Streaming | async generator | JSONL notifications | SSE | JSONL stdout |
| Structured output (schema-enforced) | Yes | Yes | Partial (typed responses) | No (prompt-only) |
| Thread/session resume | Yes | Yes | Yes | No |
| Cancellation | generator break | `turn/interrupt` | `POST /abort` | SIGTERM |
| Multi-turn in-process | Yes (generator input) | Yes (multiple turns on thread) | Yes (session messages) | No |
| Background/async | N/A | daemon (broker) | daemon (serve) | N/A |
| Availability probe | SDK import + auth check | `codex --version` + socket connect | `GET /global/health` | `gemini -p "ping"` |

### Dependencies to Install (Ship 2)

| Agent | Package | Version |
|-------|---------|---------|
| Claude | `@anthropic-ai/claude-agent-sdk` | latest |
| Codex | _(none — speaks wire protocol directly)_ | — |
| OpenCode | `@opencode-ai/sdk` | latest |
| Gemini | _(none — subprocess spawn)_ | — |

### Risk Assessment

1. **Claude SDK stability**: New package. Pin version. Fallback to CLI subprocess if breaking changes land.
2. **Codex broker single-request limit**: BUSY fallback to direct spawn handles this. Circuit-breaker should trip after N consecutive BUSY.
3. **OpenCode serve must be running**: Fail-loud with exact `opencode serve &` setup command. No silent subprocess fallback per plan mandate.
4. **Gemini JSON output lacks schema enforcement**: All Gemini structured output must be validated client-side. Evolution B `precision: line-approx` flag applies.
5. **Timeout budgets**: Codex broker has no built-in timeout for turns. Must enforce externally. OpenCode HTTP has server-side timeouts. Claude SDK and Gemini subprocess need external SIGTERM timers.

---

## Phase 0 Gate: PASS

All four transports are researched, documented, and have clear implementation paths. The adapter interface shape is defined. Ship 2 can proceed.
