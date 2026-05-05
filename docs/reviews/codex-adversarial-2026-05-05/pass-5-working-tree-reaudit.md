# Codex Adversarial Review — Pass 5: Working-Tree Re-Audit

**Branch vs main:** `feature/acp-migration` vs `main`
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05
**Scope:** working-tree diff re-run after Phase D (`3e8c9ef`) to test for residual issues before Ship 1 ships.

## Summary

Verdict: **needs-attention (SHIP-WITH-FOLLOWUP)** — no new Ship-1 P0/P1 blockers. Codex re-confirms the two residuals already logged in Pass 4 and names them as the reasons to keep the merge-with-fix posture:

1. **F8 residual** — known companion flags (`--json`, `--model=`, `--effort=`) are still parsed after positional task text begins. Example: `agent --name=codex explain --json format` → task becomes `explain format` and JSON output flips.
2. **NFF1 (env allowlist)** — operational escape path missing. Users behind enterprise proxies (`HTTPS_PROXY`, `NO_PROXY`, `SSL_CERT_FILE`) or Vertex/ADC (`GOOGLE_APPLICATION_CREDENTIALS`, `CLOUDSDK_*`) must choose between broken agents and full `CHOREO_AGENT_ENV_PASSTHROUGH=1` bypass (re-introduces the original F6 leak class).

`npm run check-bundles` passed. `npm test` could not run inside the sandbox (read-only `mkdtemp` denied → 51 env failures); must be re-run in writable environment.

## Cross-Check Against Pass 4

| Pass 5 Finding | Severity | Matches Prior | Prior Location |
|---|---|---|---|
| Parser consumes known flags after task start | medium (P2) | **Yes — duplicate of Pass 4 F8 Residual** | `pass-4-phase-d-re-review.md` §F8 Residual parser gap |
| Env scrub forces users into full passthrough | medium (P2) | **Yes — duplicate of Pass 4 NFF1** | `pass-4-phase-d-re-review.md` §NFF1 |

**No new findings.** Codex's Pass 5 is an independent re-confirmation of the two residuals that Pass 4 explicitly left as follow-ups outside the Ship-1 gate.

## Evidence

- Parser: `core/companion.mjs:70-79` still scans every token until `--` and consumes known long flags even after the first positional token.
- Env: `core/runners.mjs:18-47` — `buildAgentEnv()` has only exact/prefix allowlist + all-or-nothing `CHOREO_AGENT_ENV_PASSTHROUGH=1` bypass. No additive allow hook.

## Recommendations (unchanged from Pass 4)

1. **F8 fix direction** — stop option parsing at first positional task token unless `--` is explicit. Add regression tests for `explain --json format`, `explain --model=foo`, `explain --effort=high` after first positional. Re-bundle all three plugin targets.
2. **NFF1 fix direction** — add narrow additive allow mechanism, e.g. `CHOREO_AGENT_ENV_ALLOW=HTTPS_PROXY,NO_PROXY,GOOGLE_APPLICATION_CREDENTIALS`. Test that those forward without forwarding unrelated secrets like `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `DATABASE_URL`.
3. **Test execution** — re-run `npm test` in a writable environment before merge to confirm full suite green.

## Ship-Gate Disposition

- Pre-Pass-5 SHIP-1 blockers: **0** (unchanged from Pass 4)
- Pass 5 new blockers: **0**
- Residuals carried forward as **Ship-1 debt, deferred to post-Ship-5 final review** (per user directive — do NOT fix between ships). See `docs/plans/2026-05-05-acp-migration-plan.md` §"Ship 1 — deferred to final plan review".

**Verdict unchanged:** MERGE-WITH-FIX. Ship-1 clears; F8 residual + NFF1 tracked and scheduled, not gating.
