---
slug: code-review-plan-implementation-6aaecd
verdict: BLOCK
confidence: PARTIAL CONSENSUS
rounds: 1
created: 2026-05-06
---

# Council Decision: Complete Code Review Against ACP Migration Plan

## Members

- codex: gpt-5.5
- opencode1: opencode-go/kimi-k2.6
- opencode2: opencode-go/qwen3.6-plus
- opencode3: amazon-bedrock/global.anthropic.claude-opus-4-7
- opencode4: opencode/gemini-3.1-pro (TIMED OUT — excluded from deliberation)
- claude: session-default, role=moderator (orchestrator only, no debating position)

## Consensus Position

**BLOCK MERGE.** The ACP migration branch implements solid leaf modules (broker primitives, verifier loop, adapters, schemas, council state machine, observability) but fails its core architectural premise: **Ship 2's broker resilience layer is dead code in production paths.** Council and companion call adapters directly via `runAgent`, bypassing all circuit breaker, DLQ, idempotency, and load queue guarantees. Combined with adapter-spawn env leaks (security regression vs main) and stale plugin bundles, the branch is not merge-ready.

**Estimated fix effort: 1-2 days.** Three mandatory fixes, then re-review.

## Key Agreements (all 4 members)

1. **Broker is dead code** — `createBroker()`/`broker.invoke()` have zero callers in `companion.mjs`, `council.mjs`, or `verifier/loop.mjs`. Ship 2 resilience is untested in production flows.
2. **Adapter env leak is a security regression** — 6 of 7 subprocess spawns in `core/agents/*.mjs` and `core/agents/acp-client.mjs` inherit full `process.env`, bypassing the `buildAgentEnv()` allowlist that `runners.mjs` enforces. The migration moved invocations OFF the secure path.
3. **Stale bundles = ship gate failure** — `npm run check-bundles` reports all 3 plugin bundles (claude, codex, opencode) are stale. Documented CI gate is red.
4. **123 tests pass but cover the LEGACY surface** — new ACP modules (adapters, ACP client, BufferedEventEmitter, endpoint, lifecycle) have zero test coverage.
5. **P0-2 (CircuitBreaker half-open) and P0-3 (round 10+ sort) are FIXED** — tests at `broker.test.mjs:21-35` and `verifier-loop-feedback.test.mjs:70-97` confirm. Stale review findings.

## Resolved Debates

1. **"NEEDS-WORK vs BLOCK" (opencode1 vs all)** — opencode1 initially argued NEEDS-WORK with 5 merge criteria. After seeing broker-dead-code evidence, upgraded to BLOCK. Resolution: unanimous BLOCK.
2. **"endpoint.mjs / lifecycle.mjs missing?"** — Initial context claimed missing. opencode2 verified they DO exist (`ls -la` confirmed 2581 and 3350 bytes). Resolution: files present, not a gap.
3. **"Detached broker spawn needed?" (codex vs opencode3)** — Codex argued lifecycle must spawn detached broker server. opencode3 counter-argues: plan never required detachment; in-process broker wired into CLI lifecycle satisfies the contract; detachment introduces orphan/PID-file complexity. **Resolution: in-process wiring is sufficient for plan compliance.** Detached spawn deferred.
4. **"Are P0-1/P0-2/P0-3 still valid?"** — opencode2/opencode3 verified via git log and test inspection: P0-2 and P0-3 fixed in `dd98c33`/`ce2a47e`. P0-1 (ACP timeout) fixed in `acp-client.mjs:244-251` via Promise.race. All three stale.

## Remaining Disagreements

### Permission auto-allow severity

- **opencode3, opencode2**: P0 — `acp-client.mjs:37-39` returns `outcome:'allow'` for ALL tools in interactive mode. Active security hole if interactive path is ever reached.
- **opencode1**: P1 — policy decision, not a regression. Interactive mode isn't triggered by current production flows. Fix post-merge.
- **codex**: Not standalone P0; becomes P0 only because adapter path is reachable without env scrubbing.

**Council note:** The disagreement hinges on whether interactive mode is currently reachable. If broker wiring makes ACP client reachable in production, auto-allow becomes active. Safer to fix before merge.

### Verify stub scope

