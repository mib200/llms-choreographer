---
member: opencode3
model: amazon-bedrock/global.anthropic.claude-opus-4-7
phase: phase-1-opening
timestamp: 2026-05-06T12:15:00Z
exit_code: 0
---

## Position: MERGE NOW. Fix ONLY COR-002 in this PR. Defer the rest.

### 1. RECOMMENDED APPROACH

Land this branch with one trivial change: clear the timeout timer when promptPromise wins the race in acp-client.mjs:245-252. That's a 4-line edit. Everything else either (a) already works, (b) is mitigated by the threat model, or (c) is theoretical purity that doesn't justify blocking the migration.

### 2. TOP 3 REASONS WHY

(a) The threat model destroys most of these findings. Single-tenant developer machines. Per-user /tmp/choreo-${uid} directory at 0700. TOCTOU window requires another local process racing — that attacker already has full read access to the user's home, SSH keys, and shell history. Hardening a socket against your own UID is theatre.

(b) COR-002 is the only finding that produces real user-visible breakage. A leaked setTimeout with no unref() will keep the Node event loop alive after a successful prompt — process won't exit cleanly, CLI hangs, tests timeout.

(c) All 5 P3s are noise. Dead test imports, temp dirs in cwd, SIGPIPE before SIGTERM — code-quality nits dressed up with severity labels.

### 3. KEY RISKS I ACCEPT

- SEC-001 TOCTOU exists. Accept because exploitation requires same-UID local code execution, at which point the game is already over.
- COR-003 teardown race is real. Accept because production call sites serialize. Document in JSDoc as "not concurrent-safe."
- SEC-005/COR-004 stream-destroy-before-SIGTERM can produce SIGPIPE-tagged exit on the child. Logs may be noisier. Functionally fine.
- COR-001: parseStructured divergence is harmless because JSON.parse tolerates surrounding whitespace.

### 4. WHAT I WOULD EXPLICITLY NOT DO

- Will NOT add umask-based socket hardening. Single-tenant. Per-user 0700 directory is the actual security boundary.
- Will NOT add a teardown mutex. The race requires concurrent callers, which don't exist.
- Will NOT block on Windows ACL. Explicitly deferred.
- Will NOT rewrite the env passthrough escape hatch. Opt-in passthrough IS the design.
- Will NOT defer the merge to address P3s. The cost of a bad merge is one git revert command.

Bottom line: 1 valid P1 (COR-002), 1 acceptable-risk P1 (SEC-001), 4 acceptable-risk P2s, 5 noise P3s. Fix COR-002, merge, file follow-up issue for the rest.
