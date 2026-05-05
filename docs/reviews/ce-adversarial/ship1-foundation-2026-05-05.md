# ce-code-review — Ship 1 Foundation Adversarial Review

**Branch:** `feature/acp-migration` (HEAD `3e8c9ef`)
**Base:** `main`
**Date:** 2026-05-05
**Scope:** 12 commits, 44 files, ~868 lines changed
**Reviewers:** correctness, testing, maintainability, security, reliability, adversarial, project-standards, ce-agent-native-reviewer, ce-learnings-researcher (9 reviewers)

## Why this review exists

Ship 1 foundation landed as merge `5371e012` and was hardened by 3 sequential `/xreview` rounds (commits `94ca34d` / `b0c9696` / `36861d7`) driven by the Claude panel (opus-4.7, qwen3.6-plus, gpt-5.4/5.5, kimi). A Codex cross-check (docs/reviews/codex-adversarial-2026-05-05/) produced 3 passes and a Phase D commit (`3e8c9ef`). This ce-code-review runs the compound-engineering multi-persona review harness as a third independent lens, asking: what did both prior review cycles miss?

## Verdict

**Not ready** — 2 P0 findings and 10 P1 findings must be addressed before merge to main. Fixes deferred pending consolidated security plan.

## Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 | 2 | Deferred — security plan |
| P1 | 10 | Deferred — security plan |
| P2 | 19 | Deferred — security plan |
| Pre-existing | 2 | Deferred — security plan |

## P0 — Critical (must fix before merge)

| # | File:Line | Issue | Reviewers | Route |
|---|-----------|-------|-----------|-------|
| 1 | `core/runners.mjs:23` | `NODE_OPTIONS` in env allowlist enables arbitrary code execution in child agents via `--require`/`--eval`/`--loader` | security, reliability, adversarial (3-of-3) | gated_auto → review-fixer |
| 2 | `core/companion.mjs:177` | stdout drain promise can hang forever if pipe reader disappears — process becomes zombie with no exit code | reliability | gated_auto → review-fixer |

## P1 — High

| # | File:Line | Issue | Reviewers | Route |
|---|-----------|-------|-----------|-------|
| 3 | `core/runners.mjs:114` | Signal-based exit code lost — killed agents report exit 1 instead of signal identity | correctness | safe_auto → review-fixer |
| 4 | `core/observability.mjs:164` | Retention uses mtime not filename date — touched files evade 7-day cleanup indefinitely | correctness, reliability (2-of-2) | safe_auto → review-fixer |
| 5 | `core/runners.mjs:101` | Timeout kills child with SIGTERM but does not wait for death — orphan process leak | reliability | gated_auto → review-fixer |
| 6 | `core/observability.mjs:139` | Cascade failure: rotation throws but appendFileSync still runs — oversized file grows past cap | adversarial | gated_auto → review-fixer |
| 7 | `core/runners.mjs:40` | `CHOREO_AGENT_ENV_PASSTHROUGH=1` bypasses all env scrubbing with no audit trail | adversarial | advisory → human |
| 8 | `core/observability.mjs:78` | SIGUSR1 signal handler will crash on Windows at module load | project-standards | safe_auto → review-fixer |
| 9 | `core/tests/agent-subcommand.test.mjs` | No test for signal-kill scenario (agent killed, null exit code) | testing | gated_auto → review-fixer |
| 10 | `core/tests/observability.test.mjs` | No test for O_EXCL exhaustion (20 attempts) error path | testing | gated_auto → review-fixer |
| 11 | `core/tests/observability.test.mjs` | No test for appendFileSync failure path (ENOSPC/EIO/EACCES) | testing | gated_auto → review-fixer |
| 12 | `core/tests/agent-subcommand.test.mjs:195` | agent_completion NDJSON event not verified for non-zero exit codes | testing | safe_auto → review-fixer |

## P2 — Moderate

| # | File:Line | Issue | Reviewers | Route |
|---|-----------|-------|-----------|-------|
| 13 | `core/runners.mjs:36` | `CLAUDE_` and `CODEX_` prefix allowlists leak tenant identity and configuration | security, correctness (2-of-2) | gated_auto → review-fixer |
| 14 | `core/observability.mjs:32` | Log directory and files created with default umask — readable by other users | security | safe_auto → review-fixer |
| 15 | `core/companion.mjs:141` | Observability failures silently swallowed — no diagnostic signal (4-of-4 agreement) | correctness, reliability, maintainability, adversarial | safe_auto → review-fixer |
| 16 | `core/observability.mjs:114` | TOCTOU race between statSync size check and renameSync — one oversized append possible | correctness, reliability, adversarial (3-of-3) | advisory → human |
| 17 | `core/tests/agent-subcommand.test.mjs` | No direct unit tests for buildAgentEnv function | testing | safe_auto → review-fixer |
| 18 | `core/observability.mjs:78` | SIGUSR1 handler registered unconditionally at module load time | reliability | manual → downstream-resolver |
| 19 | `docs/solutions/developer-experience/write-tool-empty-params...md:4` | Inconsistent category frontmatter in solution docs | project-standards | safe_auto → review-fixer |
| 20 | `core/observability.mjs:120` | Magic number 20 for retry attempts not extracted as named constant | maintainability | safe_auto → review-fixer |
| 21 | `core/companion.mjs:128` | Unreachable default case in agent switch — dead code | correctness, maintainability (2-of-2) | safe_auto → review-fixer |
| 22 | `core/companion.mjs:136` | No session_id propagation in observability events | ce-agent-native-reviewer | safe_auto → review-fixer |
| 23 | `core/runners.mjs:18` | CI and BUILD env vars not in allowlist — agents in CI contexts lose context | ce-agent-native-reviewer | safe_auto → review-fixer |
| 24 | `core/tests/agent-subcommand.test.mjs:212` | describeTask hash determinism and format not verified | testing | safe_auto → review-fixer |
| 25 | `core/tests/agent-subcommand.test.mjs` | No test for `--` delimiter with no following tokens (empty task) | testing | safe_auto → review-fixer |
| 26 | `core/tests/observability.test.mjs` | ensureDir failure path not tested (EACCES/EROFS on mkdir) | testing | gated_auto → review-fixer |
| 27 | `core/observability.mjs:84` | SIGUSR1 handler has no reentrancy guard — rapid signals cause concurrent rotate() | adversarial | safe_auto → review-fixer |
| 28 | `core/observability.mjs:121` | O_EXCL retry loop (20 attempts) can be exhausted by pre-creating backup files | adversarial | gated_auto → review-fixer |
| 29 | `core/companion.mjs:18` | task_length side channel leaks prompt size even when content is hashed (3-of-3) | security, adversarial, project-standards | gated_auto → downstream-resolver |
| 30 | `core/companion.mjs:110` | Codex exec does not receive `--dangerously-skip-permissions` — may hang in automated contexts | ce-agent-native-reviewer | manual → human |
| 31 | `core/runners.mjs:99` | No upper bound on task length — large output causes massive stdout buffering | adversarial | gated_auto → review-fixer |

