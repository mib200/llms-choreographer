---
title: Codex Reviews — Always Invoke with a Write-Capable Sandbox
date: 2026-05-05
category: developer-experience
module: codex-review
problem_type: developer_experience
component: tooling
severity: high
applies_when:
  - "Running `/codex:adversarial-review`, `/codex:review`, or `/codex:rescue` against branches or working trees"
  - "Codex review scope includes executing `npm test`, `pytest`, build steps, or any tool that calls `mkdtemp`"
  - "Interpreting a Codex review verdict that reports 'could not validate the suite' or listing `EROFS` / `read-only file system` errors"
  - "Pre-merge adversarial verification where test evidence is load-bearing for the ship-gate decision"
related_components:
  - development_workflow
  - testing_framework
tags:
  - codex-cli
  - adversarial-review
  - sandbox
  - workspace-write
  - npm-test
  - false-negative
  - review-workflow
---

# Codex Reviews — Always Invoke with a Write-Capable Sandbox

## Context

Codex CLI runs reviews inside a sandbox. The default sandbox is **read-only**, which blocks any tmp-file creation (`mkdtemp`) and returns `EROFS` / `read-only file system`. When a review scope includes test execution (`npm test`, `pytest`, `go test`, `cargo test`) or build steps, the sandbox denies those writes and the reviewer reports **"could not validate the suite"** — a false-negative verdict caused entirely by sandbox policy, not real test failure.

Triggering incident (2026-05-05): Pass 5 adversarial re-audit of `feature/acp-migration` Phase D against `main`. Codex explicitly noted "`npm test` could not prove safety here because the read-only sandbox denied `mkdtemp`, causing 51 environment failures." Artifact: `docs/reviews/codex-adversarial-2026-05-05/pass-5-working-tree-reaudit.md`. No real regressions; the verdict was invalid. User directive: memorize globally that Codex reviews always run with a write-capable sandbox. (auto memory [claude]: `feedback_codex_review_sandbox.md` is the definitive directive source.)

## Guidance

Always invoke Codex reviews with a write-capable sandbox. Three options, in order of preference:

**Option 1 — Persistent config** at `~/.codex/config.toml` (lowest friction on a dev machine):

```toml
sandbox_mode = "workspace-write"
```

All subsequent `codex` invocations (including `/codex:adversarial-review`, `/codex:review`, `/codex:rescue`) will use `workspace-write`.

**Option 2 — Per-invocation flag** when the config cannot be changed (CI, shared machine):

```bash
# Allow writes inside the current project workspace (recommended default)
codex --sandbox workspace-write ...

# No restrictions — use only when workspace-write is insufficient
codex --sandbox danger-full-access ...
```

**Option 3 — Pre-run tests outside Codex** when a plugin command hard-codes read-only:

```bash
# Run tests externally, capture output
npm test 2>&1 | tee /tmp/test-output.txt

# Then invoke review with focus text pointing at the output
# /codex:adversarial-review  (focus: "test results in /tmp/test-output.txt — treat as authoritative")
```

The reviewer stays read-only but receives authoritative test evidence it cannot falsify.

## Why This Matters

`mkdtemp` / `EROFS` failures are **sandbox-policy artifacts**, not test failures. Accepting a "could not validate" verdict at face value:

- Lets real regressions slip past review undetected
- Produces review reports with inflated failure counts (51 phantom failures in the Phase D incident)
- Creates false confidence when the suite actually fails silently
- Wastes re-audit cycles diagnosing phantom failures
- Invalidates ship-gate decisions that depend on test evidence — in this project, the post-Ship-5 final review that closes F8 + NFF1 debt MUST run with writable sandbox or the verdict is meaningless (see `docs/plans/2026-05-05-acp-migration-plan.md` §"Ship 1 — deferred to final plan review")

Read-only is a safe default for pure code inspection (reduces blast radius) but silently invalidates any verdict that depends on test or build execution.

## When to Apply

- **Always** for any Codex review invocation where the review scope includes test execution, build steps, or file-generating tools.
- **Exception 1:** pure static-analysis reviews with no test/build step — read-only is appropriate and safer.
- **Exception 2:** environments where workspace write access is a genuine security concern — use Option 3 (pre-run tests outside Codex, pass output file as focus text).

Diagnostic signal: if Codex review output contains `mkdtemp`, `EROFS`, `read-only file system`, or "could not validate the suite" → re-run with writable sandbox before accepting the verdict.

## Examples

**Before (broken — false negative):**

```bash
# Default: sandbox is read-only
codex "adversarial review of feature/acp-migration Phase D"
# → 51 failures: "mkdtemp: read-only file system"
# → Verdict: "needs-attention — could not validate the suite" (false negative)
```

**After (correct — persistent config):**

```toml
# ~/.codex/config.toml
sandbox_mode = "workspace-write"
```

```bash
# All subsequent invocations use workspace-write automatically
codex "adversarial review of feature/acp-migration Phase D"
# → npm test runs, real results reported
# → Verdict reflects actual test status
```

**After (correct — per-invocation flag):**

```bash
codex --sandbox workspace-write "adversarial review of feature/acp-migration Phase D"
```

**After (correct — pre-run workaround for hard-coded read-only plugins):**

```bash
npm test 2>&1 | tee /tmp/test-output.txt
# Then: /codex:adversarial-review
# Focus text: "Test results are in /tmp/test-output.txt — treat as authoritative"
```

## Related

- `docs/solutions/developer-experience/xreview-multi-round-hardening-2026-05-05.md` — sibling review-workflow pattern; applies the same "cross-model corroboration" discipline at the multi-reviewer layer. This doc is the sandbox-configuration layer under it.
- `docs/reviews/codex-adversarial-2026-05-05/pass-5-working-tree-reaudit.md` — triggering incident artifact.
- `docs/reviews/ce-adversarial/ship1-foundation-2026-05-05.md` — 9-persona ce-code-review on Ship 1; test suite validation requires writable sandbox per this doc's guidance.
- `docs/plans/2026-05-05-acp-migration-plan.md` §"Ship 1 — deferred to final plan review" — post-Ship-5 final review depends on this sandbox configuration to produce a valid verdict when closing F8 + NFF1 debt.
- Global rule: `~/.claude/CLAUDE.md` §10 "Codex reviews — always writable sandbox".
- Project memory: `/Users/mk/.claude/projects/-Users-mk-Repositories-mib200-AI-choreographer/memory/feedback_codex_review_sandbox.md`.
