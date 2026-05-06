# Implementation Plan: Fix All Council Findings

## Context

Council review (5 members, unanimous BLOCK) found the ACP migration branch has 3 P0 blockers (stale bundles, broker dead code, adapter env leak) + 10 additional P1-P2 findings. The migration moved invocations OFF the secure path onto an insecure adapter path — net security regression. This plan fixes all 13 items + adds 9 new test files for regression prevention.

**Branch:** `feature/acp-migration-2`
**Spec:** `docs/specs/2026-05-06-council-fixes-design.md`
**Council decision:** `debates/council/code-review-plan-implementation-6aaecd/decision.md`

---

## Phase 1: Unblock Gates

### Step 1.1: Rebuild stale bundles
- Run `npm run bundle`
- Run `npm run check-bundles` — must show 0 drift
- Commit: `fix: rebuild stale plugin bundles`

---

## Phase 2: Security Fixes

### Step 2.1: Adapter env scrubbing

**File: `core/agents/acp-client.mjs`**
- Add import: `import { buildAgentEnv } from '../runners.mjs';`
- Line 78: Change `function spawnAcpSubprocess(binary, args, env = process.env)` → `function spawnAcpSubprocess(binary, args, env)` and use `env: env ?? buildAgentEnv()` in spawn options

**File: `core/agents/claude.mjs`**
- Add import: `import { buildAgentEnv } from '../runners.mjs';`
- Line 33: Add `env: buildAgentEnv()` to spawnSync options
- Line 45: Add `env: buildAgentEnv()` to spawnSync options  
- Line 96: Add `env: buildAgentEnv()` to spawn options

**File: `core/agents/codex.mjs`**
- Add import: `import { buildAgentEnv } from '../runners.mjs';`
- Line 33: Add `env: buildAgentEnv()` to spawnSync options
- Line 84: Add `env: buildAgentEnv()` to spawn options

**File: `core/agents/opencode.mjs`**
- Add import: `import { buildAgentEnv } from '../runners.mjs';`
- Line 33: Add `env: buildAgentEnv()` to spawnSync options
- Line 92: Add `env: buildAgentEnv()` to spawn options

### Step 2.2: Permission auto-deny

**File: `core/agents/acp-client.mjs`** (line 37-39)
- Remove the `if (interactive) { return { outcome: 'allow' }; }` block
- Keep only the allowlist check + default deny

### Step 2.3: Write adapter-env test

**Create: `core/tests/adapter-env.test.mjs`**
- Test: spawn env does NOT contain `AWS_SECRET_ACCESS_KEY`
- Test: spawn env does NOT contain `GITHUB_TOKEN`
- Test: spawn env does NOT contain `NPM_TOKEN`
- Test: `ANTHROPIC_API_KEY` passes through
- Test: `CHOREO_AGENT_ENV_PASSTHROUGH=1` opts into full env
- Test: permission handler denies unlisted tools
- Test: permission handler allows listed tools

### Step 2.4: Verify + commit
- `npm test` passes
- Commit: `fix(security): scrub env in adapter spawns + deny permissions by default`

---

## Phase 3: Broker Wiring

### Step 3.1: Wire broker into companion.mjs agent command

**File: `core/companion.mjs`**
- Add import: `import { createBroker } from './runtime/broker.mjs';`
- In `agent` command handler (~line 164): replace direct `entry.adapter.invoke()` with broker pattern:
  ```javascript
  const broker = createBroker();
  await broker.sessionStart(`agent-${Date.now()}`);
  try {
    const result = await broker.invoke({
      agentName: name, prompt: task, model: modelEquals,
      effort: effortEquals, timeout: 5 * 60_000,
      idempotencyKey: `agent:${name}:${Date.now()}`,
    });
    // Use result.output, result.exitCode, result.structured
  } finally {
    await broker.shutdown();
  }
  ```

### Step 3.2: Wire broker into companion.mjs other commands

**File: `core/companion.mjs`**
- `debug` command: create broker, invoke 2+ agents through it
- `second-opinion` command: invoke through broker
- `vote` command: invoke through broker
- `review` command: invoke through broker (adversarial review)
- Pattern: each command creates its own broker, starts session, invokes, shuts down

### Step 3.3: Wire broker into council.mjs