- **opencode2, opencode1 (originally)**: P0 — Ship 4 CLI command `verify` is a facade; exits 0 without calling `runVerifierLoop()`.
- **opencode1 (updated)**: Ship 4 scope — if this merge claims "all 5 ships shipped," verify stub must work; if merge claims "foundation + incremental," stub is acceptable.
- **opencode3**: Not mentioned in final P0 list; implicitly lower priority than broker wiring.

**Council note:** Whether verify stub blocks depends on what the PR claims. If PR title/body says "Ships 1-5 complete," stub is a contradiction. The branch commit history says "feat(ship-4): verifier loop core modules" — the modules exist, the CLI entry point is the gap.

### Fix breadth

- **opencode1 (surgical)**: 3 items only — bundles, broker wiring, env leak. Everything else is debt.
- **opencode2, opencode3 (moderate)**: 4-5 items — add permission auto-allow and idempotency cache.
- **codex**: 4 items including lifecycle detached spawn (rejected by opencode3 as over-engineering).

## Confidence Level

**PARTIAL CONSENSUS** — Unanimous on verdict (BLOCK) and top 3 blockers. Partial disagreement on scope of fixes required before merge (3 vs 4-5 items) and permission auto-allow severity.

## P0 Blockers (unanimous)

| # | Finding | File | Evidence | Fix |
|---|---------|------|----------|-----|
| 1 | Stale bundles | plugins/**/companion.mjs | `npm run check-bundles` fails | `npm run bundle && git add plugins/` |
| 2 | Broker dead code | council.mjs, companion.mjs | Zero calls to `createBroker`/`broker.invoke` | Wire broker into companion `agent` command + council member invocation |
| 3 | Adapter env leak | core/agents/*.mjs, acp-client.mjs:79 | 6/7 spawns inherit full `process.env` | Pass `env: buildAgentEnv()` to all `spawn`/`spawnSync` calls |

## P0-P1 Contested (majority)

| # | Finding | File | Severity split | Fix |
|---|---------|------|----------------|-----|
| 4 | Permission auto-allow | acp-client.mjs:37-39 | P0 (3 members) / P1 (1 member) | Return `outcome:'deny'` in interactive mode until prompt wired |
| 5 | Idempotency cache unbounded | broker.mjs:206 | P1 (all agree) | Add TTL + LRU eviction, cap at 1000 entries |
| 6 | Verify stub | companion.mjs:577-609 | P0 (2) / P1 (2) | Wire to `runVerifierLoop()` |

## P1-P2 (deferred, not blocking)

| # | Finding | File | Fix |
|---|---------|------|-----|
| 7 | Council convergence false-trigger | council.mjs:307-313 | Filter short outputs starting with 'timeout'/'[error' |
| 8 | Plan parser blank line stop | goal-assistant.mjs:204 | Stop at heading, not blank line |
| 9 | ALLOWED_PREFIXES dead code | sanitizer.mjs:19-24 | Delete (recommended) or enforce |
| 10 | Zero test coverage: adapters, ACP client, BufferedEventEmitter, endpoint, lifecycle | core/tests/ | Add 6 test files (~400 LOC) |
| 11 | Default broker timeout | broker.mjs:268 | Add `timeout = 5 * 60_000` default |
| 12 | F8 residual (flag parsing) | companion.mjs:70-79 | Deferred to post-Ship-5 per plan |
| 13 | NFF1 (env additive allowlist) | runners.mjs:18-47 | Deferred to post-Ship-5 per plan |

## Exact Code Changes (consensus patches)

### Fix 1: Bundle drift (30 seconds)

```bash
npm run bundle
git add plugins/
```

### Fix 2: Wire broker into production paths

`core/companion.mjs` — agent command (around line 164):
```javascript
import { createBroker } from './runtime/broker.mjs';

// In agent command handler, replace direct adapter.invoke():
const broker = createBroker();
await broker.sessionStart(`cli-${Date.now()}`);
try {
  const result = await broker.invoke({
    agentName: name,
    prompt: task,
    model: modelEquals,
    effort: effortEquals,
    timeout: 5 * 60_000,
    idempotencyKey: `agent:${name}:${Date.now()}`,
  });
  // ... handle result
} finally {
  await broker.shutdown();
}
```

`core/council.mjs` — replace `runAgent` with broker invocation:
```javascript
import { createBroker } from './runtime/broker.mjs';

// In runCouncil(), create broker for the session:
const broker = createBroker();
await broker.sessionStart(slug);

// Replace each invokeMember call to use broker:
const result = await broker.invoke({
  agentName: name,
  prompt,
  idempotencyKey: `${slug}:${phase}:${name}:${round ?? 0}`,
  model: models[name],
  timeout: 5 * 60_000,
});
```

### Fix 3: Adapter env scrubbing

`core/agents/acp-client.mjs` (line 1 + line 78):
```javascript
import { buildAgentEnv } from '../runners.mjs';

function spawnAcpSubprocess(binary, args, env) {
  const proc = spawn(binary, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env ?? buildAgentEnv(),
  });
```

`core/agents/claude.mjs` (line 96):
```javascript
const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildAgentEnv() });
```

`core/agents/codex.mjs` (line 84):
```javascript
const proc = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildAgentEnv() });
```

`core/agents/opencode.mjs` (line 92):
```javascript
const proc = spawn('opencode', args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildAgentEnv() });
```

### Fix 4 (recommended): Permission auto-deny

`core/agents/acp-client.mjs` (line 37-39):
```javascript
async requestPermission(params) {
  const toolName = params.tool_name ?? params.tool ?? 'unknown';
  if (permissionAllowlist.has(toolName)) {
    return { outcome: 'allow' };
  }
  // Deny by default — interactive prompt not yet implemented
  return { outcome: 'deny' };
}
```

## Updated Test Strategy

### Must-add before merge (P0 coverage):

1. **`core/tests/adapter-env.test.mjs`** — verify adapter spawns do NOT leak `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `NPM_TOKEN`; verify `ANTHROPIC_API_KEY` passes through
2. **`core/tests/broker-wiring.test.mjs`** — verify companion agent command flows through broker; verify council invokes broker; verify circuit breaker abort → council continues N-1

### Should-add (P1, post-merge acceptable):

3. `core/tests/broker-events.test.mjs` — BufferedEventEmitter buffer/drain/once
4. `core/tests/acp-client.test.mjs` — timeout fires cancel, parseStructured validates keys, teardown idempotent
5. `core/tests/endpoint.test.mjs` — socket path, chmod 0600, JSON-RPC framing
6. `core/tests/lifecycle.test.mjs` — session start/end env vars
7. `core/tests/goal-assistant.test.mjs` — interview produces valid goals.json
8. `core/tests/git.test.mjs` — resolveReviewTarget scope detection

### Existing tests: adequate

- `broker.test.mjs` (144 lines) — good CircuitBreaker state machine coverage including half-open recovery
- `broker-integration.test.mjs` (167 lines) — Broker.invoke with FakeAdapter, DLQ, idempotency
- `observability.test.mjs` (283 lines) — rotation, retention, NDJSON format
- `agent-subcommand.test.mjs` (413 lines) — comprehensive CLI dispatch, flag parsing, env scrubbing
- `verifier-loop-feedback.test.mjs` (142 lines) — round 10+ sort, YAML colon handling

## Debate Summary

- Members: 5 (4 active + 1 timed out)
- Rounds: 1 (convergence achieved)
- Pre-flight questions collected: 12 total across 4 members
- Pre-flight unique questions answered: 4 (after dedup)
- Members who needed no clarifications: opencode3
- Concessions by member:
  - codex: conceded opencode3's broker-dead-code as central P0, conceded opencode2 on env handling
  - opencode1: conceded broker dead code, stale bundles, env leak; upgraded NEEDS-WORK → BLOCK
  - opencode2: conceded opencode3's broker finding as THE biggest gap, conceded permission auto-allow
  - opencode3: conceded codex's stale bundles, opencode1's permission auto-allow
- User clarifications requested: 0 (during Phases 1-2)
- Skipped members: opencode4 (gemini-3.1-pro) — timed out during Phase 1, dropped from deliberation
- Key insight that emerged from debate: **The migration moved invocations OFF the secure `runners.mjs` path onto an insecure adapter path — making the branch LESS secure than main, not more.** This net-regression framing (opencode3) converted opencode1 from NEEDS-WORK to BLOCK and unified the council.
