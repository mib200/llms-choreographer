# Code Review — Ship 2–4 (ACP Migration)

**Branch:** `feature/acp-migration-2`
**Base:** `origin/main`
**Date:** 2026-05-06
**Run ID:** `20260506-081212-a55d82c2`
**Artifacts:** `/tmp/compound-engineering/ce-code-review/20260506-081212-a55d82c2/`

## Scope

| Ship | Commit | Description |
|------|--------|-------------|
| 2 | `95287a9` | ACP-first broker + per-agent adapters with native fallbacks |
| 3 | `6eaeca4` | Council 6-phase state machine with structured schemas |
| 4 | `ecc0b35` | Verifier loop core modules, schemas, and companion commands |

**35 files changed** across `core/agents/`, `core/runtime/`, `core/verifier/`, `core/schemas/`, `core/companion.mjs`, `core/council.mjs`, `core/goal-assistant.mjs`, plugin bundles, and tests.

## Intent

Migrate choreographer from subprocess-based agent invocation to ACP-first architecture with:
- Unified broker daemon managing ACP connections, circuit breakers, DLQ, load queues
- Per-agent adapters (Claude, Codex, OpenCode) with native fallbacks
- Council deliberation protocol (6-phase state machine with structured schemas)
- Verifier loop (atomic-claim decomposition, mixed deterministic/LLM verification, feedback re-injection)
- Goal-definition assistant for verifier setup

## Review Team

| Reviewer | Trigger | Findings |
|----------|---------|----------|
| correctness (always) | — | 15 |
| testing (always) | — | 28 |
| maintainability (always) | — | 15 |
| project-standards (always) | — | 7 |
| agent-native-reviewer (always) | — | 7 |
| security | auth, env handling, permissions | 10 |
| reliability | broker, circuit breaker, timeouts | 30 |
| adversarial | diff >= 50 lines | 18 |
| api-contract | schemas, broker events, interfaces | 10 |

**Total:** 140 raw findings → 133 after dedup → 24 after confidence gate → 24 primary (0 demoted)

---

## P0 — Critical

### #1 Zero test coverage for critical modules

| File | Issue | Reviewers | Confidence | Route |
|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs` (403 lines) | Entire resilience layer untested — circuit breaker, DLQ, load queue, buffered emitter | testing, reliability | 50 | advisory → human |
| `core/runtime/endpoint.mjs` | Unix socket server/client untested | testing | 50 | advisory → human |
| `core/runtime/lifecycle.mjs` | SessionStart/SessionEnd hooks untested | testing | 50 | advisory → human |
| `core/verifier/loop.mjs` | `runVerifierLoop` not tested — only `detectOscillation` has tests | testing | 50 | advisory → human |
| `core/goal-assistant.mjs` | Goal assistant interview untested | testing | 50 | advisory → human |

**Why it matters:** The broker is the backbone of Ships 3–4. If circuit breaker, DLQ, or load queue misbehave, council and verifier loop will fail silently. No test coverage means regressions won't be caught.

### #2 Circular `depends_on` causes infinite recursion

| File | Issue | Reviewers | Confidence | Route |
|------|-------|-----------|------------|-------|
| `core/verifier/composer.mjs:27-48` | Circular dependency in verifier config causes stack overflow — no cycle detection | adversarial | 50 | advisory → human |

**Why it matters:** A user configures `verifier-a` depends on `verifier-b` and `verifier-b` depends on `verifier-a`. The composer enters infinite recursion, hangs the process, and burns API quota.

### #3 Hand-rolled YAML parser breaks on colons

| File | Issue | Reviewers | Confidence | Route |
|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:30-73` | `loadVerifierConfig` splits on `:` — breaks on any value containing colons (e.g., `model: codex/gpt-5.5`, URLs, paths) | adversarial, correctness, api-contract | 50 | advisory → human |

**Why it matters:** Verifier descriptions, model names, and script paths commonly contain colons. The parser silently truncates values, producing incorrect config.

---

## P1 — High

### #4 `adversarial-review` command has no handler

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/companion.mjs:607` | 607 | Listed in `known` commands array but no `if (cmd === 'adversarial-review')` handler — exits "Unknown command" | correctness, agent-native | 100 | gated_auto → review-fixer |

**Suggested fix:** Add handler block or remove from `known` array.

### #5 Council synthesis hardcoded to Claude

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:305` | 305 | Phase 3 synthesis always dispatches to Claude — silent failure if Claude unavailable | correctness | 100 | gated_auto → review-fixer |

**Why it matters:** If Claude is not installed, council produces empty synthesis with no error.

### #6 `checkPendingFeedback` crashes on non-directory entries

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:199` | 199 | `readdirSync(verifierRoot)` iterates all entries; `readdirSync(dir)` crashes if entry is a file, not directory | correctness | 100 | safe_auto → review-fixer |

**Suggested fix:** Add `fs.statSync(dir).isDirectory()` guard before `readdirSync`.

---

## P2 — Moderate

### #7 Broker idempotency cache not cleared between sessions

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:251` | 251 | `idempotencyCache` is a Map that persists across `sessionStart()` calls — stale results returned | correctness | 100 | safe_auto → review-fixer |

