---
member: opencode4
model: opencode/gpt-5.4
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

## RECOMMENDED APPROACH

Do not go ACP-first. Ship a thin Codex value path first inside the existing monorepo process model, then extract a broker only after two agents are working end-to-end with real usage. Concretely: fix `/choreo:codex` to do true single-agent dispatch, add the opt-in Stop-review gate, keep the current council minimal, and design the broker boundary as an internal interface rather than a daemon contract. Treat the Codex ACP shim as a later extraction target, not the foundation.

## TOP 3 REASONS

1. **The plan is over-optimizing for theoretical parity before proving product value.** The stated goal prioritizes cross-agent parity over shipping Codex value fast. That is backwards for this codebase state. You currently have a 39-line flat `Promise.all` council with hardcoded roles. Jumping from that to a broker daemon, four adapters, a risky ACP shim, six debate phases, seven evolutions, JSON schemas, adversarial templates, lifecycle management, and cross-session indexing is not an incremental move. It is a platform rewrite disguised as staged delivery.

2. **The Codex ACP shim is the dominant technical risk and should not sit on the critical path.** Any translation shim between Codex app-server semantics and ACP semantics will leak. Failure modes are ugly: partial capability mismatch, lifecycle drift, cancellation bugs, streaming inconsistencies, tool-call impedance mismatch, broken session ownership assumptions. If parity is the goal, a lossy shim is the worst place to start because it forces the whole architecture to conform to the least certain integration.

3. **The council port is too much protocol too early.** Porting the 490-line global council wholesale is a mistake. Most of those mechanisms only pay off once you have scale, contention, and evidence-quality problems. Right now you need delivery, not governance. Keep council simple until single-agent dispatch and Stop-review prove repeated value.

## KEY RISKS YOU ACCEPT

- You will delay true cross-agent parity and accept temporary uneven capabilities across Claude, Codex, OpenCode, and Gemini.
- You may create a local adapter interface that later needs reshaping when a broker is extracted.
- You risk rework if ACP does turn out to be the right long-term contract.
- You will ship a less elegant architecture in the short term, but with better odds of learning quickly.

## WHAT YOU EXPLICITLY WOULD NOT DO

- I would **not** make the ACP-first broker daemon the first architectural move. It front-loads infrastructure risk before user value.
- I would **not** port the full global council protocol in Ship 3. Start with a smaller council delta: structured positions plus evidence citations only.
- I would **not** put the Codex ACP shim on the critical path for initial Codex support. Direct integration first.
- I would **not** mandate `opencode serve` fail-loud from day one unless OpenCode is required for the specific invoked path. Hard fail for optional capability is bad product behavior.
- I would **not** build cross-session `debates/_index.json` now. That is archival machinery before you know what deserves preserving.

## POSITIONS ON DECISIONS

- **ACP-first broker:** No. Make ACP a possible extraction target, not the launch architecture.
- **Codex ACP shim:** No on critical path. Highest-risk component. Delay until direct Codex integration proves semantics worth standardizing.
- **opencode serve mandate:** Mostly no. Fail loud only when the user explicitly invokes an OpenCode-backed feature. Otherwise degrade by feature availability, not whole-system failure.
- **Pi.dev deferral:** Yes.
- **Option 1+ council scope:** No. Take a strict subset first: JSON positions, evidence citations, maybe minority preservation later.
- **Ship ordering:** Reorder. Ship 1 = `/choreo:codex` fix + single-agent dispatch. Ship 2 = Stop-review gate. Ship 3 = minimal adapter interface. Ship 4 = broker extraction if warranted. Ship 5 = richer council only if usage justifies it.
- **Stop-review gate:** Yes, opt-in. Strong near-term value, bounded complexity, useful feedback loop for Codex without forcing a whole broker architecture.
- **Fundamental gap:** The plan lacks a ruthless success metric. "Parity" is not a product outcome. Define a concrete measure: task success rate, latency, review usefulness, user selection rate across agents. Without that, this becomes architecture theater.
