# Code Review — Ships 1–5 (Full ACP Migration)

**Branch:** `feature/acp-migration-2`
**Base:** `origin/main`
**Date:** 2026-05-06
**Run ID:** `20260506-094739-0d0f78cc`
**Artifacts:** `/tmp/compound-engineering/ce-code-review/20260506-094739-0d0f78cc/`

## Scope

| Ship | Commit | Description |
|------|--------|-------------|
| 1 | `5371e012` → `3e8c9ef` | Foundation — observability NDJSON, single-agent dispatch fix |
| 2 | `95287a9` | ACP-first broker + per-agent adapters with native fallbacks |
| 3 | `6eaeca4` | Council 6-phase state machine with structured schemas |
| 4 | `ecc0b35` | Verifier loop core modules, schemas, companion commands |
| 5 | `62d3497` | Adversarial review + cleanup + docs update |

**48 files changed** across `core/agents/`, `core/runtime/`, `core/verifier/`, `core/schemas/`, `core/companion.mjs`, `core/council.mjs`, `core/git.mjs`, `core/goal-assistant.mjs`, `core/review-render.mjs`, plugin bundles, commands, skills, and docs.

## Intent

Migrate choreographer from subprocess-based agent invocation to ACP-first architecture with:
- Unified broker daemon managing ACP connections, circuit breakers, DLQ, load queues
- Per-agent adapters (Claude, Codex, OpenCode) with native fallbacks
- Council deliberation protocol (6-phase state machine with structured schemas)
- Verifier loop (atomic-claim decomposition, mixed deterministic/LLM verification, feedback re-injection)
- Goal-definition assistant for verifier setup
- Adversarial review command with git context collection and structured output

## Review Team

| Reviewer | Trigger | Findings |
|----------|---------|----------|
| correctness (always) | — | 20 |
| testing (always) | — | 17 |
| maintainability (always) | — | 15 |
| project-standards (always) | — | 15 |
| agent-native-reviewer (always) | — | 8 |
| security | auth, env handling, permissions, sockets | 12 |
| reliability | broker, circuit breaker, timeouts, async | 15 |
| adversarial | diff >= 50 lines | 20 |
| api-contract | schemas, broker events, interfaces | 12 |

**Total:** 134 raw findings → 134 after dedup → 28 after confidence gate → 28 primary (0 demoted)

---

## P0 — Critical

### #1 ACP `prompt()` timeout accepted but never enforced

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/agents/acp-client.mjs:207` | 207 | `prompt()` accepts `timeout` parameter but never sets a timer — infinite hang if agent never responds | correctness | 100 | safe_auto → review-fixer |

**Why it matters:** Council and verifier loop both pass timeouts to `prompt()`. Without enforcement, a stalled agent blocks the entire pipeline indefinitely.

### #2 CircuitBreaker half-open never transitions back to open

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:38` | 38 | Half-open probe that fails does not trip circuit back to open — stays half-open forever | correctness | 100 | gated_auto → review-fixer |

**Why it matters:** After recovery timeout, one failed probe leaves the breaker permanently half-open, allowing unlimited requests through a failing adapter.

### #3 Feedback file sort breaks at round 10+

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:183` | 183 | Lexicographic sort of `feedback-round-*.json` — `feedback-round-10.json` sorts before `feedback-round-2.json` | correctness | 100 | safe_auto → review-fixer |

**Suggested fix:** Extract numeric round from filename: `parseInt(f.replace('feedback-round-', '').replace('.json', ''), 10)`.

### #4–#11 Zero test coverage for critical modules

| Module | Lines | Reviewers | Confidence | Route |
|--------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs` | 403 | testing, adversarial | 50 | advisory → human |
| `core/goal-assistant.mjs` | 223 | testing | 50 | advisory → human |
| `core/git.mjs` | 281 | testing | 50 | advisory → human |
| `core/review-render.mjs` | 128 | testing | 50 | advisory → human |
| `core/verifier/composer.mjs` (cycle detection) | — | adversarial | 50 | advisory → human |
| `core/runtime/endpoint.mjs` (buffer cap) | — | adversarial | 50 | advisory → human |
| `core/verifier/loop.mjs` (runVerifierLoop) | — | testing | 50 | advisory → human |
| 57K lines of identical bundled code | — | maintainability | 50 | advisory → human |