**File: `core/council.mjs`**
- Add import: `import { createBroker } from './runtime/broker.mjs';`
- Remove: `import { REGISTRY, runAgent } from './runners.mjs';`
- In `runCouncil()`: create broker at start, shut down at end
- Replace `invokeMember()` internals to use `broker.invoke()`:
  ```javascript
  const result = await broker.invoke({
    agentName: name, prompt,
    model: models[name], timeout: 5 * 60_000,
    idempotencyKey: `${slug}:${phase}:${name}:${round ?? 0}`,
  });
  ```
- Graceful degradation: if broker.invoke throws circuit-breaker-open, log warning, continue with N-1 members

### Step 3.4: Write broker-wiring test

**Create: `core/tests/broker-wiring.test.mjs`**
- Test: companion agent command invokes broker.invoke (mock adapter)
- Test: council invokes broker for each member
- Test: idempotency key prevents duplicate calls same phase
- Test: circuit breaker open → council continues N-1 members
- Test: broker.shutdown called after each command

### Step 3.5: Rebuild bundles + verify
- `npm run bundle`
- `npm test` passes
- `npm run check-bundles` passes
- Commit: `feat: wire broker into all production paths (companion, council)`

---

## Phase 4: Broker Hardening

### Step 4.1: Idempotency cache bounded

**File: `core/runtime/broker.mjs`** (~line 206)
- Add fields: `this.idempotencyMaxSize = 1000; this.idempotencyTtlMs = 60 * 60 * 1000;`
- In invoke() cache check (~line 270): add TTL validation
- In invoke() cache set (~line 301): add FIFO eviction when over capacity
- Wrap cached values as `{ v: result, t: Date.now() }`

### Step 4.2: Default broker timeout

**File: `core/runtime/broker.mjs`** (~line 268)
- Change `timeout` parameter to `timeout = 5 * 60_000`

### Step 4.3: Update broker-integration tests

**File: `core/tests/broker-integration.test.mjs`**
- Add test: expired idempotency key triggers re-invocation
- Add test: cache evicts oldest when over maxSize (set maxSize=2)
- Add test: default timeout applied when caller omits

### Step 4.4: Commit
- `npm test` passes
- Commit: `fix: bound idempotency cache (TTL + LRU) + default broker timeout`

---

## Phase 5: Verify Stub → Real Implementation

### Step 5.1: Wire verify command

**File: `core/companion.mjs`** (~line 577-609)
- Replace entire stub block with real implementation
- Create broker, load verifiers, call `runVerifierLoop()` with `runVerifier` callback that uses `broker.invoke()`
- Handle convergence/non-convergence exit codes
- Support `--json`, `--autonomous`, `--rounds=N` flags
- Import `randomUUID` from `node:crypto` for builderRunId

### Step 5.2: Write verifier-loop-run test

**Create: `core/tests/verifier-loop-run.test.mjs`**
- Test: all pass round 1 → converged:true, rounds:1
- Test: fail round 1, pass round 2 → converged:true, rounds:2
- Test: 3 rounds still failing → converged:false
- Test: identical failed_claims across rounds → escalated:'oscillation'
- Test: depends_on ordering enforced (v2 waits for v1)
- Test: autonomous mode escalates on conflict

### Step 5.3: Rebuild + commit
- `npm run bundle`
- `npm test` passes
- Commit: `feat: wire verify command to runVerifierLoop via broker`

---

## Phase 6: P1-P2 Fixes

### Step 6.1: Council convergence filter

**File: `core/council.mjs`** (~line 307-313)
- Filter outputs: exclude those starting with 'timeout' or '[error'
- Keep convergence check logic otherwise identical

### Step 6.2: Plan parser heading-based stop

**File: `core/goal-assistant.mjs`** (~line 204)
- Replace: `if (inCriteria && line.trim() === '')` 
- With: `if (inCriteria && /^#{1,3}\s/.test(line.trim()))`

### Step 6.3: Delete ALLOWED_PREFIXES

**File: `core/verifier/sanitizer.mjs`** (lines 19-24)
- Delete the `ALLOWED_PREFIXES` constant entirely
- It was declared but never used in any filter logic

### Step 6.4: Commit
- `npm test` passes (no behavior change from ALLOWED_PREFIXES deletion)
- Commit: `fix: council convergence filter, plan parser heading stop, remove dead code`

---

## Phase 7: Test Coverage Expansion

### Step 7.1: BufferedEventEmitter tests

**Create: `core/tests/broker-events.test.mjs`**
- emit-before-listener buffers events
- addListener drains buffered events
- `once()` consumes single buffered event, leaves rest
- Non-buffered events pass through unchanged
- Buffer cleared after drain

### Step 7.2: ACP client tests

