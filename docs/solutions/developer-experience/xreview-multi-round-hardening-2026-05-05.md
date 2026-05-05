---
title: Multi-Round xreview Hardens Ship 1 Foundation
date: 2026-05-05
category: developer-experience
module: observability
problem_type: workflow_pattern
component: quality-assurance
severity: medium
applies_when:
  - "Landing a non-trivial foundation commit (observability, dispatch, rotation) that needs verification"
  - "Wanting cross-model corroboration on code before merging to main"
  - "A previous review surfaced regressions that need re-verification after fixes"
  - "Multiple independent AI reviewers can converge on the same finding"
tags:
  - xreview
  - adversarial-review
  - cross-model
  - observability
  - rotation
  - corroboration
  - ship-1
---

# Multi-Round xreview Hardens Ship 1 Foundation

## Context

Ship 1 landed as merge `5371e012` on `feature/acp-migration` — new NDJSON observability module + single-agent dispatch fix with exit-code propagation, PII redaction, and log rotation. Foundation-level code used by every agent dispatch. Needed verification beyond single-model self-review.

Solo-model review historically missed subtle concurrency, rotation, and exit-code issues on this surface. `/xreview` with 3–4 independent opencode-hosted models in parallel + cross-model corroboration was chosen as the gating bar before merge to `main`.

## Solution

Three sequential `/xreview` rounds. Each round targeted the prior commit's HEAD. Each round produced a structured JSON findings array from every panelist. Cross-model agreement (2+ panelists flagging the same issue independently) drove the fix priority. Solo findings were triaged — high-confidence solos fixed alongside corroborated ones, low-confidence deferred to Ship 2.

### Round cadence

| Phase | Target | Base | Panel | Raw outputs |
|-------|--------|------|-------|-------------|
| A | `5371e012` (merge) | `d45711e` | kimi-k2.6 (hung), qwen3.6-plus, opus-4.7, gpt-5.5 | `/tmp/xreview/xreview-1220f4/` |
| B | `94ca34d` (Phase A fix) | `5371e012` | kimi, qwen, opus-4.7, gpt-5.4 (swapped from 5.5 per user) | `/tmp/xreview/xreview-40ba3f/` |
| C | `b0c9696` (Phase B fix) | `94ca34d` | qwen, opus-4.7, gpt-5.4 (kimi killed) | `/tmp/xreview/xreview-163a60/` |

### Corroboration thresholds applied

- **3-of-N** → always-fix, treated as load-bearing
- **2-of-N** → fix unless clearly invalid
- **1-of-N high-confidence** → fix if trivial; defer if broad refactor
- **1-of-N P0/P1** → verify by direct code inspection before trusting; 2 Phase-A P0s were verified as false positives (parser imports, codex arg splice)

### Commit stack produced

```
36861d7  Phase C — agent branch fall-through + O_EXCL reservation + strict env parse + flag ordering
b0c9696  Phase B — rotate filter, sequential backups, fail-closed rename, readEvents stitch, ESM test isolation
94ca34d  Phase A — CHOREO_LOG_DIR isolation, rotate+truncation fix, PII redaction, parser exercise tests
5371e012 Merge ship/1-foundation (baseline under review)
```

## Corroborated findings that became real fixes

### Phase A (3 panelists after kimi hung)

| Finding | Agreement | Fix |
|---------|-----------|-----|
| `rotate()` dead code — never called, no SIGUSR1 | 3/3 | Module-load SIGUSR1 handler + first-emit lazy call |
| `writeFileSync(file, '')` on 100MB cap wipes events | 2/3 | Replaced with rename-rotate to numbered backup |
| Tests pollute real `~/.choreo/logs/` | 2/3 | `CHOREO_LOG_DIR` env + `mkdtempSync` per test |
| Agent subcommand never propagates `result.code` | Solo high-conf | Exit code from runAgent result |
| Raw task leaks to NDJSON | 2/3 P2 | SHA-256 hash + length only, no preview |

### Phase B (4 panelists)

| Finding | Agreement | Fix |
|---------|-----------|-----|
| `rotate()` filter `f.includes('.ndjson')` too broad | 3/4 | Regex whitelist `^YYYY-MM-DD\.ndjson(\.N)?$` |
| Aggregate 100MB/day cap not enforced (gpt-5.4 ran code to verify) | 3/4 | Per-file cap + 7-day retention as bound (aggregate prune conflicts with rotation) |
| `renameSync` failure silently skipped → file grows past cap | 3/4 | Fail-closed — emit throws, outer try/catch swallows |
| `rotatedThisProcess` persists across ESM dynamic imports | 3/4 | `__resetForTest()` export |
| `Date.now()` backup-name collision | 2/4 | Sequential counter `nextBackupSeq()` |
| SIGUSR1 module-import registration | 2/4 | Kept (low risk Ship 1) |
| `task_length` side-channel | 2/4 | Deferred — revisit in Ship 2 |
| `readEvents` doesn't read numbered backups | Solo gpt-5.4 (high-conf, paired with aggregate-cap) | Chronological stitch across backup + active |
| `process.exit` after `console.log` truncates stdout | Solo kimi (high-conf) | Use `process.exitCode` then later (Phase C) explicit drain + hard exit |
| Signal-kill `null` code → exit 0 | Solo qwen (high-conf) | Treat null as exit 1 |

### Phase C (3 panelists after kimi stalled)

