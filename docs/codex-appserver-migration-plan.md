> **SUPERSEDED**: This plan is partially superseded by the [ACP Migration Plan](plans/2026-05-05-acp-migration-plan.md). Codex now routes through an ACP stdio adapter (`@agentclientprotocol/sdk`) with the app-server JSON-RPC as a native fallback, not the primary transport. The gap analysis below remains useful for understanding the app-server fallback contract. See `docs/research/acp-feasibility.md` Appendix A for the native transport reference.

# Codex App-Server Migration Plan

## Problem Statement

Our Codex integration uses `codex exec <prompt>` — a naive subprocess spawn that captures stdout as plain text. The official OpenAI Codex plugin uses the **Codex app-server protocol** (JSON-RPC over stdio/Unix socket), providing structured output, job tracking, background execution, thread persistence, model selection, and review targeting.

## Gap Analysis

| Capability | Our Current | Official Plugin | Impact |
|---|---|---|---|
| Invocation | `codex exec` (spawn) | `codex app-server` (JSON-RPC) | High — no structured data |
| Output parsing | Raw stdout text | Final answer + reasoning + files + commands | High — loses reasoning, file context |
| Background execution | None | Detached worker + job queue | High — blocks user session |
| Job tracking | None | state.json + job files + logs | High — no status/result/cancel |
| Thread persistence | None | Named threads, resume by threadId | Medium — no continuity |
| Model/effort selection | None | --model, --effort, spark alias | Medium — no runtime control |
| Review targeting | Raw git diff in prompt | `review/start` with target object | Medium — no branch diff |
| Structured output | None | JSON schema validation | Low — adversarial review quality |
| Auth checking | Binary existence only | `account/read` via app-server | Medium — silent auth failures |
| Broker support | None | Shared runtime via Unix socket | Low — multi-session efficiency |
| Progress reporting | None | Real-time stderr + log files | Medium — no visibility into long runs |
| Turn interruption | SIGTERM timeout only | `turn/interrupt` RPC | Low — clean cancellation |

## Architecture

### Current (spawn-based)

```
companion.mjs
  └─ runAgent(name, binary, args, parse)
       └─ spawn(binary, args)  →  stdout → parse() → {output, error, code}
```

### Target (hybrid — app-server for codex, spawn for others)

```
companion.mjs
  ├─ runAgent(name, binary, args, parse)          ← claude, opencode (unchanged)
  └─ runCodexAppServer(cwd, options)              ← NEW: codex-specific
       ├─ CodexAppServerClient.connect(cwd)       ← JSON-RPC client
       ├─ thread/start or review/start             ← structured request
       ├─ captureTurn(client, threadId, ...)       ← notification stream
       └─ {finalMessage, reasoningSummary, fileChanges, status, threadId, turnId}

state/
  ├─ state-manager.mjs     ← loadState, saveState, upsertJob, listJobs
  ├─ job-control.mjs       ← buildStatusSnapshot, resolveResultJob, enrichJob
  └─ tracked-jobs.mjs      ← runTrackedJob, createProgressReporter, appendLogLine

codex/
  ├─ app-server-client.mjs ← JSON-RPC protocol (initialize, request, notify)
  ├─ codex-helpers.mjs     ← getCodexAvailability, getCodexAuthStatus, runAppServerTurn
  ├─ broker.mjs            ← ensureBrokerSession, loadBrokerSession, parseBrokerEndpoint
  └─ review-target.mjs     ← resolveReviewTarget, collectReviewContext
```

## Phased Implementation

### Phase 1: App-Server Client (Foundation)

**Goal**: Replace `codex exec` with JSON-RPC app-server protocol for a single foreground turn.

**New files**:
- `core/codex/app-server-client.mjs` — `CodexAppServerClient` class
  - `connect(cwd, options)` — spawn `codex app-server`, JSON-RPC handshake
  - `request(method, params)` — send request, await response
  - `notify(method, params)` — fire-and-forget
  - `setNotificationHandler(handler)` — stream callbacks
  - `close()` — graceful shutdown
- `core/codex/protocol.mjs` — turn capture state machine
  - `createTurnCaptureState(threadId)` — initialize capture context
  - `applyTurnNotification(state, message)` — process stream events
  - `completeTurn(state)` — resolve when final_answer seen
  - `captureTurn(client, threadId, startRequest, options)` — main loop
- `core/codex/helpers.mjs` — high-level helpers
  - `runAppServerTurn(cwd, {prompt, model, effort, sandbox, resumeThreadId})` — single turn
  - `runAppServerReview(cwd, {target, model})` — review-specific turn
  - `getCodexAvailability(cwd)` — binary + app-server check
  - `getCodexAuthStatus(cwd)` — account/read via app-server

