# Codex Adversarial Review — Pass 2: Fix Verification

**Fixes under review:** 94ca34d (Phase A) → b0c9696 (Phase B) → 36861d7 (Phase C)
**Against:** Pass 1 findings on 5371e012
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05

## Disposition Matrix

| Finding | Severity | Phase A | Phase B | Phase C | Final | Evidence |
|--------|----------|---------|---------|---------|-------|----------|
| F1 | P0 | Replaced truncate with rename-to-backup | Made backups sequential and readable | Added O_EXCL backup reservation | **fixed** | Phase A `pass2-phaseA-core.diff:126-134`; final `core/observability.mjs:116-137`, `core/observability.mjs:172-183` |
| F2 | P1 | Added exit propagation via `process.exit(...)` | Switched to `process.exitCode`, risking fallthrough | Restored hard exit after stdout drain | **fixed** | Phase C `pass2-phaseC-core.diff:5-23`; final `core/companion.mjs:155-164`; test `core/tests/agent-subcommand.test.mjs:177-192` |
| F3 | P1 | Removed raw task from invocation event | No private-mode fix | No private-mode fix | **partially-fixed** | Final redaction `core/companion.mjs:15-19`, `core/companion.mjs:119-126`; residual permissions `core/observability.mjs:29-33`, `core/observability.mjs:137` |
| F4 | P1 | Narrowed sweep to owned log names | Added owned-name parser and unrelated-file test | No date-ownership fix | **partially-fixed** | Final owned regex `core/observability.mjs:8-9`, `core/observability.mjs:46-54`; residual mtime deletion `core/observability.mjs:148-156` |
| F5 | P1 | Removed truncation, but timestamp backup was still race-prone | Added sequential backups, still no reservation | Added O_EXCL reservation before rename | **fixed** | Phase C `pass2-phaseC-core.diff:70-103`; final `core/observability.mjs:116-137`; test `core/tests/observability.test.mjs:208-229` |
| F6 | P1 | No matching core hardening; bundles copied unsafe behavior | No matching core hardening | No matching core hardening | **unchanged** | Final `core/companion.mjs:94`, `core/companion.mjs:108`, `core/runners.mjs:61` |
| F7 | P2 | Added `CHOREO_LOG_DIR` and isolated tests | Added env reset for max-bytes/test cache | Added more isolated env tests | **fixed** | Final `core/observability.mjs:11-12`; tests `core/tests/observability.test.mjs:8-27`, `core/tests/agent-subcommand.test.mjs:8-27` |
| F8 | P2 | No matching core fix; bundles copied same parser | No matching fix | No matching fix | **unchanged** | Final `core/companion.mjs:61-65` |

## Detailed Disposition

### F1 — Active-day rotation truncates the audit log [was P0]
- **Phase A action:** Replaced `writeFileSync(file, '')` truncation with `renameSync(file, rotatedName)` before append (`pass2-phaseA-core.diff:126-134`).
- **Phase B action:** Replaced timestamp backup names with sequential numbered backups and made `readEvents()` stitch backups plus active file.
- **Phase C action:** Added an exclusive backup-name reservation loop before rename (`pass2-phaseC-core.diff:70-103`).
- **Final state:** fixed
- **Residual concern (if any):** None for the original truncation issue. Final code rotates the oversized active file to a backup at `core/observability.mjs:116-135`, appends only after rotation at `core/observability.mjs:137`, and reads backups plus active logs at `core/observability.mjs:172-183`.

### F2 — Agent child failures are reported but not returned to the caller [was P1]
- **Phase A action:** Added `process.exit(typeof result.code === 'number' ? result.code : 0)`.
- **Phase B action:** Changed that to `process.exitCode = ...`, which propagated the code but allowed future command fallthrough risk.
- **Phase C action:** Restored a hard exit after flushing stdout (`pass2-phaseC-core.diff:5-23`).
- **Final state:** fixed
- **Residual concern (if any):** None for exit propagation. Final code computes `exitCode`, drains stdout, and calls `process.exit(exitCode)` at `core/companion.mjs:155-164`; test coverage asserts exit `42` propagates at `core/tests/agent-subcommand.test.mjs:177-192`.

### F3 — Invocation logs persist full user task text without redaction or private file mode [was P1]
- **Phase A action:** Replaced raw `task` logging with `describeTask(task)` fields.
- **Phase B action:** No private-mode change.
- **Phase C action:** No private-mode change.
- **Final state:** partially-fixed
- **Residual concern (if any):** Raw task text is no longer persisted: `describeTask()` returns only `task_hash` and `task_length` at `core/companion.mjs:15-19`, and `agent_invocation` spreads those fields at `core/companion.mjs:119-126`. The file-mode half remains open: `mkdirSync(dir, { recursive: true })` does not request `0700` at `core/observability.mjs:29-33`, and `appendFileSync(file, line, 'utf8')` does not request `0600` at `core/observability.mjs:137`.

### F4 — Retention deletes by mtime and any `.ndjson` name, not by log-date ownership [was P1]
- **Phase A action:** Stopped sweeping arbitrary `.ndjson` names and added support for rotated backups.
- **Phase B action:** Centralized owned-name parsing and added a test that preserves unrelated `.ndjson`-like files.
- **Phase C action:** No date-based retention fix.
- **Final state:** partially-fixed
- **Residual concern (if any):** The unrelated-file part is fixed by `LOG_NAME_RE` at `core/observability.mjs:8-9` and `listLogFiles()` at `core/observability.mjs:46-54`; tests preserve unrelated names at `core/tests/observability.test.mjs:96-113`. The date-ownership part remains: retention still deletes matching log files solely by `st.mtimeMs < cutoff` at `core/observability.mjs:148-156`, so a current-date log restored with an old mtime can still be removed.

