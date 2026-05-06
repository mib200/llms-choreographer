# ACP Migration — Council Findings Fix Spec

## Context

A 5-member council (codex/gpt-5.5, opencode1/kimi-k2.6, opencode2/qwen3.6-plus, opencode3/claude-opus-4-7, opencode4/gemini-3.1-pro) reviewed `feature/acp-migration-2` and returned unanimous BLOCK. This spec covers fixing all 13 findings + 8 new test files to unblock merge.

Key insight: "The migration moved invocations OFF the secure path onto an insecure adapter path — making the branch LESS secure than main."

## Scope

Fix ALL council findings (P0 through P2) and add comprehensive test coverage to prevent regression.

## Execution Order (strictly sequential)

### Phase 1: Unblock Gates (30 min)

**1.1** Run `npm run bundle` to regenerate all 3 plugin bundles.
**1.2** Verify `npm run check-bundles` passes.
**1.3** Commit: "fix: rebuild stale plugin bundles"

### Phase 2: Security Fixes (1-2 hours)

**2.1 Adapter env scrubbing** — 4 files, 7 spawn calls:

| File | Line | Change |
|------|------|--------|
| `core/agents/acp-client.mjs` | 1, 78 | Import `buildAgentEnv`, change default to `buildAgentEnv()` |
| `core/agents/claude.mjs` | 33, 45, 96 | Add `env: buildAgentEnv()` to all spawn/spawnSync |
| `core/agents/codex.mjs` | 33, 84 | Add `env: buildAgentEnv()` to all spawn/spawnSync |
| `core/agents/opencode.mjs` | 33, 92 | Add `env: buildAgentEnv()` to all spawn/spawnSync |

