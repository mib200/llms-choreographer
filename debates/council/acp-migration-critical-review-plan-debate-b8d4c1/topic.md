---
topic: Choreographer ACP migration — critical-review plan debate
slug: acp-migration-critical-review-plan-debate-b8d4c1
date: 2026-05-05
members: [claude, opencode1, opencode2, opencode3]
models:
  claude: session-default (moderator, anonymous debater sub-agent=Opus 4.7 via Agent tool)
  opencode1: opencode-go/kimi-k2.6
  opencode2: opencode/gpt-5.5
  opencode3: opencode-go/qwen3.6-plus
rounds: 3
claude_role: moderator
skip_preflight: false
---

# Topic

Critically debate the ACP migration critical-review plan at `/Users/mk/.claude/plans/there-is-a-prelimary-serene-wirth.md`. Plan absorbs 10 divergence items found reviewing `/Users/mk/Repositories/mib200/AI/choreographer/docs/plans/2026-05-05-acp-migration-plan.md` against `/Users/mk/Repositories/mib200/AI/choreographer/docs/research/acp-feasibility.md`.

## Debate scope

ALL 10 divergence items, the 4-step action plan, and the 3 open questions.

## Challenge angles

1. **Blockers truly block?** Research doc rewrite, Claude ACP package disambiguation, Gemini re-lock are labeled blockers. Do they truly block Ship 1/2, or can one/more defer?
2. **Claude ACP package choice.** `@agentclientprotocol/claude-agent-acp` (official ACP adapter, wraps Claude CLI) vs `@anthropic-ai/claude-agent-sdk` (official Anthropic SDK, programmatic but non-ACP). Which wins on stability, schema support, session resume, maintenance risk?
3. **Gemini re-lock.** Prior council placed Gemini in Ship 1-2; user locked to Ship 5+; current plan leaks it back. Does Gemini's native ACP support make Ship 2 inclusion cheap and worthwhile, or is re-lock correct?
4. **Schema enforcement strategy.** ACP-first client-side validation (uniformity, best-effort across all agents) vs auto-fallback to Codex `app-server` `outputSchema` for native schema enforcement on council positions + verifier reports. Does uniformity outweigh reliability gains?
5. **Broker channel split.** `broker.agents[name]` (ACP connections) vs `broker.events` (internal EventEmitter for builder_stop / verifier_dispatch / lifecycle). Real separation of concerns or premature structure before Ship 4 verifier loop proves internal-channel need exists?
6. **Bundled atomic revision vs phased.** Absorbing all 10 items in a single plan revision risks scope creep vs phased disambiguation is cleaner?

## Binding context — do NOT re-litigate

- Ship order (1→5) per `debates/council/choreographer-acp-migration-plan-debate-a7f3e2/decision.md`
- Council evolution set: A + B (best-effort) + E + G. Drop F. Defer C, D.
- Verifier Loop placed at Ship 4.

## Deliverables

Per council skill Phase 4 protocol: `debates/council/acp-migration-critical-review-plan-debate-b8d4c1/decision.md` + `synthesis.md` + full `raw/` tree.