**Create: `core/tests/acp-client.test.mjs`**
- prompt() timeout fires cancel() and rejects with timeout error
- parseStructured rejects output missing required schema keys
- teardown kills proc with SIGTERM
- teardown idempotent on double-call
- Non-interactive mode denies all unlisted tools

### Step 7.3: Endpoint tests

**Create: `core/tests/endpoint.test.mjs`**
- Unix socket path resolves correctly per platform
- JSON-RPC framing handles split TCP chunks
- Existing socket file cleaned on re-create
- Invalid JSON line ignored, valid still processed

### Step 7.4: Lifecycle tests

**Create: `core/tests/lifecycle.test.mjs`**
- handleSessionStart writes CHOREO_BROKER_ENDPOINT + CHOREO_SESSION_ID
- handleSessionEnd cleans up env vars
- Missing env file path is non-fatal

### Step 7.5: Goal assistant tests

**Create: `core/tests/goal-assistant.test.mjs`**
- runGoalAssistant produces valid goals.json matching schema
- initGoalsFromPlan extracts criteria past headings (not blank lines)
- Inline goal flag creates single claim
- Per-verifier system prompts written to disk

### Step 7.6: Git module tests

**Create: `core/tests/git.test.mjs`**
- resolveReviewTarget: auto scope detection
- resolveReviewTarget: explicit working-tree scope
- resolveReviewTarget: branch scope with base ref
- collectReviewContext: caps diff at max bytes
- diffBytes never negative

### Step 7.7: Commit
- `npm test` passes (all new tests green)
- Commit: `test: add coverage for broker events, acp-client, endpoint, lifecycle, goal-assistant, git`

---

## Phase 8: Final Verification

### Step 8.1: Full test suite
- `npm test` — all tests pass (expect 180+ total)

### Step 8.2: Bundle gate
- `npm run bundle && npm run check-bundles` — zero drift

### Step 8.3: Regression greps
- `grep -rn "spawn\|spawnSync" core/agents/ | grep -v "buildAgentEnv\|--version"` → 0 unsafe spawns
- `grep -rn "runAgent" core/companion.mjs core/council.mjs` → 0 direct bypass
- `grep "outcome.*allow" core/agents/acp-client.mjs` → only allowlist path
- `grep "ALLOWED_PREFIXES" core/` → 0 results (dead code removed)

### Step 8.4: Final commit
- `npm run bundle` (if any test touched companion logic)
- Commit: `chore: final bundle rebuild + verification pass`

---

## Verification

After all phases complete:
1. `npm test` — 180+ tests, 0 failures
2. `npm run check-bundles` — green
3. All production paths (agent, debug, vote, review, council, verify) flow through broker
4. Zero env leaks in adapter spawns
5. Permission model deny-by-default
6. Idempotency cache bounded (1000 entries, 1hr TTL)
7. Verify command functional
8. No dead code remaining
9. Council convergence won't false-trigger on errors

## Key Files

### Modified
- `core/agents/acp-client.mjs` — env, permissions
- `core/agents/claude.mjs` — env
- `core/agents/codex.mjs` — env
- `core/agents/opencode.mjs` — env
- `core/runtime/broker.mjs` — idempotency, timeout
- `core/companion.mjs` — broker wiring, verify implementation
- `core/council.mjs` — broker wiring
- `core/verifier/sanitizer.mjs` — delete ALLOWED_PREFIXES
- `core/goal-assistant.mjs` — heading parser
- `plugins/*/companion.mjs` — rebuilt bundles

### Created (9 test files)
- `core/tests/adapter-env.test.mjs`
- `core/tests/broker-wiring.test.mjs`
- `core/tests/broker-events.test.mjs`
- `core/tests/acp-client.test.mjs`
- `core/tests/endpoint.test.mjs`
- `core/tests/lifecycle.test.mjs`
- `core/tests/goal-assistant.test.mjs`
- `core/tests/git.test.mjs`
- `core/tests/verifier-loop-run.test.mjs`

## Existing Functions to Reuse
- `buildAgentEnv()` from `core/runners.mjs` — the env allowlist already exists
- `createBroker()` from `core/runtime/broker.mjs` — broker factory exists
- `runVerifierLoop()` from `core/verifier/loop.mjs` — loop logic exists
- `loadVerifierConfig()` from `core/verifier/loop.mjs` — YAML parsing exists
- `checkPendingFeedback()` from `core/verifier/loop.mjs` — feedback detection exists
- `parseStructuredOutput()` from `core/parsers.mjs` — schema validation exists