Note: `spawnSync` calls for `--version` checks can keep `process.env` (they don't run agent code). Only `spawn()` calls that execute prompts need scrubbing. But for consistency and safety, scrub all.

**2.2 Permission auto-deny** — `core/agents/acp-client.mjs:37-39`:

Remove the `if (interactive) { return { outcome: 'allow' } }` block entirely. Only allowlist grants permission:
```javascript
async requestPermission(params) {
  const toolName = params.tool_name ?? params.tool ?? 'unknown';
  if (permissionAllowlist.has(toolName)) {
    return { outcome: 'allow' };
  }
  return { outcome: 'deny' };
}
```

**2.3 Write `core/tests/adapter-env.test.mjs`:**
- Each adapter's spawn does NOT include `AWS_SECRET_ACCESS_KEY` in env
- Each adapter's spawn does NOT include `GITHUB_TOKEN` in env
- `ANTHROPIC_API_KEY` passes through (it's in buildAgentEnv allowlist)
- `CHOREO_AGENT_ENV_PASSTHROUGH=1` opts into full env

**2.4** Commit: "fix(security): scrub env in adapter spawns + deny permissions by default"

### Phase 3: Broker Wiring (half day)

**3.1 Wire broker into `core/companion.mjs` agent command:**

Replace `entry.adapter.invoke(...)` (line ~164) with:
```javascript
import { createBroker } from './runtime/broker.mjs';

// In agent command:
const broker = createBroker();
await broker.sessionStart(`agent-${Date.now()}`);
try {
  const result = await broker.invoke({
    agentName: name,
    prompt: task,
    model: modelEquals,
    effort: effortEquals,
    timeout: 5 * 60_000,
    idempotencyKey: `agent:${name}:${Date.now()}`,
  });
  // Handle result (output, exitCode, structured)
} finally {
  await broker.shutdown();
}
```

Also wire: `debug`, `second-opinion`, `vote`, and `review` commands that currently use `runAgent` directly.

**3.2 Wire broker into `core/council.mjs`:**

Replace `invokeMember` function to use broker:
```javascript
import { createBroker } from './runtime/broker.mjs';

// In runCouncil():
const broker = createBroker();
await broker.sessionStart(slug);

// In invokeMember():
const result = await broker.invoke({
  agentName: name,
  prompt,
  model: models[name],
  timeout: 5 * 60_000,
  idempotencyKey: `${slug}:${phase}:${name}:${round ?? 0}`,
});
```

Retain fallback: if broker.invoke throws circuit-breaker-open, council logs warning and continues with N-1 members (graceful degradation).

**3.3 Wire broker into verifier loop dispatch:**

`core/verifier/loop.mjs` — the `runVerifier` callback passed to `runVerifierLoop` should use broker.invoke when called from companion.mjs.

**3.4 Write `core/tests/broker-wiring.test.mjs`:**
- Companion agent command flows through broker (mock adapter, assert broker.invoke called)
- Council invokes broker per member per phase
- Circuit breaker open → council continues with remaining members
- Idempotency key prevents duplicate calls in same phase

**3.5** Run `npm run bundle` (companion.mjs changed).
**3.6** Commit: "feat: wire broker into all production paths (companion, council, verifier)"

### Phase 4: Broker Hardening (1-2 hours)

**4.1 Idempotency cache bounded** — `core/runtime/broker.mjs:206`:
```javascript
constructor() {
  // ...
  this.idempotencyCache = new Map();
  this.idempotencyMaxSize = 1000;
  this.idempotencyTtlMs = 60 * 60 * 1000; // 1 hour
}

// In invoke():
if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
  const entry = this.idempotencyCache.get(idempotencyKey);
  if (Date.now() - entry.t < this.idempotencyTtlMs) return entry.v;
  this.idempotencyCache.delete(idempotencyKey); // expired
}

// On cache set:
if (this.idempotencyCache.size >= this.idempotencyMaxSize) {
  const firstKey = this.idempotencyCache.keys().next().value;
  this.idempotencyCache.delete(firstKey); // FIFO eviction
}
this.idempotencyCache.set(idempotencyKey, { v: invokeResult, t: Date.now() });
```

**4.2 Default broker timeout** — `core/runtime/broker.mjs:268`:
```javascript
async invoke({ ..., timeout = 5 * 60_000, ... }) {
```

**4.3** Update `core/tests/broker-integration.test.mjs`:
- Expired idempotency key triggers re-invocation
- Cache evicts oldest when over capacity (set maxSize=2 in test)
- Default timeout applied when caller omits it

**4.4** Commit: "fix: bound idempotency cache + default broker timeout"

### Phase 5: Verify Stub → Real Implementation (2-3 hours)

**5.1** Replace stub at `core/companion.mjs:577-609` with:
```javascript
if (cmd === 'verify') {
  const jsonMode = rest.includes('--json');
  const autonomous = rest.includes('--autonomous');
  const maxRoundsFlag = rest.find(a => a.startsWith('--rounds='))?.split('=')[1];
  const maxRounds = maxRoundsFlag ? parseInt(maxRoundsFlag, 10) : 3;

  const verifiers = loadVerifierConfig(process.cwd());
  if (verifiers.length === 0) {
    console.error('[verify] No verifiers configured. Create .choreographer/verifiers.yaml');
    process.exit(1);
  }

  const broker = createBroker();
  await broker.sessionStart(`verify-${Date.now()}`);
  try {
    const result = await runVerifierLoop({
      rootDir: process.cwd(),
      builderRunId: randomUUID(),
      verifiers,
      maxRounds,
      autonomous,
      runVerifier: async (v, builderRunId, round) => {
        const agentName = v.model?.split('/')[0] || 'codex';
        const systemPrompt = /* read per-verifier system prompt from disk */;
        const report = await broker.invoke({
          agentName,
          prompt: systemPrompt,
          model: v.model?.split('/')[1],
          structuredSchema: VERIFIER_REPORT_SCHEMA,
          timeout: 5 * 60_000,
        });
        return report.structured || JSON.parse(report.output);
      },
      onEscalation: (type, details) => console.error(`[verify] Escalation: ${type}`, details),
      onRoundComplete: (round, composite) => {
        if (!jsonMode) console.log(`[verify] Round ${round}: ${composite.status}`);
      },
    });

    if (jsonMode) {
      console.log(JSON.stringify({ converged: result.converged, rounds: result.rounds, composite: result.composite }));
    } else {
      console.log(`[verify] ${result.converged ? 'Converged' : 'Not converged'} after ${result.rounds} round(s)`);
    }
    process.exit(result.converged ? 0 : 1);
  } finally {
    await broker.shutdown();
  }
}
```

**5.2 Write `core/tests/verifier-loop-run.test.mjs`:**
- Convergence: all pass round 1 → {converged: true, rounds: 1}
- Failure + fix: round 1 fails, round 2 passes → {converged: true, rounds: 2}
- Round cap: 3 rounds still failing → {converged: false}
- Oscillation: identical failed_claims → {escalated: 'oscillation'}
- depends_on ordering: v2 waits for v1

**5.3** Rebuild bundles. Commit: "feat: wire verify command to runVerifierLoop via broker"

### Phase 6: P1-P2 Fixes (1-2 hours)

**6.1 Council convergence filter** — `core/council.mjs:307-313`:
```javascript
const outputs = Object.values(rebuttals)
  .filter(o => o.length > 0 && !o.startsWith('timeout') && !o.startsWith('[error'));
if (outputs.length >= 2 && outputs.every(o => o.length < 50)) {
  const unique = new Set(outputs.map(o => o.trim().toLowerCase()));
  if (unique.size === 1) break;
}
```

**6.2 Plan parser heading-based stop** — `core/goal-assistant.mjs:204`:
```javascript
// Replace blank-line stop:
if (inCriteria && /^#{1,3}\s/.test(line.trim())) {
  inCriteria = false;
}
```

**6.3 Delete ALLOWED_PREFIXES** — `core/verifier/sanitizer.mjs:19-24`:
Remove the dead constant entirely. Instruction-pattern stripping is sufficient.

**6.4** Update `core/tests/verifier-sanitizer.test.mjs` if ALLOWED_PREFIXES removal changes behavior (it shouldn't — it was never used).

**6.5** Commit: "fix: council convergence filter, plan parser, remove dead ALLOWED_PREFIXES"

### Phase 7: Test Coverage Expansion (2-3 hours)

**7.1 `core/tests/broker-events.test.mjs`:**
- emit-before-listener buffers, addListener drains
- `once()` consumes single buffered event
- Non-buffered events pass through unchanged

**7.2 `core/tests/acp-client.test.mjs`:**
- prompt() timeout fires cancel() and rejects
- parseStructured rejects missing required keys
- teardown kills proc, idempotent on double-call
- Non-interactive mode denies unlisted tools

**7.3 `core/tests/endpoint.test.mjs`:**
- Unix socket path resolves correctly per platform
- JSON-RPC framing handles split chunks
- Existing socket file cleaned on re-create

**7.4 `core/tests/lifecycle.test.mjs`:**
- handleSessionStart writes env vars
- handleSessionEnd cleans up
- Missing env file is non-fatal

**7.5 `core/tests/goal-assistant.test.mjs`:**
- runGoalAssistant produces valid goals.json
- initGoalsFromPlan extracts criteria past headings (not blank lines)
- Inline goal flag creates single claim

**7.6 `core/tests/git.test.mjs`:**
- resolveReviewTarget auto vs working-tree vs branch
- collectReviewContext caps diff at 256KB
- diffBytes never negative

**7.7** Commit: "test: add coverage for adapters, broker events, endpoint, lifecycle, goal-assistant, git"

### Phase 8: Final Verification (30 min)

**8.1** `npm test` — all tests pass (123 original + ~60-80 new)
**8.2** `npm run bundle && npm run check-bundles` — no drift
**8.3** Regression greps:
  - `grep -rn "spawn\|spawnSync" core/agents/ | grep -v "buildAgentEnv\|--version"` → 0 results
  - `grep -rn "runAgent" core/companion.mjs core/council.mjs` → 0 results
  - `grep "outcome.*allow" core/agents/acp-client.mjs` → only allowlist path
**8.4** Commit: "chore: final bundle rebuild after all fixes"

## Success Criteria

1. `npm test` passes with 180+ tests
2. `npm run check-bundles` green
3. Zero `process.env` leaks in adapter spawns
4. All production paths flow through broker
5. Permission model is deny-by-default
6. Idempotency cache bounded
7. Verify command functional (not stub)
8. No dead code (ALLOWED_PREFIXES removed)

## Files Modified

| File | Changes |
|------|---------|
| `core/agents/acp-client.mjs` | env scrub, permission deny, import |
| `core/agents/claude.mjs` | env scrub on all spawns |
| `core/agents/codex.mjs` | env scrub on all spawns |
| `core/agents/opencode.mjs` | env scrub on all spawns |
| `core/runtime/broker.mjs` | idempotency TTL/LRU, default timeout |
| `core/companion.mjs` | broker wiring (agent, debug, vote, review, verify) |
| `core/council.mjs` | broker wiring (invokeMember → broker.invoke) |
| `core/verifier/sanitizer.mjs` | delete ALLOWED_PREFIXES |
| `core/goal-assistant.mjs` | heading-based stop for plan parser |
| `plugins/*/companion.mjs` | rebuilt bundles |

## Files Created

| File | Purpose |
|------|---------|
| `core/tests/adapter-env.test.mjs` | Env scrub verification |
| `core/tests/broker-wiring.test.mjs` | Production path flows through broker |
| `core/tests/broker-events.test.mjs` | BufferedEventEmitter coverage |
| `core/tests/acp-client.test.mjs` | ACP client timeout, permissions, teardown |
| `core/tests/endpoint.test.mjs` | Socket path, framing |
| `core/tests/lifecycle.test.mjs` | Session start/end |
| `core/tests/goal-assistant.test.mjs` | Interview, plan extraction |
| `core/tests/git.test.mjs` | Scope detection, diff collection |
| `core/tests/verifier-loop-run.test.mjs` | Full verifier loop e2e |
