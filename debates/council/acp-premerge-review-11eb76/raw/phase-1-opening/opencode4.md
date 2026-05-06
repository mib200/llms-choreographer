---
member: opencode4
model: opencode/gpt-5.5
phase: phase-1-opening
timestamp: 2026-05-06T12:15:00Z
exit_code: 0
---

## Position: Do not merge as-is. Apply three surgical fixes, rerun tests, then merge.

### Fix before merge:
1. Clear/unref prompt timeout in finally.
2. Set connection = null before async teardown work.
3. Use output.trim() consistently for fallback and structured parsing.

### Finding Assessment

Valid blockers:
- COR-002: real. Late timer can hold process open and cancel later work.
- COR-003: real. prompt() can enter during teardown.
- COR-006: real. Whitespace chunks can suppress response.output.

Valid but non-blocking:
- COR-001: mostly duplicate of consistency issue. JSON.parse accepts whitespace.
- SEC-005 / COR-004: real shutdown semantics concern, not merge-blocking.
- COR-008: weak test quality issue, not product risk.
- SEC-006: test temp-dir hygiene only.

Acceptable/theoretical:
- SEC-001: mitigated by 0700 runtime dir in normal path.
- SEC-002: Windows explicitly deferred.
- SEC-003: explicit unsafe opt-in on developer machines.
- SEC-004: harmless parser expansion for env-var names.

### Top 3 Reasons
1. acp-client.mjs:246-252 creates a timeout with no clear path. If prompt succeeds, timer still fires later and calls cancel().
2. acp-client.mjs:309-317 leaves this.connection live during teardown. Concurrent calls pass the guard.
3. ACP-only migration has CRITICAL blast radius. AcpClient affects Claude, Codex, OpenCode, council, and lifecycle flows.

### Risks I Accept
- Unix socket chmod TOCTOU remains acceptable for single-tenant machines.
- Windows named-pipe ACL hardening stays deferred.
- Passthrough env flag remains dangerous but explicit.

### What I Would Not Do
- Would not restore native fallbacks. ACP-only is architecturally correct.
- Would not block on Windows. User deferred it.
- Would not redesign endpoint security now. Parent directory permissions are enough.

### Verification run:
- npm test: 172 pass, 0 fail.
- npm run check-bundles: all bundles fresh.
