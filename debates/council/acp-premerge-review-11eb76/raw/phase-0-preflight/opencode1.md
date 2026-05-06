---
member: opencode1
model: opencode-go/kimi-k2.6
phase: preflight
timestamp: 2026-05-06T12:00:00Z
exit_code: 0
---

1. Are the 2 P1 and 5 P2 fixes already committed on `codex/acp-premerge-fixes`, or does the branch currently contain the unpatched findings?
2. With native/CLI fallbacks fully removed, is there a feature flag or quick-revert strategy for production if the in-process ACP broker encounters an unanticipated failure mode?
3. Do the 8 new tests include integration coverage for the regenerated plugin companion bundles, or are they limited to the core ACP client and adapter modules?