---

## P1 — High

### #12 Council silently skips unknown members

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:147` | 147 | Members not in REGISTRY are silently skipped — no error or warning | correctness | 100 | gated_auto → review-fixer |

### #13 Council with empty members invokes Claude blindly

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:274` | 274 | Empty members array → synthesis dispatched to Claude with no debater input | correctness | 100 | gated_auto → review-fixer |

### #14 Broker idempotency cache unbounded

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:179` | 179 | `idempotencyCache` is a Map with no TTL or size limit — memory leak | correctness | 100 | advisory → downstream-resolver |

### #15 BufferedEventEmitter misses `once()` listeners

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:127` | 127 | `BufferedEventEmitter` overrides `addListener`/`on` but not `once()` — buffered events missed | correctness | 100 | safe_auto → review-fixer |

### #16 Adversarial-review parse callback type mismatch

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/companion.mjs:655` | 655 | Parse callback returns `{parsed, rawOutput}` but `runAgent` expects string output | correctness | 75 | gated_auto → review-fixer |

### #17 Council convergence check triggers on short error messages

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:259` | 259 | Convergence compares output strings — short error messages trigger false convergence | correctness | 75 | gated_auto → review-fixer |

### #18 `diffBytes` measurement can be negative

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/git.mjs:244` | 244 | `maxInlineDiffBytes - stagedBytes` can be negative if staged diff exceeds cap | correctness | 75 | safe_auto → review-fixer |

---

## P2 — Moderate

### #19 Adapters re-check availability on every invoke

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/agents/claude.mjs:56` | 56 | `checkAvailability()` spawns `--version` subprocess on every call — expensive | correctness | 100 | advisory → downstream-resolver |

### #20 Verify command is stub

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/companion.mjs:590` | 590 | `verify` command reports status but never calls `runVerifierLoop` | correctness | 100 | manual → downstream-resolver |

### #21 Council subprocess timeout hardcoded at 30s

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:120` | 120 | 30s timeout with no config override — too short for real agents | correctness | 100 | advisory → downstream-resolver |

### #22 Plan parser stops at first blank line

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/goal-assistant.mjs:185` | 185 | `initGoalsFromPlan` stops parsing acceptance criteria at first blank line | correctness | 100 | gated_auto → review-fixer |

### #23 Broker registers all adapters regardless of availability

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:389` | 389 | `createBroker()` registers claude/codex/opencode even if binaries missing | correctness | 100 | advisory → downstream-resolver |

### #24 YAML parser breaks on colons

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/loop.mjs:46` | 46 | `split(':')[1]` truncates values at first colon (model names, URLs, paths) | correctness | 100 | safe_auto → review-fixer |

### #25 Council checkpoint uses relative path

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/council.mjs:60` | 60 | `writeCheckpoint` uses relative `debates/` path — breaks if cwd changes | correctness | 75 | safe_auto → review-fixer |

### #26 `parseStructuredOutput` regex too greedy

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/parsers.mjs:44` | 44 | `\{[\s\S]*\}` matches from first `{` to last `}` — can capture multiple JSON blocks | correctness | 75 | gated_auto → review-fixer |

### #27 LoadQueue rejected promises remain in array

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/runtime/broker.mjs:96` | 96 | Rejected promises not removed from internal queue — memory leak | correctness | 75 | gated_auto → review-fixer |

### #28 Sanitizer over-strips legitimate data

| File | Line | Issue | Reviewers | Confidence | Route |
|------|------|-------|-----------|------------|-------|
| `core/verifier/sanitizer.mjs:15` | 15 | Lines starting with action verbs (`fix`, `change`, `update`) are stripped even when they are data | correctness | 75 | advisory → downstream-resolver |

---

## Security Findings