| Finding | Agreement | Fix |
|---------|-----------|-----|
| `nextBackupSeq` race — POSIX `renameSync` atomically clobbers dest | 3/3 (P1) | O_EXCL `openSync(..., 'wx')` sentinel reservation, 20-retry bound |
| companion.mjs fall-through past `process.exitCode` | 2/3 (P1) | `process.stdout.write('', resolve)` drain + `process.exit(code)` |
| Intra-day unbounded rotation (`cap × N`) | 2/3 (P2) | Accepted; deferred to Ship 2 broker |
| `CHOREO_LOG_MAX_BYTES` tolerates garbage (`"1024abc"` → 1024, `"0"` → default) | 2/3 (P3) | Strict `/^\d+$/` after trim |
| `rotatedThisProcess=true` set before rotate() | Solo opus (P3) | Flag set AFTER rotate() — throw no longer locks out retention |

## Cross-model characteristic patterns observed

- **opus-4.7 (bedrock)**: thorough, 10–12 findings per round, flags solo P2/P3s no one else catches. Occasional false positive when reviewing diff alone without repo context (Phase A imported-parser claim). Best signal on design-level concerns.
- **qwen3.6-plus**: medium depth (4–7 findings), focuses on input validation + exit semantics. Low false-positive rate. Good at spotting defaulting/regression shifts.
- **gpt-5.4** (replaced 5.5): sparse (2 findings) but ran code to verify — caught the aggregate-cap regression other panelists missed because it wasn't visible from the diff alone. Highest-value-per-finding.
- **kimi-k2.6**: unreliable runtime (stalled twice across 3 rounds). When it returned, its Phase B findings matched corroborated cluster. Not worth waiting for but not worth permanently excluding.

## Deferred to Ship 2

Findings whose resolution belongs with the single-writer broker:
- Intra-day aggregate cap (opus + gpt-5.4, P2)
- `__resetForTest` export in shipped bundle (opus, P3)
- renameSync ENOENT race between statSync and rename (opus, P2)
- Retention sweep mtime-skew backup-delete (opus, P2)
- Sort-by-seq chronological assumption under race (opus, P2)
- `task_length` side-channel (qwen + opus, P3)
- TOCTOU statSync ENOENT race (qwen, P2 — pre-existing)
- Fail-closed chmod test non-portable on root/CI (opus, P3)

## Test coverage delta

59 tests on Ship 1 HEAD vs ~30 on baseline merge. New test surface:
- Rotation semantics (sequential naming, O_EXCL reservation race survival)
- Retention (managed scheme whitelist, unrelated-file preservation)
- Input validation (7-case strict `CHOREO_LOG_MAX_BYTES` parse probe)
- Fail-closed semantics (rename failure throws, active file unchanged)
- PII redaction (secret never appears in NDJSON payload)
- Parser invocation (stream-json assistant extraction, ANSI stripping)
- Signal-kill exit propagation, stdout drain before exit

## Learnings

### Use external reviewers on foundation code

Observability, rotation, and dispatch are the kind of code where a single-model self-review consistently misses subtle concurrency, truncation, and retention bugs. The real cost was only ~3 min wall-clock per round for 4 models in parallel.

### Verify high-severity solos before trusting

Two Phase A P0s from opus-4.7 turned out to be false positives (reviewer saw diff-only, missed imports present outside the diff range). A quick `grep -n` confirmed and we demoted before committing. Never skip the verification step when only one panelist claims P0 — it's the class most prone to diff-context mistakes.

### Cross-round regression discovery

Phase B found 4 corroborated **regressions introduced by the Phase A fix** — gpt-5.4 verified one (aggregate cap) by running code. Single-round review would have merged Phase A. The cycle paid for itself.

### Model swapping matters

Swapping gpt-5.5 → gpt-5.4 in Phase B surfaced the code-verified aggregate-cap regression. Different model generations emphasize different checks; rotating panels across rounds improved coverage.

### Fail-closed beats fail-silent for observability

Phase A's `try { rename } catch { /* append anyway */ }` looked safe (never blocks emit) but masked a real data-loss scenario. Phase B's fail-closed version throws back to the caller's outer `try/catch` — the caller already handles it. Prefer the noisy failure mode on infrastructure code where silent fallbacks mask bugs.

### Document comment claims can drift

Phase B added a comment claiming "remaining branches short-circuit because cmd==='agent'". Phase C found this is fragile — the next command handler added could match. Use explicit `return` or `process.exit` rather than relying on guard invariants future code may not preserve.

## Resources

- Raw panel outputs: `/tmp/xreview/xreview-{1220f4,40ba3f,163a60}/raw/`
- Aggregated findings: `/tmp/xreview/xreview-{40ba3f,163a60}/agreement.json`
- Commits: `94ca34d`, `b0c9696`, `36861d7` on `feature/acp-migration`
- Foundation prior-art: `docs/solutions/architecture-patterns/acp-migration-foundation-2026-05-05.md`
- /xreview skill: `/Users/mk/.claude/skills/xreview/SKILL.md`

## Related Entries

- `docs/solutions/architecture-patterns/acp-migration-foundation-2026-05-05.md` — Ship 1 baseline this hardened
- `docs/plans/2026-05-05-acp-migration-plan.md` — forward-looking Ship 2 broker design
- `docs/reviews/codex-adversarial-2026-05-05/README.md` — Codex cross-check that produced Phase D fixes
- `docs/reviews/ce-adversarial/ship1-foundation-2026-05-05.md` — 9-persona ce-code-review; 2 P0 + 10 P1 findings deferred pending consolidated security plan
