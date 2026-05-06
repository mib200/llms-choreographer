# Council Topic: ACP Premerge Fixes Code Review

## Question

Review the staged changes on branch `codex/acp-premerge-fixes` for correctness, security, and architectural soundness. The changes finalize the ACP-first migration (24 files, +889/-773 lines):

1. All agent adapters (claude, codex, opencode) go ACP-only — native/CLI fallbacks removed
2. ACP client upgraded: SDK PROTOCOL_VERSION constant, `prompt` field (not `messages`), streaming outputChunks, graceful SIGTERM→SIGKILL teardown
3. Socket chmod 0o600 after listen (SEC-003 fix)
4. CHOREO_AGENT_ENV_ALLOW additive exact-key allowlist (NFF1 fix)
5. Lifecycle simplified to in-process broker (no detached subprocess)
6. 8 new tests added (172 total)
7. Plugin companion bundles regenerated (identical across 3 plugins)

## Prior Review Findings (for debate)

Three automated reviews identified:
- 2 P1 findings (timeout timer leak, socket TOCTOU)
- 5 P2 findings (trim inconsistency, teardown race, env passthrough propagation, colon delimiter, Windows pipe ACL)
- 5 P3 findings (stream destroy ordering, dead import, test temp dir location)

Council should assess: which findings are valid and actionable vs. theoretical/acceptable risk? Are there findings the prior review missed? Is the overall change safe to merge with the identified fixes applied?

## Decision Type

Implementation + Security tradeoff assessment