## Pre-existing Issues

| # | File:Line | Issue | Reviewers | Route |
|---|-----------|-------|-----------|-------|
| — | `core/companion.mjs:437` | `known` command list manually maintained — not DRY with handler blocks | maintainability | gated_auto → review-fixer |
| — | `scripts/check-bundles.mjs:1` | Bundle drift detection script exists but is not automated (no CI, no hooks) | maintainability | manual → human |

## Residual Risks

- Observability is best-effort by design — emit() failures are intentionally non-fatal. NDJSON logs can silently stop working.
- The env allowlist is a whitelist but `CHOREO_AGENT_ENV_PASSTHROUGH` provides a complete bypass.
- Midnight rollover: if emit() is called at exactly 00:00:00, rotate() runs on the old date's files, then dateKey() returns the new date.
- Aggregate storage bound: with N concurrent processes each rotating independently, the same day's total storage is bounded by N × cap + retention files.
- Plugin bundles embed observability inline rather than importing from core/observability.mjs. If core is updated, plugins must be rebuilt.
- Task hash uses first 16 hex chars of SHA-256 (64 bits). Birthday collision becomes probable at ~5 billion tasks.
- If the agent binary itself is compromised (supply chain attack), the env allowlist provides no protection.

## Testing Gaps (22 items)

- No signal-kill tests (SIGKILL/SIGTERM) for agent subprocess — null code path untested
- O_EXCL exhaustion (20 attempts) error path untested
- appendFileSync failure (ENOSPC/EIO) untested
- ensureDir mkdirSync failure (EACCES/EROFS) untested
- describeTask: no hash determinism test, no format/length verification (16 hex chars)
- agent_completion NDJSON event not verified for non-zero exit codes or hasError field
- agent_invocation model/effort fields not verified in NDJSON events
- No direct unit tests for buildAgentEnv — only integration via runCompanion
- LC_ and XDG_ prefix passthrough untested
- Empty task after `--` delimiter untested
- No test for SIGUSR1 handler behavior — verify rotate() is called and errors are swallowed
- No test for stdout drain hang scenario — simulate a pipe reader that stops consuming
- No test for timeout SIGTERM followed by SIGKILL fallback — verify orphan process cleanup
- No test for NODE_OPTIONS being forwarded to child — verify arbitrary code injection is possible
- No test for disk full (ENOSPC) scenario — verify emit() throws and caller handles it
- No test for read-only filesystem (EROFS) — verify graceful degradation
- No test for rapid SIGUSR1 signals — verify no duplicate rotation or resource exhaustion
- No test for the 20-attempt O_EXCL exhaustion path — verify error message is informative
- No test for cross-device rename (EXDEV) — what happens if CHOREO_LOG_DIR is on a different mount than tmp
- No test for extremely long task text (e.g. 100KB+)
- No test for NDJSON line length limits — what happens when an event produces a 10MB JSON line?
- No plugin bundle tests — but no plugin changes in Ship 1, so N/A for this ship

## Agent-Native Gaps

- `emit()` not exposed as public API — agents can't emit custom events
- No `session_id` propagation in observability events
- CI env vars stripped from child agents

## Schema Drift Check

No migration files present — schema drift check N/A.

## Deployment Notes

N/A — no database migrations or deployment changes in Ship 1.

## Related Assets

| Asset | Path | Relationship |
|-------|------|--------------|
| Codex adversarial review | `docs/reviews/codex-adversarial-2026-05-05/README.md` | Prior independent review; this review corroborates + extends its findings |
| xreview hardening doc | `docs/solutions/developer-experience/xreview-multi-round-hardening-2026-05-05.md` | Prior 3-round Claude panel review; this review found gaps the panel missed |
| ACP migration foundation | `docs/solutions/architecture-patterns/acp-migration-foundation-2026-05-05.md` | Ship 1 baseline this review evaluates |
| ACP migration plan | `docs/plans/2026-05-05-acp-migration-plan.md` | Forward-looking Ship 2+ design; security plan should inform Ship 2 broker design |
| Phase D commit | `3e8c9ef` on `feature/acp-migration` | Last Ship 1 code change; findings 1–31 are against this state |
| Run artifacts | `/tmp/compound-engineering/ce-code-review/ship1-review/` | Per-reviewer JSON findings + synthesis |