### F5 — Size-cap rotation is racy across concurrent emitters [was P1]
- **Phase A action:** Removed truncation and renamed the oversized active file to a timestamp backup, but backup-name collisions were still possible.
- **Phase B action:** Added sequential backup names, but the phase still selected names without an exclusive reservation.
- **Phase C action:** Added `openSync(rotatedName, 'wx')` reservation and retries before rename (`pass2-phaseC-core.diff:70-103`).
- **Final state:** fixed
- **Residual concern (if any):** None for the original stale truncate/clobber issue. Final rotation reserves a fresh backup name at `core/observability.mjs:116-131`, renames active into that reserved name at `core/observability.mjs:132-135`, and appends afterward at `core/observability.mjs:137`. Test coverage pre-seeds `.1` and verifies the rotation chooses a distinct backup at `core/tests/observability.test.mjs:208-229`.

### F6 — Agent dispatch inherits full environment while bypassing child-agent permission prompts [was P1]
- **Phase A action:** No core fix; Phase A bundles copied the same unsafe dispatch into plugin scripts.
- **Phase B action:** No matching hardening.
- **Phase C action:** No matching hardening.
- **Final state:** unchanged
- **Residual concern (if any):** Claude and OpenCode still include `--dangerously-skip-permissions` in the core agent subcommand at `core/companion.mjs:94` and `core/companion.mjs:108`. `runAgent()` still calls `spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })` without a sanitized `env`, so the child inherits the full parent environment at `core/runners.mjs:61`.

### F7 — Observability tests write to the real home log and can pass against stale events [was P2]
- **Phase A action:** Added `CHOREO_LOG_DIR` support and changed tests/helpers to pass an isolated log directory.
- **Phase B action:** Added env restoration for `CHOREO_LOG_MAX_BYTES` and a module reset hook for cached ESM state.
- **Phase C action:** Added additional env parsing and backup-name tests using the isolated directory.
- **Final state:** fixed
- **Residual concern (if any):** None for real-home/stale-log pollution. Runtime log location is injectable at `core/observability.mjs:11-12`; observability tests create and clean `tmpLogDir` at `core/tests/observability.test.mjs:8-27`; agent-subcommand tests create `logDir` and pass it through every `runCompanion()` path, with isolated reads at `core/tests/agent-subcommand.test.mjs:8-27`.

### F8 — Flag stripping mutates task text that begins with `--` [was P2]
- **Phase A action:** No core fix; Phase A bundles copied the same stripping logic into plugin scripts.
- **Phase B action:** No matching fix.
- **Phase C action:** No matching fix.
- **Final state:** unchanged
- **Residual concern (if any):** The core task builder still drops every argument starting with `--`: `const task = rest.filter(a => !a.startsWith('--')).join(' ').trim();` at `core/companion.mjs:61-65`. No final test verifies preservation of task text containing literal `--` tokens.

## New Findings Introduced by Fixes

### NF1 — Phase A ships unsafe agent dispatch in bundled plugin scripts [P1]
- **Introduced in:** Phase A / `pass2-phaseA-bundles.diff:101-194`, `pass2-phaseA-bundles.diff:312-405`, `pass2-phaseA-bundles.diff:523-616`
- **Issue:** Phase A added the `agent` subcommand implementation to all bundled plugin companions, including `--dangerously-skip-permissions` for Claude/OpenCode and inherited environment spawning. That expands the unresolved F6 security exposure from core code into shipped plugin artifacts.
- **Evidence:** Final bundled scripts still pass dangerous permission bypass at `plugin-claude/scripts/companion.mjs:311` and `plugin-claude/scripts/companion.mjs:325`, and spawn with inherited env at `plugin-claude/scripts/companion.mjs:80-84`. The same copied code exists in `plugin-codex/scripts/companion.mjs:80-84`, `plugin-codex/scripts/companion.mjs:311`, `plugin-codex/scripts/companion.mjs:325`, `plugin-opencode/dist/companion.mjs:80-84`, `plugin-opencode/dist/companion.mjs:311`, and `plugin-opencode/dist/companion.mjs:325`.
- **Suggested fix:** Apply the F6 hardening to the source and regenerated bundles together: remove permission bypass by default and pass a minimal allowlisted env to `spawn()`, with an explicit unsafe opt-in if needed.

### NF2 — Phase A ships the flag-stripping task corruption in bundled plugin scripts [P2]
- **Introduced in:** Phase A / `pass2-phaseA-bundles.diff:106-110`, `pass2-phaseA-bundles.diff:317-321`, `pass2-phaseA-bundles.diff:528-532`
- **Issue:** Phase A copied the unresolved F8 parser into all bundled plugin companions, so shipped plugin users can still lose literal task tokens beginning with `--`.
- **Evidence:** Final bundled scripts compute task text with `rest.filter((a) => !a.startsWith("--")).join(" ").trim()` at `plugin-claude/scripts/companion.mjs:282-287`, `plugin-codex/scripts/companion.mjs:282-287`, and `plugin-opencode/dist/companion.mjs:282-287`.
- **Suggested fix:** Parse only recognized control flags and preserve remaining task argv exactly, or require an explicit `--` task delimiter; regenerate bundles from the corrected source.

## Net Assessment

- Pass-1 findings resolved: 4/8
- Pass-1 findings partial: 2
- Pass-1 findings unchanged: 2
- Pass-1 findings regressed: 0
- New P0/P1 findings introduced by fixes: 1
- **Verdict for Ship 1 gate:** HOLD — F6 remains an unresolved P1 in core and was newly shipped into bundled plugin artifacts, with F3/F4 still only partially fixed.
