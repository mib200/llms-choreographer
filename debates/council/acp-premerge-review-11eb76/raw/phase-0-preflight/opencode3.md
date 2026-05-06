---
member: opencode3
model: amazon-bedrock/global.anthropic.claude-opus-4-7
phase: preflight
timestamp: 2026-05-06T12:00:00Z
exit_code: 0
---

1. What is the deployment/runtime environment for the choreographer host — single-tenant developer machines only, or shared/multi-tenant systems where the chmod 0o600 socket permission and TOCTOU window have meaningfully different threat profiles?

2. Is there a backward-compatibility or rollback requirement for users currently relying on native/CLI agent paths, or is the ACP-only cutover a hard break with no transition period?

3. For the P1 timeout timer leak in acp-client.mjs:246 and the socket TOCTOU in endpoint.mjs:83 — are fixes already drafted/staged in this same branch, or are they expected to land as follow-up commits before merge?
