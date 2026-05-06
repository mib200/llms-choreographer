# Test Suite Review & Fixes — 2026-05-06

## Background

After the test rewrite in `ce2a47e` (fixing 200s+ timeouts → 12.5s), we ran an adversarial review (Codex + independent manual evaluation) to validate the test suite's correctness and coverage against the ACP migration plan.

## Reviewers

- **Codex** (adversarial mode): flagged 2 issues
- **Manual evaluation**: confirmed both, added 1 additional, validated correctness of 2 production fixes

## Findings Summary

| # | Severity | Finding | Codex | Manual |
|---|----------|---------|-------|--------|
| 1 | HIGH | Broker tests cloned internal classes instead of importing production code | ✓ | Confirmed — logic identical today but drift risk |
| 2 | MEDIUM | No integration tests for Broker.invoke() / ACP client paths | ✓ | Confirmed — Ship 2 core paths untested |
| 3 | LOW | Parser test 9 name misleading (says "finds first valid" but asserts null) | — | Found |
| 4 | — | invokeMember timeout too generous for test mode (30s) | — | Found (user requirement) |
| 5 | — | `getMemberInvocation()` never passed --model to binaries (metadata only) | — | Bug found during model investigation |

## Decisions Made

### 1. Export broker internals for direct testing

**Decision:** Export `CircuitBreaker`, `LoadQueue`, `DeadLetterQueue` from `core/runtime/broker.mjs`.

**Why:** Tests that clone production classes create drift risk. Any future change to production CircuitBreaker that isn't mirrored to the test file creates silent divergence. Direct import eliminates this class of bug entirely.

**Trade-off considered:** Exporting internals slightly expands the module's surface. Acceptable because:
- These classes are stable infrastructure (circuit breaker pattern, FIFO queue)
- Test-only consumers are clearly identified by file location
- Alternative (test through Broker.invoke() only) doesn't exercise edge cases like `recoveryTimeoutMs: 0`

### 2. Add Broker.invoke() integration tests with FakeAdapter

**Decision:** New `core/tests/broker-integration.test.mjs` tests the production `Broker` class through its public API using a `FakeAdapter` stub.

**Coverage added:**
- Successful invoke → success recorded
- Idempotency cache hit → no duplicate invoke
- Adapter failure → DLQ entry created
- Circuit breaker trip after threshold → subsequent calls rejected + DLQ
- Load queue sequential enforcement
- Unknown agent rejection
- Recovery after circuit breaker timeout

**Why:** The diagnostic doc (docs/tests-diagnostic-2026-05-06.md) marked these as "acceptable gaps" but they're Ship 2's core requirements. A `FakeAdapter` is trivial to implement (12 lines) and exercises the full resilience pipeline without spawning real agent binaries.

### 3. Cheap models for test execution

**Decision:** Implement `CHOREO_TEST_MODELS` env var + fix `getMemberInvocation()` to actually pass `--model` to spawned binaries.

**Default test model map:**

| Agent | Model | Rationale |
|-------|-------|-----------|
| claude | `claude-haiku-4-5-20251001` | Cheapest Claude, sufficient for testing flow correctness |
| codex | `gpt-5.4-nano` | Cheapest Codex model |
| opencode | `opencode/big-pickle` | Cheapest opencode model |
| gemini | `gemini-2.5-flash` | Cheapest Gemini model |

**Usage:**
```bash
CHOREO_TEST_MODELS=claude:claude-haiku-4-5-20251001,codex:gpt-5.4-nano,opencode:big-pickle,gemini:gemini-2.5-flash npm test
```

**Bug fixed:** `getMemberInvocation()` accepted the second `prompt` arg but never used the `models` map to add `--model` flags to spawned binaries. Models were only written as metadata in debate file frontmatter. Now each binary receives `--model <model>` when the model isn't `'default'`.

### 4. Test-mode timeout guard

**Decision:** `invokeMember()` uses 5s timeout when `CHOREO_TEST_MODE=1` (vs 30s production default). `runCompanion` helper always sets `CHOREO_TEST_MODE=1`.

**Why:** If someone adds a new integration test without explicit `--members`, and a fake binary is missing, the test would wait 30s for the real binary to timeout. With 5s guard, the failure surfaces quickly. Current fake-agent tests complete in <100ms per invocation so 5s is generous.

### 5. Parser test clarity

**Decision:** Rename test from "handles multiple JSON blocks (finds first valid)" to "stops after first JSON candidate (known limitation)" since it asserts `null` and documents a parser behavior, not a success case.

## Verification

```
$ npm test
ℹ tests 123
ℹ pass 123
ℹ fail 0
ℹ duration_ms 12857
```

All 123 tests pass in ~13s. No subprocess spawning in unit test layer. Integration tests use fake agents with 5s timeout guard.

## Files Modified

| File | Change |
|------|--------|
| `core/runtime/broker.mjs` | Export CircuitBreaker, LoadQueue, DeadLetterQueue |
| `core/tests/broker.test.mjs` | Import from production instead of cloning |
| `core/tests/broker-integration.test.mjs` | NEW — 8 Broker.invoke() integration tests |
| `core/council.mjs` | Fix model passthrough, add CHOREO_TEST_MODELS, add test timeout guard |
| `core/tests/helpers/fake-agents.mjs` | Set CHOREO_TEST_MODE=1 in runCompanion |
| `core/tests/parsers.test.mjs` | Rename misleading test |

## Remaining Gaps (deferred)

These require non-trivial infrastructure and are acceptable to defer:

- **ACP client lifecycle tests** — requires mock ACP stdio server or SDK stub
- **Per-adapter availability probing** — requires either real binaries or complex mocking of `which`/`spawn`
- **Council phase machine unit tests** — best tested via phase functions in isolation, not end-to-end subprocess runs