| ID | Severity | Issue | File |
|----|----------|-------|------|
| SEC-001 | HIGH | ACP subprocess inherits full `process.env` — secrets leaked | `core/agents/*.mjs` |
| SEC-002 | HIGH | Same env leak for native fallback paths | `core/agents/*.mjs` |
| SEC-003 | MEDIUM | Unix socket in `/tmp` — no access control | `core/runtime/endpoint.mjs` |
| SEC-004 | MEDIUM | Socket accepts unauthenticated connections | `core/runtime/endpoint.mjs` |
| SEC-005 | MEDIUM | Sanitizer `ALLOWED_PREFIXES` defined but never enforced | `core/verifier/sanitizer.mjs` |
| SEC-006 | MEDIUM | Instruction filter bypassable with whitespace variants | `core/verifier/sanitizer.mjs` |
| SEC-007 | LOW | Interactive mode auto-allows permissions without prompting | `core/agents/acp-client.mjs` |
| SEC-008 | LOW | Stop hook trusts feedback JSON without schema validation | `plugin-claude/scripts/verifier-stop-hook.mjs` |
| SEC-009 | INFO | Naive YAML parser — no injection protection | `core/verifier/loop.mjs` |

---

## Verdict

**Not ready** — 3 P0, 7 P1, 10 P2 findings require attention before merge.

### Fix Order

1. **P0-1:** Enforce timeout in `AcpClient.prompt()` — add `AbortController` or `setTimeout`
2. **P0-2:** Fix CircuitBreaker half-open → open transition on probe failure
3. **P0-3:** Fix feedback file sort — extract numeric round from filename
4. **P1-12:** Error/warn on unknown council members
5. **P1-13:** Guard empty members array in council
6. **P1-15:** Add `once()` override to `BufferedEventEmitter`
7. **P1-16:** Fix adversarial-review parse callback to return string
8. **P1-17:** Fix council convergence check — compare structured output, not raw strings
9. **P1-18:** Guard negative `diffBytes` in `collectBranchContext`
10. **P2-24:** Fix YAML parser — split on first colon only, or use `js-yaml`
11. **P2-25:** Use absolute path for council checkpoint
12. **P2-26:** Fix greedy JSON regex — use non-greedy match or JSON parser
13. **P2-27:** Clean up rejected promises from LoadQueue

### Deferred (post-merge)

- **P0-4 through P0-11:** Test coverage for broker, goal-assistant, git, review-render, composer cycle detection, endpoint buffer, verifier loop — significant infrastructure work
- **SEC-001/002:** ACP env scrubbing — aligns with deferred Ship 1 NFF1
- **SEC-003/004:** Unix socket auth — requires IPC redesign
- **P1-14:** Idempotency cache TTL/size limit — operational concern
- **P2-19:** Availability caching — performance optimization
- **P2-20:** Verify command broker integration — requires Ship 2 broker event wiring
- **P2-21:** Council timeout config — usability improvement
- **P2-22:** Plan parser blank line handling — edge case
- **P2-23:** Conditional adapter registration — cleanup
- **P2-28:** Sanitizer refinement — low-impact edge case

---

## Coverage

- **Suppressed:** 106 findings below anchor 75 (P0 at anchor 50+ retained)
- **Demoted:** 0 (no testing/maintainability-only advisory P2-P3 findings)
- **Failed reviewers:** 0 (all 9 reviewers returned results)
- **Untracked files excluded:** `.opencode/worktrees/`, `debates/council/ping-*/`, `graphify-out/`

## Residual Risks

- Verifier loop not integrated with broker — `verify` command is a stub
- Council crash recovery writes checkpoint but resume is no-op
- No E2E test for broker → adapter → ACP → agent chain
- DLQ has no retry mechanism
- BufferedEventEmitter buffer has no size limit
- Agent adapters spawn subprocesses without resource limits
- `git.mjs` execSync maxBuffer default 10MB — large diffs may exceed
- Lifecycle CLI `end` action is no-op — broker instance not persisted

## Testing Gaps

- No test for circuit breaker state transitions (closed → open → half-open → open)
- No test for BufferedEventEmitter buffer drain with `once()` vs `on()`
- No test for verifier loop oscillation detection end-to-end
- No test for council with empty members or unknown member names
- No test for ACP client timeout enforcement
- No test for adversarial-review parse callback integration
- No test for `checkPendingFeedback` with round numbers >= 10
- No test for goal assistant plan parsing with blank lines between criteria
- No test for broker idempotency cache behavior
- No test for `loadVerifierConfig` with YAML values containing colons