**Modified files**:
- `core/runners.mjs` — add `runCodexAgent()` that routes to app-server instead of spawn
- `core/companion.mjs` — codex agent defs in council/review/debug/vote use `runCodexAgent()`

**Key data structures**:

```js
// Turn capture state
{
  threadId, rootThreadId, threadIds: Set, threadTurnIds: Map,
  turnId, completed, finalAnswerSeen, finalTurn,
  lastAgentMessage, reviewText, reasoningSummary: [],
  fileChanges: [], commandExecutions: [],
  onProgress, completion: Promise
}

// Turn result
{
  status: 0|1, threadId, turnId,
  finalMessage: string, reasoningSummary: string[],
  fileChanges: [], touchedFiles: string[],
  commandExecutions: [], error: null|string, stderr: string
}
```

**Testing**: Unit tests for JSON-RPC message parsing, notification routing, turn completion detection.

### Phase 2: Job Tracking & State Management

**Goal**: Persist job state across sessions for status/result/cancel.

**New files**:
- `core/codex/state-manager.mjs`
  - `resolveStateDir(cwd)` — workspace-scoped state directory
  - `loadState(cwd)`, `saveState(cwd, state)` — state.json CRUD
  - `generateJobId(prefix)` — `review-<timestamp>-<random>`
  - `upsertJob(cwd, patch)`, `listJobs(cwd)` — job registry
  - `writeJobFile(cwd, jobId, payload)`, `readJobFile(jobFile)` — per-job JSON
- `core/codex/job-control.mjs`
  - `buildStatusSnapshot(cwd, options)` — running/latest/recent jobs
  - `buildSingleJobSnapshot(cwd, reference)` — single job detail
  - `resolveResultJob(cwd, reference)` — find finished job
  - `resolveCancelableJob(cwd, reference)` — find active job
  - `enrichJob(job)` — phase inference, elapsed time, progress preview
- `core/codex/tracked-jobs.mjs`
  - `runTrackedJob(job, runner, options)` — lifecycle wrapper
  - `createJobRecord(base, options)` — job with sessionId
  - `createJobProgressUpdater(workspaceRoot, jobId)` — event → state patch
  - `createProgressReporter({stderr, logFile, onEvent})` — multi-output reporter
  - `createJobLogFile(workspaceRoot, jobId, title)` — timestamped log
  - `appendLogLine(logFile, message)` — structured log entries

**Modified files**:
- `core/codex/helpers.mjs` — `runAppServerTurn` wraps with `runTrackedJob`
- `core/companion.mjs` — add `status`, `result`, `cancel` commands

**State directory structure**:
```
/tmp/codex-companion/<slug>-<hash>/
  state.json          ← config + job index
  jobs/
    review-xxx.json   ← full job record
    review-xxx.log    ← timestamped progress log
    task-yyy.json
    task-yyy.log
```

**Testing**: State persistence across process restarts, job pruning (max 50), session-scoped filtering.

### Phase 3: Background Execution

**Goal**: Support `--background` flag for long-running Codex tasks.

**New files**:
- `core/codex/task-worker.mjs` — detached subprocess for background jobs
  - Reads job record from state, executes `runAppServerTurn`, writes result
  - Invoked as: `node core/codex/task-worker.mjs --cwd <dir> --job-id <id>`
- `core/codex/broker.mjs` — optional shared Codex runtime
  - `ensureBrokerSession(cwd, options)` — spawn `codex app-server --broker`
  - `loadBrokerSession(cwd)` — load existing broker endpoint
  - `parseBrokerEndpoint(endpoint)` — extract Unix socket path

**Modified files**:
- `core/codex/helpers.mjs` — `enqueueBackgroundTask()`, `spawnDetachedTaskWorker()`
- `core/companion.mjs` — `--background` handling in council/review/debug
- `core/runners.mjs` — `stripFlags()` adds `--background`, `--wait`, `--model`, `--effort`

**Background flow**:
```
1. User: /choreo-codex "investigate the flaky test" --background
2. Create job record → status: "queued"
3. spawn(process.execPath, [task-worker.mjs, --job-id, ...], {detached: true})
4. child.unref() → return job ID to user
5. User: /choreo-codex-status → shows running/recent jobs
6. User: /choreo-codex-result <job-id> → shows final output
```

**Testing**: Detached process survives parent exit, job state transitions, log file growth.

### Phase 4: Advanced Features

**Goal**: Model selection, review targeting, structured output, auth checking.

**New files**:
- `core/codex/review-target.mjs`
  - `resolveReviewTarget(cwd, {base, scope})` — auto/working-tree/branch
  - `collectReviewContext(cwd, target)` — diff content + branch info
- `core/codex/schemas/review-output.schema.json` — structured review schema

