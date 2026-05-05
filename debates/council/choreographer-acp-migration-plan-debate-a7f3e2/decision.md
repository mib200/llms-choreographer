# Council Decision: Choreographer ACP-First Migration Plan

## Members
- **claude**: anthropic/claude-opus-4-7, role=moderator + anonymous debater sub-agent
- **gemini**: gemini-3-flash-preview — **SKIPPED** (MODEL_CAPACITY_EXHAUSTED, 429 on 6+ retry attempts, no fallback configured)
- **opencode1**: opencode-go/kimi-k2.6
- **opencode2**: opencode-go/qwen3.6-plus
- **opencode3**: opencode-go/deepseek-v4-pro
- **opencode4**: opencode/gpt-5.4
- **opencode5**: opencode/gemini-3-flash

Active debaters: 6 (5 at some points due to Gemini skip).

## Confidence Level
**PARTIAL CONSENSUS**

Validation tally:
- FULL CONSENSUS: opencode2, opencode5
- PARTIAL CONSENSUS: opencode1, opencode3, opencode4
- DEADLOCK: none

No member invoked a DEADLOCK veto. The partial-consensus votes reflect preserved disagreements (broker timing, Evolution B precision, Verifier Loop ship position) — not unresolved blockers.

---

## Consensus Position

Adopt a **revised choreographer migration plan** that re-frames the original ACP-first proposal as **adapter-interface-first with a protocol-agnostic broker**, ports the global council protocol with a lean evolutionary subset, and adds a new **Verifier Loop** capability (Ship 4) inspired by the Pi Verifier pattern. The plan emphasizes high-velocity user-visible value in Ship 1 (closing the `/choreo:codex` routing bug) and bakes observability + success metrics into gate criteria from day one.

## Key Agreements

1. **Adapter-interface-first transport, not ACP-first.** Codex speaks its native app-server JSON-RPC through its own adapter. Claude speaks ACP (via claude-code-acp) or subprocess stream-JSON fallback. OpenCode speaks HTTP/WS through `opencode serve`. Gemini uses subprocess. The broker multiplexes heterogeneous connections, not uniform wire format.

2. **Kill `core/runtime/acp-client.mjs` as a standalone abstraction.** Its only real user is Claude; keep that code inside `core/agents/claude.mjs` until a second agent natively speaks ACP.

3. **`/choreo:codex` single-agent-dispatch fix is Ship 1.** ~20 LoC. Uses existing subprocess path. Closes the deferred bug at `docs/project-overview-pdr.md:108`.

4. **`core/observability.mjs` NDJSON structured logging ships in Ship 1.** Every adapter invocation, phase transition, broker request, verifier round emits structured events to `~/.choreo/logs/<date>.ndjson`. Rotation 7 days, 100 MB cap.

5. **Hard success metrics gate Phase 0.** Task success rate, synthesis latency p95, evidence-to-claim ratio, cancel reliability, user selection rate. Not just ACP feasibility.

6. **Council port with evolutions A, B (best-effort for subprocess), E, G ships in Ship 3.** Plus `council.json` per-phase checkpoint for crash recovery. Plus multi-bundle regression verification gate.

7. **Drop Evolution F entirely (cross-session persistence).** Defer Evolution C (adaptive rounds) and Evolution D (adversarial round at N-1) to post-Ship-5 increments — both change control flow and need stable base protocol first.

8. **`opencode serve` mandate with fail-loud probe.** No silent subprocess fallback. Consistent structured output across the council requires it.

9. **Pi.dev is out of scope for this plan.** Separate plan, separate PR.

10. **Verifier Loop (new Ship 4) replaces the original Stop-review gate.** Per the Pi Verifier pattern: multi-reviewer atomic-claim decomposition + feedback re-injection. Piggybacks on Ship 2 broker. Parallel verifier composition by default (opt-in sequential via `depends_on`). Bash policy: one allowed script per verifier. Round cap 3 with oscillation detection. Goal-definition assistant lives as both core module (`core/goal-assistant.mjs`) and skill front-end (`.claude/skills/verifier-setup/SKILL.md`).

11. **Autonomous mode for the Verifier Loop.** Per-invocation `--autonomous` flag + per-repo default in `.choreographer/config.yaml`. LLM drives; user pulled in ONLY at critical forks: plan deviation, oscillation + exhausted alternates, security-sensitive (bash/fs violations), ambiguous fork, budget cap (>N tokens or >M minutes). Claim approval skipped when `confidence >= threshold` (default 0.85).

12. **Design-concern mitigations baked in from Ship 4:** oscillation detection (identical `failed_claims` 2 rounds → escalate), claim-decomposition quality gate via goal assistant or confidence threshold, feedback sanitization + 2K char cap on re-prompt injection, flywheel prompt compaction skill (modeled after `/caveman:compress`).