### #8 YAML parser breaks on values containing colons

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:54` | 54 | `trimmed.split(':')[1].trim()` truncates values at first colon | correctness | 100 | gated_auto → review-fixer |

### #9 Agent adapter timeout kills process but doesn't resolve promise

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/agents/claude.mjs:100` | 100 | `_invokeNative` timeout kills subprocess but promise never resolves/rejects — caller hangs | correctness | 75 | safe_auto → review-fixer |

### #10 Council checkpoint uses relative path

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:63` | 63 | Checkpoint write uses relative `debates/` path — breaks when cwd differs from project root | correctness | 75 | gated_auto → review-fixer |

### #11 Broker DLQ entry uses `err.message` which may be undefined

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:299` | 299 | `err.message` is undefined for non-Error throws (strings, numbers) | correctness | 75 | safe_auto → review-fixer |

### #12 Verifier convergence ignores `couldnt_verify` claims

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:133` | 133 | Convergence checks only `failed_claims.length === 0` — ignores `couldnt_verify` claims | correctness | 75 | gated_auto → review-fixer |

---

## Security Findings

| ID | Severity | Issue | File |
|----|----------|-------|------|
| SEC-001 | HIGH | ACP subprocess inherits full `process.env` — secrets leaked to agent | `core/agents/*.mjs` |
| SEC-002 | HIGH | Native fallback uses `--dangerously-skip-permissions` — unrestricted access | `core/companion.mjs`, `core/council.mjs` |
| SEC-003 | HIGH | Unix socket in `/tmp` — no auth, no file permissions, no message validation | `core/runtime/endpoint.mjs` |
| SEC-004 | MEDIUM | Verifier feedback sanitizer patterns easily bypassed | `core/verifier/sanitizer.mjs` |
| SEC-005 | MEDIUM | Verifier IDs used in path construction without sanitization — path traversal | `core/verifier/loop.mjs` |
| SEC-006 | MEDIUM | Council topic passed unsanitized to agent prompts with permissions bypassed | `core/council.mjs` |
| SEC-007 | MEDIUM | DLQ stores raw prompts — no encryption, TTL, or access control | `core/runtime/broker.mjs` |

---

## Verdict

**Not ready** — 3 P0, 3 P1, 6 P2 findings require attention before merge.

### Fix Order

1. **P0-2:** Add cycle detection to `composer.mjs` `depends_on` resolution
2. **P0-3:** Replace hand-rolled YAML parser with `js-yaml` or robust alternative
3. **P1-4:** Add `adversarial-review` handler or remove from `known` array
4. **P1-5:** Fix council synthesis to use first available member, not hardcoded Claude
5. **P1-6:** Add `isDirectory()` guard in `checkPendingFeedback`
6. **P2-7:** Clear `idempotencyCache` in `sessionStart()`
7. **P2-9:** Resolve/reject promise on adapter timeout
8. **P2-11:** Use `err?.message ?? String(err)` for DLQ entries
9. **P2-12:** Include `couldnt_verify` in convergence check

### Deferred (post-Ship-5)

- **P0-1:** Test coverage for broker, endpoint, lifecycle, verifier loop, goal assistant — requires significant test infrastructure work
- **SEC-001:** ACP subprocess env scrubbing — aligns with deferred Ship 1 NFF1
- **SEC-002:** Native fallback permission bypass — known tradeoff for native transport
- **SEC-003:** Unix socket auth — requires IPC redesign
- **SEC-007:** DLQ encryption — operational concern, not code defect

---

## Coverage

- **Suppressed:** 109 findings below anchor 75 (P0 at anchor 50+ retained)
- **Demoted:** 0 (no testing/maintainability-only advisory P2-P3 findings)
- **Failed reviewers:** 0 (all 9 reviewers returned results)
- **Untracked files excluded:** `.opencode/worktrees/`, `debates/council/ping-*/` (test artifacts)

## Residual Risks

- Simple YAML parser cannot handle multi-line values, quoted strings, or complex nesting
- `parseStructuredOutput` regex `/\{[\s\S]*\}/` is greedy — may match wrong JSON block
- Circuit breaker half-open state allows unlimited concurrent probes
- BufferedEventEmitter buffer drain is one-time — late listeners miss events
- Council 30s hardcoded timeout may be too short for real agents
- Agent adapters call `checkAvailability()` on every invoke — expensive `spawnSync --version`
- No graceful shutdown on SIGINT/SIGTERM — orphaned subprocesses

## Testing Gaps

- No test for council with Claude unavailable — synthesis silently empty
- No test for `checkPendingFeedback` with mixed files/directories in verifier root
- No test for verifier convergence when `couldnt_verify` is non-empty but `failed_claims` is empty
- No test for broker idempotency cache behavior across session boundaries
- No test for broker invoke with non-Error thrown values
- No test for `loadVerifierConfig` with YAML values containing colons
- No test for `adversarial-review` command (currently no-op)
- No test for agent adapter timeout behavior when process ignores SIGTERM
- No test for council crash recovery (checkpoint read/resume path)
- No test for BufferedEventEmitter with multiple listeners added at different times
