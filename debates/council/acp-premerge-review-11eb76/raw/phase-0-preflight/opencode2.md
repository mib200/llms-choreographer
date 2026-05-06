---
member: opencode2
model: opencode-go/qwen3.6-plus
phase: preflight
timestamp: 2026-05-06T12:00:00Z
exit_code: 0
---

1. What are the exact code diffs for the two P1 findings (timeout timer leak at acp-client.mjs:246 and socket TOCTOU at endpoint.mjs:83) — specifically, is the timer leak a missing `clearTimeout` on early exit, and is the TOCTOU a race between socket creation and `chmod 0o600`?

2. Do the 8 new tests cover the P1/P2 findings, or are they purely regression tests for the new ACP-only adapter behavior?

3. What does the CHOREO_AGENT_ENV_ALLOW allowlist currently contain — is it a small fixed set of keys (e.g., `PATH`, `HOME`, `TMPDIR`) or does it include sensitive keys like `AWS_*`, `OPENAI_API_KEY`, etc.?
