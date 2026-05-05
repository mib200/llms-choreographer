# Codex Adversarial Review — Pass 4: Phase D Re-Review

**Phase D commit:** `3e8c9ef`
**Prior state:** `36861d7`
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05

## Summary
SHIP-WITH-FOLLOWUP. Phase D removes the Ship-1 FF1 data-loss race and closes the original F6 full-env leak by default. F8 is only partial: unknown `--*` task tokens now survive, and `--` works, but known companion flags that appear after task text are still consumed as flags, so prompts like `explain --json format` remain corrupted unless the user knows to insert `--`.

## Target Disposition

| Finding | Original Sev | Verdict | Evidence |
|---------|--------------|---------|----------|
| FF1 | P1 SHIP-1 | fully-fixed | core/observability.mjs:L116-L143 |
| F6  | P1        | fully-fixed | core/runners.mjs:L18-L47, core/runners.mjs:L95-L99 |
| F8  | P2        | partial | core/companion.mjs:L66-L79 |

## FF1 — Rotation source-file race
- **Patch location:** core/observability.mjs:L116-L143
- **Verdict:** fully-fixed.
- **Original attack re-check:** the pre-Phase-D loser path was `renameSync(file, rotatedName)` with no `ENOENT` handling at core/observability.mjs@36861d7:L132-L134. Phase D now reserves a destination, attempts `renameSync`, unlinks the stale sentinel on failure, tolerates only `ENOENT`, and then reaches `appendFileSync(file, line, 'utf8')` at core/observability.mjs:L138-L146. That closes the race where another process already moved the active file after this process observed it above cap.
- **New surface (if any):** no new P0/P1 surface. The stale-sentinel cleanup is scoped to the uniquely reserved backup path; another managed emitter cannot claim that path while the sentinel exists. Non-`ENOENT` failures still propagate after cleanup at core/observability.mjs:L140-L143, preserving fail-closed behavior.
- **Test adequacy:** the worker test covers the right outcome by requiring all four IDs to be present through `readEvents()` at core/tests/observability.test.mjs:L232-L258, and the helper forces each worker onto the shared log dir/cap path at core/tests/helpers/concurrent-emit-worker.mjs:L8-L12. It is probabilistic, not deterministic: there is no barrier between worker startup and `statSync`, so some pre-patch runs can pass if later workers stat after the winner has already rotated. Manual stress against archived `36861d7` failed 25/50 runs; current Phase D failed 0/50.

## F6 — Env allowlist
- **Patch location:** core/runners.mjs:L18-L47 (buildAgentEnv), spawn call at core/runners.mjs:L95-L99
- **Verdict:** fully-fixed for the original security finding.
- **Original attack re-check:** pre-Phase-D `spawn(binary, args, ...)` inherited the full parent environment. Phase D passes `env: buildAgentEnv()` at core/runners.mjs:L95-L99. By default `buildAgentEnv()` copies only exact/prefix allowlist entries at core/runners.mjs:L18-L47, so broad secret namespaces like `AWS_*`, `GITHUB_TOKEN`, `DATABASE_URL`, and `NPM_TOKEN` no longer reach child agents.
- **Allowlist completeness:** security posture is correct, but operational coverage is incomplete. PATH and locale basics are present at core/runners.mjs:L18-L23. Anthropic/OpenAI direct API env is present at core/runners.mjs:L24-L31. Prefixes cover `LC_`, `XDG_`, `ANTHROPIC_`, `CLAUDE_`, `OPENCODE_`, and `CODEX_` at core/runners.mjs:L33-L37. Common proxy vars (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) and Vertex/ADC vars (`GOOGLE_APPLICATION_CREDENTIALS`, `CLOUDSDK_*`) are not forwarded unless the full passthrough escape hatch is used. AWS Bedrock credential env is intentionally not allowlisted except for `CLAUDE_CODE_USE_BEDROCK`.
- **Escape hatch review:** `CHOREO_AGENT_ENV_PASSTHROUGH=1` is safe only as a documented, explicit full bypass. It is coarse: setting it in a shell profile reintroduces the original leak. The code makes that behavior obvious at core/runners.mjs:L39-L40 and tests it at core/tests/agent-subcommand.test.mjs:L313-L338.
- **Test adequacy:** adequate for the original leak. The scrub test injects AWS/GitHub/DB/NPM secrets and checks they are missing while HOME survives at core/tests/agent-subcommand.test.mjs:L242-L278. The allow test verifies Anthropic/OpenAI/CODEX env at core/tests/agent-subcommand.test.mjs:L281-L310. The helper's `extraEnv` injection makes the assertions meaningful at core/tests/helpers/fake-agents.mjs:L64-L71.

