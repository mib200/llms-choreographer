# Codex Adversarial Review — Pass 3: Final State vs main

**Branch:** feature/acp-migration (HEAD 1bf15de, code as of 36861d7)
**Base:** main
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05
**Code surface reviewed:** core/observability.mjs, core/companion.mjs, core/tests/*, plugin-*/{scripts,dist}/companion.mjs bundles

## Summary

Final-state review found 2 non-duplicate findings: 1 SHIP-1 blocker and 1 SHIP-2 deferral. The blocker is a composed Phase A/B/C rotation race: Phase C protects backup destination names with `O_EXCL`, but no process owns the active source path before `renameSync`, so concurrent cap rotations can still drop observability events. Plugin bundles are fresh against the current generated bundle output; the raw source-to-bundle diff is substantive only because the shipped files are bundled artifacts.

## Findings

### FF1 — Destination reservation does not reserve the active source file [P1] [SHIP-1]
- **File:** core/observability.mjs:116
- **Issue:** Phase C reserves only the backup destination name (`openSync(rotatedName, 'wx')`) before renaming the active log at `core/observability.mjs:123` and `core/observability.mjs:134`. It does not reserve or re-check ownership of `${today}.ndjson` after another process may already have renamed it.
- **Failure scenario:** Two companion processes emit while the active daily log is over `CHOREO_LOG_MAX_BYTES`. Both stat the active file as oversized at `core/observability.mjs:116`. Process A reserves `.1` and renames the active file to `.1`. Process B reserves `.2`, then `renameSync(file, rotatedName)` throws `ENOENT` because A already moved the source. In `core/companion.mjs:119-127` or `core/companion.mjs:146-153`, that observability exception is swallowed, so B's invocation/completion event is silently missing even though the agent dispatch continues.
- **Evidence:** The reservation loop protects only `rotatedName` at `core/observability.mjs:120-127`; the source rename is a separate unguarded operation at `core/observability.mjs:134`; the append only happens after that at `core/observability.mjs:137`. The new test at `core/tests/observability.test.mjs:208-229` covers a pre-existing destination name, not a concurrent process removing the active source after the size check.
- **Fix direction:** Rotate with source ownership semantics: rename the active file to a uniquely reserved temporary/backup name in one guarded step, tolerate `ENOENT` by re-statting/retrying append against the newly created active file, and clean up any zero-byte reservation if the source rename fails.

### FF2 — Completion events cannot be tied back to their invocation under parallel runs [P3] [SHIP-2]
- **File:** core/companion.mjs:146
- **Issue:** `agent_invocation` includes `task_hash` and `task_length` at `core/companion.mjs:119-126`, but `agent_completion` records only `name`, `exitCode`, and `hasError` at `core/companion.mjs:146-152`.
- **Failure scenario:** Two CI jobs run `companion.mjs agent --name=codex ...` concurrently with different tasks. The log contains two invocation hashes, followed by two completion events with the same `name`. If one completion has `exitCode: 1`, downstream audit tooling cannot determine which hashed task failed without relying on timestamp proximity.
- **Evidence:** The completion event omits the privacy-preserving `describeTask(task)` fields that the invocation event already uses, and `core/tests/agent-subcommand.test.mjs:123-136` only asserts that a completion event exists.
- **Fix direction:** Include the same `task_hash` on `agent_completion` or add a generated `invocation_id` to both invocation and completion events; keep raw task text out of logs.

## Bundle Parity Check

- plugin-claude/scripts/companion.mjs: MATCHES generated current bundle (generated-vs-tracked diff 0 lines, 703 lines total). Raw direct diff against core/companion.mjs is 970 lines and substantive because this file bundles core/companion.mjs plus parsers/runners/observability.
- plugin-codex/scripts/companion.mjs: MATCHES generated current bundle (generated-vs-tracked diff 0 lines, 703 lines total). Raw direct diff against core/companion.mjs is 970 lines and substantive for the same bundling reason.
- plugin-opencode/dist/companion.mjs: MATCHES generated current bundle (generated-vs-tracked diff 0 lines, 703 lines total). Raw direct diff against core/companion.mjs is 970 lines and substantive for the same bundling reason.
- Cross-plugin parity: plugin-claude vs plugin-codex diff 0 line slots; plugin-claude vs plugin-opencode diff 0 line slots.

## Cross-Commit Interaction Check

- Phase A replaced truncation with rotate-by-rename, Phase B added numbered backups/read stitching, and Phase C added `O_EXCL` destination reservation. Composed issue: destination reservation prevents backup-name clobber but does not prevent a second process from losing the active source file between `statSync(file)` and `renameSync(file, rotatedName)`. See FF1.
- Phase C's hard exit after stdout drain composes correctly with Phase A/B exit propagation; no additional fallthrough bug found.
- Phase A redaction plus Phase B/C observability fixes avoid raw task persistence, but completion events still lack a correlation key. See FF2.
- NF1/NF2 from Pass 2 remain prior-pass findings and are not duplicated here.

## Ship Gate Recommendation

- **SHIP-1 blockers:** 1 (FF1)
- **SHIP-2 deferrals:** 1 (FF2)
- **Verdict:** HOLD — the final composed rotation fix still loses audit events under concurrent cap rotation, so the Ship 1 gate should wait for source-file race handling.
