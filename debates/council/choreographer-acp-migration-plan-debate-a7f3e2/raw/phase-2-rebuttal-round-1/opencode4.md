---
member: opencode4
model: opencode/gpt-5.4
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:20:00Z
exit_code: 0
---

I concede to opencode3 on council.json checkpoint gap.

I concede to opencode1 on observability. Structured NDJSON from Ship 1 not garnish.

I concede to claude-anon on multi-bundle verification gap. Orchestration works in isolation, fails across bundled agents and retries.

I concede to opencode2 that C and D are different class of risk — should not ride with base council mechanics.

Against claude-anon: full Option 1+ still overreach. Claim that A requires G too strong. Interdependence mostly convenience, not hard dependency.

Against opencode2: council before broker wrong sequencing. Atop unstable per-agent paths, you harden wrong seams and bake transport quirks into debate logic. Extraction target first ≠ giant broker first. Minimal interface first, then council on top.

Against opencode5: Stop-review gate not Ship 1 killer app. Dependent feature. Only shines after single-agent Codex path trustworthy and cancellation/streaming semantics understood.

Against opencode1: "zero evolutions Ship 2" too strict. E matters because synthesis should explicitly preserve dissent instead of collapsing disagreement. F/B can wait.

Against opencode3: killing acp-client.mjs now premature in opposite direction. I reject ACP-first framing, not ACP-shaped boundary. Thin adapter interface should survive even if first bridges are direct.

Changed my mind: original Ship 2 was Stop-review gate. Move observability ahead. Stop-review stays early but after metrics and after minimal adapter boundary.

Sharper claim against ACP-first: dominant risk is not implementation time. It's silent semantic loss. Codex shim will lie by omission — partial lifecycle parity, mismatched cancel, tool-call drift, streaming shape differences. Happy-path demos pass while long-running or interrupted sessions rot.

## UPDATED POSITION

- **Decision 1 (plan):** Still reject as written.
- **Decision 2 (architecture):** Hold protocol-agnostic thin adapter first. Accept ACP as possible later transport, not primary premise.
- **Decision 3 (Ship 1):** /choreo:codex fix + direct Codex dispatch + observability same ship.
- **Decision 4 (council scope):** Minimal council subset later, not full Option 1+, only after thin adapter boundary exists.
- **Decision 5 (evolutions):** Concede E early. Defer B, C, D, F, G. Reject full seven.
- **Decision 6 (Stop-review):** Softened. Keep experimental default-off; move behind observability and stable single-agent path. Not Ship 1.
- **Decision 7 (reliability):** Concede council.json checkpointing. Mandatory before serious council ship.
- **Decision 8 (metrics):** Hold hard. Measure task success rate, latency, review usefulness, cancel reliability, actual user selection before expanding.
