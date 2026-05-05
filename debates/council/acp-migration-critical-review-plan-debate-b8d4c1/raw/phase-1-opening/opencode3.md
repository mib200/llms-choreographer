---
member: opencode3
model: opencode-go/qwen3.6-plus
phase: phase-1-opening
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

## VERIFICATION PROBES RUN

- `npm view @agentclientprotocol/sdk` → `0.21.0` (Apache-2.0, ACP TypeScript SDK, maintained by benbrandt/aguzubiaga/cirwin, 31 versions, published a week ago)
- `npm view @agentclientprotocol/claude-agent-acp` → `0.32.0` (Apache-2.0, ACP-compatible coding agent powered by the Claude Agent SDK (TypeScript), 19 versions, published yesterday). Dependencies: `@agentclientprotocol/sdk@0.21.0`, `@anthropic-ai/claude-agent-sdk@0.2.126`, `zod ^3.25.0 || ^4.0.0`. Ships `claude-agent-acp` binary.
- `npm view @anthropic-ai/claude-agent-sdk` → `0.2.128` (Anthropic maintainers, 175 versions, published 15 hours ago)

`@agentclientprotocol/claude-agent-acp` literally wraps `@anthropic-ai/claude-agent-sdk` inside an ACP stdio server.

## 1. RECOMMENDED APPROACH

**Angle 1 — Blockers:** Items 2 (Claude package) and 3 (Gemini re-lock) block Ship 2 and Ship 1 *correctness* respectively, but item 1 (research rewrite) does NOT block Ship 1 implementation start. Ship 1 uses existing subprocess paths (`runAgent` + `parseClaudeStreamJson`). The research doc is a Ship 1 *exit* criterion and a Ship 2 *start* criterion. Relabel: item 1 → "Ship 1 exit / Ship 2 blocker", items 2–3 → keep as "blocker" with scope clarified (item 3 blocks Ship 1 *scope*, not Ship 1 *start*).

**Angle 2 — Claude ACP package:** `@agentclientprotocol/claude-agent-acp` wins unequivocally. npm confirms it at 0.32.0, published yesterday by the ACP org, depends on both `@agentclientprotocol/sdk@0.21.0` AND `@anthropic-ai/claude-agent-sdk@0.2.126`. It IS the ACP stdio wrapper. `@anthropic-ai/claude-agent-sdk` (175 versions, maintained by Anthropic) is a programmatic SDK — does NOT speak ACP. Plan's primary-path commitment is correct. SDK becomes native fallback only.

**Angle 3 — Gemini re-lock:** Hard constraint. Plan's Gemini presence in Ship 1 (REGISTRY entry, `/choreo:gemini` command) AND Ship 2 (adapter table row) are bugs, not features. Remove all Gemini from Ship 1/2. Ship 1 targets claude/codex/opencode only. Ship 2 adapter table drops the Gemini row entirely. This is not a "leak-back fix" — it's a constraint violation that needs excision.

**Angle 4 — Schema enforcement:** ACP-first client-side validation. Uniformity wins. Council/verifier parsing logic stays one code path. Codex native fallback already gets server-side `outputSchema` enforcement; client-side validation on top is redundant but harmless. Auto-fallback to app-server for schema enforcement would require the broker to route validation differently per agent — complexity for marginal reliability gain. Parse failures already handled gracefully (flag, don't crash).

**Angle 5 — Broker channel split:** Split is load-bearing from day one. Plan's framing is correct but too abstract. Must name concrete producers/consumers explicitly:
- `broker.agents[name]` — ACP client connections; `session/update` events flow here. Producer: ACP stdio subprocesses.
- `broker.events` — internal EventEmitter. Producers: SessionStart/SessionEnd hooks, Verifier Loop, builder_stop detection. Consumers: NDJSON logger, lifecycle handlers, verifier dispatch.
- NDJSON observability subscribes to both.

**Angle 6 — Bundled atomic revision:** Bundled. All 10 items are doc-level changes with no code dependencies. Phasing creates intermediate states where plan contradicts research. Do it all at once.

## 2. TOP 3 REASONS WHY

1. **npm data proves the Claude package decision.** `@agentclientprotocol/claude-agent-acp@0.32.0` literally wraps `@anthropic-ai/claude-agent-sdk` inside an ACP stdio server. They are not alternatives — one contains the other. No ambiguity remains.

2. **Ship 1's subprocess path is transport-independent.** `runAgent()` in `core/runners.mjs` and `parseClaudeStreamJson` in `core/parsers.mjs` already work today. Ship 1 is a routing fix (~20 LoC), not a transport swap. The research doc can be written in parallel with Ship 1 implementation.

3. **Gemini leaks are scope creep, not bugs to fix.** The user re-locked Gemini to Ship 5+ for a reason: avoid scope-expand until claude/codex/opencode ACP paths are proven. Keeping Gemini in Ship 1/2 defeats the lock's purpose. The plan is not "fixing a leak" — it's violating a constraint.

## 3. KEY RISKS I ACCEPT

- **Research doc lag:** If Ship 1 ships before the research rewrite completes, Ship 2 start gets blocked. Mitigation: the research rewrite is a focused ~400-line doc replacement, not a research project. Should take one session.

- **ACP package churn:** `@agentclientprotocol/claude-agent-acp` is at 0.32.0 with 19 versions — still pre-1.0. Breaking changes are possible. Mitigation: pin version in `package.json`, probe `npm view` as pre-work, circuit-breaker on adapter init failure.

- **Client-side schema validation fragility:** Without Codex's native `outputSchema`, malformed JSON from any agent becomes a parse failure rather than a server rejection. Mitigation: `parseStructuredOutput` already flags and doesn't crash; Evolution B's best-effort citation handling covers the precision gap.

- **Broker split complexity:** Two pub/sub surfaces from day one means more wiring in `broker.mjs`. Mitigation: name them explicitly, document producers/consumers, write unit tests for each channel independently.

## 4. WHAT I WOULD EXPLICITLY NOT DO

- **NOT defer the Gemini excision.** Some might argue "leave Gemini in Ship 1, it's just a REGISTRY entry." Wrong. Every line of Gemini code in Ship 1/2 is scope that distracts from proving the three ACP-first paths. Remove it now.

- **NOT create a hybrid schema enforcement path.** "Use Codex native `outputSchema` when available, client-side otherwise" sounds pragmatic but creates two validation code paths, two failure modes, and two test surfaces. Pick one. Client-side for all agents.

- **NOT phase the 10 divergence items.** There is no value in an intermediate state where the plan says one thing and the research says another. All 10 are doc edits. Bundle them.

- **NOT treat the research rewrite as a research project.** It's a doc rewrite with a known structure. The ACP protocol is documented at agentclientprotocol.com. The per-agent facts are known. Write it, don't research it.