13. **Broker resilience semantics are mandatory for Ship 2** (opencode1's validation-phase flag): dead-letter queue for failed verifier/agent messages, idempotency keys on all requests, circuit-breaker on repeated adapter failures. Not optional.

## Resolved Debates

| Debate | Resolution | Convincing argument |
|---|---|---|
| ACP-first framing | Rejected — replaced with adapter-first broker | Zero of four agents speak native ACP today; calling it "ACP-first" was aspirational marketing rather than engineering reality (opencode1, opencode3, opencode4) |
| Codex ACP shim | Dropped — Codex adapter speaks native app-server directly | Translation shim is the plan's "riskiest piece" and solves no user problem; users want structured output and thread resume, not a specific wire format (opencode2) |
| Stop-review gate | Replaced with Verifier Loop | Video-demonstrated Verifier pattern is materially more capable than single-reviewer BLOCK/ALLOW (user input + opencode5) |
| Goal-definition assistant location | Both core module + skill front-end | Enables programmatic use + invocable UX (user override of 3-of-6 for in-repo vs 2-of-6 for separate skill) |
| Verifier composition default | Parallel by default, sequential via `depends_on` | Latency matters more than artifact conflicts in the common case (user override of 3-3 council split) |
| `/choreo:codex` routing | Ship 1 | 20-line fix for a documented deferred bug; no dependency on adapters or broker (5 of 6) |
| Pi.dev | Deferred | No ACP analog, no structured output contract, drags design down to lowest common denominator (6 of 6) |

## Remaining Disagreements

1. **Broker existence timing.** Two debaters (opencode1 in Round 1; opencode3 both rounds) held that the broker should extract later, only after telemetry proves multi-agent contention is a real problem. The final plan places it in Ship 2 so the council (Ship 3) and Verifier Loop (Ship 4) can piggyback on it. Tradeoff: front-loads infrastructure risk to enable downstream features. Decision rationale: without the broker, the Verifier Loop cannot use a unified IPC surface; adding a separate Unix socket for verifier would duplicate the broker's planned connection-lifecycle code.

2. **Evolution B precision for subprocess agents.** Three debaters (opencode1, opencode3, opencode4) wanted Evolution B dropped outright because subprocess agents cannot guarantee line-number precision for citations. Three debaters kept it best-effort. Final plan: keep as best-effort with an explicit "demote to advisory if Ship 3 shows high false-positive rate" clause. If the precision gap creates false-positive failed_claims in practice, the plan revisits B.

3. **Verifier Loop ship timing.** opencode5 strongly argued for Ship 1 ("killer app"). Others accepted Ship 4. Tradeoff: Ship 4 means users wait for broker + council before getting the loop. But the loop's value amplifies with structured output (needs Ship 3's council schema) and IPC (needs Ship 2's broker). Ship 1 would be a standalone gate without the atomic-claim structure. User-confirmed Ship 4.

4. **Council port scope.** opencode1 and opencode3 held "verbatim v1.9.12 zero evolutions in Ship 3." Others included subsets of evolutions. Final plan: A, B (best-effort), E, G in Ship 3. Tradeoff: more surface area than a verbatim port, less than full Option 1+. opencode3's flag is preserved: if Ship 3 reveals that evolutions A/B/E/G create instability, retreat to verbatim and ship evolutions post-facto.

5. **opencode serve mandate strictness.** opencode4 wanted the mandate scoped to OpenCode-backed features only (not as a whole-system requirement). Final plan: whole-system mandate with fail-loud probe. Tradeoff: stricter setup onboarding vs guaranteed consistent structured output. The user confirmed the stricter policy earlier in the session.

## Debate Summary

- **Members**: 6 (5 active — Gemini skipped due to rate-limit)
- **Rounds**: 2 rebuttal rounds (planned 3; strong convergence after round 2)
- **Pre-flight questions collected**: 14 across 5 debaters (before dedup)
- **Pre-flight unique questions answered**: 4 (user answered all 4 via AskUserQuestion); 7 cached as "best judgment"
- **Members who needed no clarifications**: none (all 5 non-Claude asked questions)
- **Concessions by member**: opencode1 (3), opencode2 (4), opencode3 (3), opencode4 (4), opencode5 (3), claude (5 concessions including the central ACP-first framing)
- **User clarifications requested**: 4 during Phase 0.5 + 5 during synthesis refinement (critical-fork semantics, composition default, assistant location, evolution scope, autonomous mode semantics)
- **Key insight that emerged from debate**: The "Stop-review gate" in the external plugin and the full Verifier Loop the user saw demonstrated are different features, not a version of the same thing. The plugin's gate is single-reviewer BLOCK/ALLOW; the Verifier Loop is multi-reviewer atomic-claim decomposition with feedback re-injection. Conflating them in the original plan would have undershipped the user's intent. Naming them as distinct capabilities, and dropping the simple gate entirely in favor of the loop, is the most important re-framing this debate produced.
