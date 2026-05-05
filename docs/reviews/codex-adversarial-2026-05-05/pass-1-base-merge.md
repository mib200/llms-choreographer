# Codex Adversarial Review — Pass 1: Base Merge 5371e012

**Target:** merge 5371e012 (Ship 1 foundation onto feature/acp-migration)
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05
**Scope:** core/observability.mjs, core/companion.mjs (agent subcommand), core/tests/observability.test.mjs, core/tests/agent-subcommand.test.mjs

## Summary

The Ship 1 foundation is not safe as an audit/observability layer yet. The logger can destroy the active day log when the size cap is reached, retention deletes by file mtime instead of the log date, and all logging goes to the real `~/.choreo/logs` path with no isolation or privacy boundary. The new `agent` subcommand records child failure but does not propagate it as the process exit status in this merge, so automation can treat failed agent runs as successful. The tests cover the happy path but miss the destructive and adversarial cases: failing child agents, concurrent writers, privacy redaction, isolated log roots, and retention keep/delete boundaries.

## Findings

### F1 — Active-day rotation truncates the audit log [P0]
- **File:** core/observability.mjs:37-46
- **Issue:** When today's log reaches `MAX_BYTES_PER_DAY`, `emit()` truncates the active file with `writeFileSync(file, '', 'utf8')` and then appends only the new event.
- **Attack/failure scenario:** A busy agent session generates enough events to cross 100 MB. The next event deletes every earlier invocation/completion event for that calendar day. Incident reconstruction sees only events written after the cap was crossed, which is silent audit data loss in the normal emit path.
- **Evidence:** `if (st.size >= MAX_BYTES_PER_DAY) { writeFileSync(file, '', 'utf8'); }` at core/observability.mjs:40-42, followed by append at core/observability.mjs:46.
- **Suggested fix:** Rename the full file to a unique rotated segment or reject/drop only the new event with an explicit error metric; never truncate the active audit file.

### F2 — Agent child failures are reported but not returned to the caller [P1]
- **File:** core/companion.mjs:109-132
- **Issue:** The `agent` branch awaits `runAgent()` and logs `result.code`, but it never calls `process.exit(result.code)` or sets `process.exitCode`.
- **Attack/failure scenario:** CI runs `companion.mjs agent --name=codex "review this"` and the child `codex` process exits 7 after failing. This merge prints `[error — exit 7]` but the parent process falls through and exits 0, so CI marks the failed review as successful.
- **Evidence:** `const result = await runAgent(...)` at core/companion.mjs:109; `result.code` is only printed at core/companion.mjs:117-121; the branch ends at core/companion.mjs:132 without exit propagation.
- **Suggested fix:** After emitting completion, set `process.exitCode = result.code || 0` and return from `main()`, or explicitly `process.exit(result.code || 0)` after stdout flush.

### F3 — Invocation logs persist full user task text without redaction or private file mode [P1]
- **File:** core/companion.mjs:49-53, core/companion.mjs:107, core/observability.mjs:5, core/observability.mjs:9-12, core/observability.mjs:46
- **Issue:** The agent command joins all non-flag arguments into `task` and writes it verbatim into the `agent_invocation` NDJSON event under `~/.choreo/logs`.
- **Attack/failure scenario:** A user runs `companion.mjs agent --name=claude "debug prod issue, token=sk_live_..., customer email=..."`. The secret and PII are persisted as plaintext in a long-lived home-directory log. Directory creation uses default permissions, and the file write does not request `0600`, so exposure depends on process umask and host account policy.
- **Evidence:** `const task = ...join(' ')` at core/companion.mjs:53; `emit({ ..., task })` at core/companion.mjs:107; log root is fixed to `join(homedir(), '.choreo', 'logs')` at core/observability.mjs:5; append is raw `JSON.stringify(entry)` at core/observability.mjs:46.
- **Suggested fix:** Log only a task hash, length, and explicit safe metadata by default; add redaction for known secret patterns and create log dirs/files with private permissions.

### F4 — Retention deletes by mtime and any `.ndjson` name, not by log-date ownership [P1]
- **File:** core/observability.mjs:57-64
- **Issue:** `rotate()` sweeps every file ending in `.ndjson` and deletes it when filesystem `mtimeMs` is older than the cutoff.
- **Attack/failure scenario:** A current `2026-05-05.ndjson` log is restored from backup or copied with old mtimes; the next `rotate()` deletes it despite the filename being within retention. An unrelated `notes.ndjson` or imported audit file under the same directory also gets deleted if its mtime is old.
- **Evidence:** `readdirSync(LOG_DIR).filter(f => f.endsWith('.ndjson'))` at core/observability.mjs:58 and `if (st.mtimeMs < cutoff) unlinkSync(fullPath)` at core/observability.mjs:62-64.
- **Suggested fix:** Only manage filenames matching the owned log pattern, parse the date from the filename, and leave unparseable or current-date files untouched.

### F5 — Size-cap rotation is racy across concurrent emitters [P1]
- **File:** core/observability.mjs:38-46
- **Issue:** The cap check and truncation are separate `existsSync` / `statSync` / `writeFileSync` / `appendFileSync` operations with no lock or atomic rename.
- **Attack/failure scenario:** Two agent processes emit while the daily file is above 100 MB. Both stat the old size. Process A truncates and appends event A. Process B then truncates the file again and appends event B. Event A is lost even though both `emit()` calls returned successfully.
- **Evidence:** TOCTOU sequence at core/observability.mjs:38-42, then append at core/observability.mjs:46.
- **Suggested fix:** Use a lock file or atomic rotate-by-rename with unique segment names before append; never truncate based on a stale pre-append stat.