**Modified files**:
- `core/codex/helpers.mjs` — `normalizeRequestedModel()`, `normalizeReasoningEffort()`
  - Model aliases: `spark` → `gpt-5.3-codex-spark`
  - Effort validation: `none|minimal|low|medium|high|xhigh`
- `core/companion.mjs` — `setup` command (auth check + review gate toggle)
  - `--model`, `--effort` flags on all codex commands
  - `--base <ref>` for branch review

**Testing**: Model alias resolution, effort validation, review target resolution, auth status detection.

### Phase 5: Bundle & Plugin Updates

**Goal**: Rebundle all plugins, update Codex skill files.

**Modified files**:
- `scripts/bundle.mjs` — ensure new `core/codex/` modules included in codex plugin bundle
- `plugin-codex/skills/*.md` — update skill descriptions to reflect new capabilities
- `plugin-codex/.codex-plugin/plugin.json` — version bump

**Testing**: `npm run bundle` produces valid bundles, `npm run check-bundles` passes, smoke tests work.

## Migration Strategy

### Backward Compatibility

- `runAgent()` signature unchanged for claude/opencode
- Codex commands accept same arguments; new flags (`--model`, `--effort`, `--background`, `--base`) are optional
- Existing council/review/debug/vote commands work identically from user perspective
- Output format preserved: `{name, output, error, code}` for parallel commands

### Incremental Rollout

1. **Phase 1** can be tested in isolation — single foreground turn works before job tracking
2. **Phase 2** adds persistence — existing foreground flow still works
3. **Phase 3** adds background — foreground flow unaffected
4. **Phase 4** adds polish — no breaking changes

### Rollback Plan

- Keep `runAgent()` spawn path as fallback behind `CHOREO_CODEX_MODE=spawn` env var
- If app-server fails to initialize, fall back to `codex exec` with warning
- Job state directory is isolated — deletion resets to clean state

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| JSON-RPC protocol changes in future Codex versions | Medium | High | Version check on initialize, graceful fallback to spawn |
| Broker socket conflicts on shared machines | Low | Medium | Fallback to direct spawn on ECONNREFUSED |
| Job state corruption on crash | Low | Low | Per-job files + state.json — either can rebuild |
| Increased complexity in core/ | Medium | Medium | Clean module boundaries, comprehensive tests |
| Bundle size increase | Low | Low | Codex modules only bundled in plugin-codex |

## Testing Approach

### Unit Tests
- `core/tests/codex/app-server-client.test.mjs` — JSON-RPC message framing, error handling
- `core/tests/codex/protocol.test.mjs` — notification routing, turn completion
- `core/tests/codex/state-manager.test.mjs` — state persistence, job pruning
- `core/tests/codex/job-control.test.mjs` — snapshot building, job resolution
- `core/tests/codex/helpers.test.mjs` — model/effort normalization, auth status

### Integration Tests
- `core/tests/codex/appserver-integration.test.mjs` — real `codex app-server` turn (requires Codex installed)
- `core/tests/codex/background-execution.test.mjs` — detached worker lifecycle

### Smoke Tests
```bash
node core/companion.mjs check-all          # verify codex detected
node core/companion.mjs council "what is 2+2?"  # parallel with app-server
node core/companion.mjs review             # review current diff
node core/companion.mjs status             # show job list
```

## File Inventory

### New Files (estimated ~12)
| File | Purpose | Lines |
|---|---|---|
| `core/codex/app-server-client.mjs` | JSON-RPC client | ~200 |
| `core/codex/protocol.mjs` | Turn capture state machine | ~300 |
| `core/codex/helpers.mjs` | High-level app-server helpers | ~250 |
| `core/codex/state-manager.mjs` | Job state persistence | ~180 |
| `core/codex/job-control.mjs` | Job snapshots & resolution | ~200 |
| `core/codex/tracked-jobs.mjs` | Job lifecycle wrapper | ~150 |
| `core/codex/task-worker.mjs` | Background worker process | ~80 |
| `core/codex/broker.mjs` | Shared runtime broker | ~100 |
| `core/codex/review-target.mjs` | Review targeting logic | ~80 |
| `core/codex/schemas/review-output.schema.json` | Structured review schema | ~30 |
| `core/tests/codex/*.test.mjs` | Unit tests (5 files) | ~400 |

### Modified Files (estimated ~4)
| File | Change |
|---|---|
| `core/runners.mjs` | Add `runCodexAgent()` routing |
| `core/companion.mjs` | Add status/result/cancel/setup commands, --model/--effort flags |
| `scripts/bundle.mjs` | Include new codex/ modules in plugin-codex bundle |
| `plugin-codex/skills/*.md` | Update skill descriptions |

### Unchanged Files
- `core/parsers.mjs` — claude/opencode parsers unaffected
- `plugin-claude/` — no changes
- `plugin-opencode/` — no changes