## F8 — Task parser rewrite
- **Patch location:** core/companion.mjs:L66-L79
- **Verdict:** partial.
- **Original attack re-check:** the original `rest.filter(a => !a.startsWith('--'))` dropped every dashed task token. Phase D now consumes only `--json`, `--name=`, `--model=`, and `--effort=` before `--`, and pushes other tokens into `taskTokens` at core/companion.mjs:L70-L79. That fixes examples such as `explain --force and --no-verify`.
- **Delimiter edge cases:** `--` with nothing after it correctly leaves an empty task and errors via the existing usage check at core/companion.mjs:L72-L87. `--` before task preserves later known flags as task text because `afterDashDash` pushes every remaining token at core/companion.mjs:L70-L72. Doubled `-- --` yields task text of literal `--`; the companion parser preserves it, though a downstream CLI may still parse that single prompt argument specially.
- **Residual parser gap:** known companion flags are still consumed even after task text has started. Example verified with the fake Codex agent: `agent --name=codex explain --json format` produces task `explain format` and flips JSON output, because the loop scans all tokens until `--` and consumes `--json` at core/companion.mjs:L70-L79. Given usage documents flags before `<task>`, option parsing should probably stop at the first positional task token unless an explicit `--` appears.
- **Test adequacy:** partial. The unknown-flag test at core/tests/agent-subcommand.test.mjs:L341-L363 and delimiter test at core/tests/agent-subcommand.test.mjs:L366-L387 are good, but no test covers known flag names inside task text after the first positional token. The current tests would not catch `explain --json format`, `explain --model=foo`, or `explain --effort=high` corruption.

## New Issues Introduced by Phase D

No new P0/P1 issues introduced by Phase D.

### NFF1 — Default env scrub drops common connectivity/auth env [P2]
- **File:** core/runners.mjs:L18-L47
- **Issue:** the allowlist omits proxy and Google/Cloud SDK env vars, so child agents behind enterprise proxies or Claude Vertex/ADC workflows can fail unless users enable full env passthrough.
- **Attack/failure scenario:** a user has `HTTPS_PROXY`/`NO_PROXY` or `GOOGLE_APPLICATION_CREDENTIALS` configured in the parent shell. `choreo agent --name=claude ...` starts, but the child CLI cannot reach its API or load ADC because those vars are stripped.
- **Fix direction:** add narrowly documented opt-ins for proxy/CA and cloud-provider auth env, or add a `CHOREO_AGENT_ENV_ALLOW=VAR1,VAR2` mechanism so users do not need to choose between broken agents and full secret passthrough.

### NFF2 — FF1 regression test is race-dependent [P3]
- **File:** core/tests/observability.test.mjs:L247-L253
- **Issue:** the concurrent worker test has no start barrier, so it does not guarantee every worker reaches the oversized-file `statSync` before the first worker rotates.
- **Attack/failure scenario:** pre-Phase-D code can pass when only one worker observes the oversized active file and the rest append after rotation, masking the loser-`ENOENT` path.
- **Fix direction:** add a worker barrier or monkeypatch hook that pauses all workers after reserve/stat and releases them together before `renameSync`.

## Bundle Parity

- plugin-claude/scripts/companion.mjs — FF1 ENOENT [✓], F6 buildAgentEnv [✓], F8 new parser [✓]
- plugin-codex/scripts/companion.mjs — FF1 [✓], F6 [✓], F8 [✓]
- plugin-opencode/dist/companion.mjs — FF1 [✓], F6 [✓], F8 [✓]

The relevant generated ranges are semantically and byte-identically present across all three bundles: env allowlist/buildAgentEnv at plugin-claude/scripts/companion.mjs:L35-L83, spawn env at L129-L133, ENOENT cleanup at L277-L285, and parser at L339-L371. The same ranges hash-identically in plugin-codex/scripts/companion.mjs and plugin-opencode/dist/companion.mjs.

## Final Ship Gate

- Pre-Phase-D SHIP-1 blockers: 1 (FF1)
- Post-Phase-D SHIP-1 blockers: **0**
- SHIP-2 items deferred (unchanged): F3 residual (file perms), F4 residual (mtime retention), FF2 (completion correlation id)
- **Verdict:** MERGE-WITH-FIX — FF1 and F6 clear the Ship-1 gate, but F8 remains a residual P2 for known flag tokens after task text, and the env allowlist needs a non-full-passthrough operational escape path.