### F6 — Agent dispatch inherits full environment while bypassing child-agent permission prompts [P1]
- **File:** core/companion.mjs:82, core/companion.mjs:96, core/runners.mjs:61
- **Issue:** Claude and OpenCode are invoked with `--dangerously-skip-permissions`, and `runAgent()` spawns without an `env` allowlist, so the child inherits the full parent environment.
- **Attack/failure scenario:** A developer has `AWS_SESSION_TOKEN`, GitHub tokens, or database credentials in the shell environment. A delegated child agent launched by this subcommand can read those values and the workspace without the normal permission prompt boundary, turning a slash-command convenience path into a broad secret-exposure path.
- **Evidence:** Claude args include `--dangerously-skip-permissions` at core/companion.mjs:82; OpenCode args include it at core/companion.mjs:96; `spawn(binary, args, { stdio: ... })` at core/runners.mjs:61 passes default inherited env.
- **Suggested fix:** Remove dangerous permission bypass by default and pass a minimal sanitized environment unless the user explicitly opts into unsafe mode.

### F7 — Observability tests write to the real home log and can pass against stale events [P2]
- **File:** core/tests/observability.test.mjs:8, core/tests/agent-subcommand.test.mjs:87-96, core/tests/agent-subcommand.test.mjs:102-112, core/tests/helpers/fake-agents.mjs:63-65
- **Issue:** The tests import the production log root derived from `homedir()` and do not isolate `emit()` / `readEvents()` to a temp directory. The helper supports `CHOREO_LOG_DIR`, but the logger in this merge ignores that variable.
- **Attack/failure scenario:** A developer already has an `agent_invocation` event for `codex` in today's real `~/.choreo/logs` file. The test at core/tests/agent-subcommand.test.mjs:94 uses `events.find(...)`, so it can pass against the stale event even if the current command failed to emit. The test suite also pollutes the user's real audit log with `test_event` and `timestamp_test`.
- **Evidence:** Test log root is `join(homedir(), '.choreo', 'logs')` at core/tests/observability.test.mjs:8; event tests use `events.find(...)` at core/tests/agent-subcommand.test.mjs:94 and core/tests/agent-subcommand.test.mjs:109; helper sets `CHOREO_LOG_DIR` at core/tests/helpers/fake-agents.mjs:65 but core/observability.mjs:5 hardcodes the path.
- **Suggested fix:** Make the log directory injectable, use temp dirs in every test, clear fixtures before each assertion, and assert on a unique run id.

### F8 — Flag stripping mutates task text that begins with `--` [P2]
- **File:** core/companion.mjs:49-53
- **Issue:** The task is built by dropping every argument that starts with `--`, not just recognized control flags.
- **Attack/failure scenario:** A user asks `companion.mjs agent --name=codex "explain --force and --no-verify"` from a shell that passes those as separate tokens. The child agent receives `explain and`, producing an answer for a corrupted task while the invocation log records the same corrupted text.
- **Evidence:** `const task = rest.filter(a => !a.startsWith('--')).join(' ').trim();` at core/companion.mjs:53.
- **Suggested fix:** Parse only known flags and preserve the remaining argv exactly, or require `--` as an explicit task delimiter.

## Test coverage gaps

- core/tests/observability.test.mjs:33-49 — Add keep/delete boundary tests: recent file stays, current-date file with old mtime stays, malformed/unowned `.ndjson` stays, old owned date deletes.
- core/tests/observability.test.mjs:10-18 — Add a size-cap test that proves old events are preserved in a rotated segment instead of truncated.
- core/tests/observability.test.mjs:10-18 — Add a multi-process emit test around the cap boundary to prove both writers' events persist.
- core/tests/agent-subcommand.test.mjs:6-16 — Add a fake agent whose `--version` succeeds but task execution exits nonzero, then assert the parent command exits with the same nonzero status.
- core/tests/agent-subcommand.test.mjs:87-112 — Assert invocation/completion events using a unique run id or latest event, not the first matching event in today's real log.
- core/tests/agent-subcommand.test.mjs:87-96 — Assert sensitive task content is redacted or absent from `agent_invocation`.
- core/tests/helpers/fake-agents.mjs:63-65 — Wire `CHOREO_LOG_DIR` through the logger and require every observability test to pass an isolated temp log directory.
- core/tests/agent-subcommand.test.mjs:132-150 — Add task-parser tests for prompts containing `--force`, `--json`, and other flag-shaped user text.

## Notes for Pass 2

- Check whether later commits replace truncation with atomic rotate-by-rename and add tests that prove no active-day events are lost.
- Check whether `agent` now returns the child exit code in both text and `--json` modes.
- Check whether event payloads stop storing raw task text, or at least redact secrets and use private file permissions.
- Check whether retention parses owned log dates instead of sweeping all old `.ndjson` files by mtime.
- Check whether tests use an injectable temp log root and unique event ids, so they cannot pass against `~/.choreo/logs` residue.
- Clean note: no scoped code installs a SIGUSR1 handler in this merge, so SIGUSR1 handler semantics are not applicable for Pass 1.
- Clean note: `agent_completion` records `exitCode` and `hasError` only; it does not persist child stdout/stderr in the event payload.
