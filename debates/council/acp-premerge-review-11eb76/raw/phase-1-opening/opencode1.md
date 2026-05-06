---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-1-opening
timestamp: 2026-05-06T12:15:00Z
exit_code: 0
---

## Position: Merge after fixing ONE bug only (COR-002)

### 1. RECOMMENDED APPROACH

Merge this branch after fixing one bug only: the setTimeout in core/agents/acp-client.mjs:246 must be cleared when promptPromise wins the race. Do not block merge on any of the other 11 findings.

Fix is trivial — store the timer handle and clearTimeout(timer) immediately after await Promise.race(...). Without it, the timer fires after the prompt completes, leaking the event loop and producing an unhandled promise rejection from the orphaned timeoutPromise. In Node >= 15 that can crash the process.

### 2. TOP 3 REASONS WHY

- COR-002 is the only real runtime defect. When promptPromise resolves first, the setTimeout is never cancelled. The callback then rejects a promise nobody is awaiting → unhandled rejection. This is not theoretical; it is a concrete leak/crash risk on every timed prompt.
- SEC-001 (socket TOCTOU) is mitigated in practice. resolveEndpointPath creates a parent runtimeDir with 0o700 and chmodSync(path, 0o600) runs in the listen callback microseconds later. On single-tenant developer machines, the directory permissions already prevent other users from reaching the socket.
- All other findings are by-design, deferred-platform, or stylistic noise.

### 3. KEY RISKS I ACCEPT

- Teardown race (COR-003). this.connection stays non-null through await closeSession(). A concurrent prompt() could slip past the guard. In actual usage prompt() and teardown() are sequential inside a try/finally, so the race is unlikely.
- Stream destruction before SIGTERM (SEC-005 / COR-004). Destroying stdio before SIGTERM prevents graceful flush. For local agent subprocesses that live for seconds, this is acceptable.
- No Windows ACL hardening (SEC-002). Windows support is deferred per user lock.

### 4. WHAT I WOULD EXPLICITLY NOT DO

- Do not block merge on the full 12-findings list.
- Do not refactor teardown() into a locked state machine.
- Do not remove CHOREO_AGENT_ENV_PASSTHROUGH.

### Missed finding

The automated review caught COR-002 but missed that the orphaned timeoutPromise rejection is unhandled, which elevates the bug from "event-loop hold-open" to "potential process crash." That makes the fix mandatory.
