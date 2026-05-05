# Council Synthesis — Choreographer ACP-First Migration Plan

Written by: Claude (moderator), from anonymized final positions of 6 debaters across 2 rebuttal rounds + Round-2 Verifier-Loop design.
User overrides applied at key divergence points (composition default, assistant location, autonomous mode).

---

## Merged Recommendation

Adopt the ACP-first plan with **substantial re-framing and one major feature addition**:

1. **Transport**: not "ACP-first," but "adapter-interface-first with protocol-agnostic broker." Codex speaks its native app-server JSON-RPC through its own adapter. Claude speaks ACP (via claude-code-acp) or subprocess stream-JSON fallback. OpenCode speaks HTTP/WS through `opencode serve`. Gemini uses subprocess. The broker multiplexes heterogeneous connections, not uniform wire format. **Kill `core/runtime/acp-client.mjs` as a standalone abstraction** — it has exactly one real user (Claude), so keep its code inside `core/agents/claude.mjs`.

2. **Ship ordering** (revised):
   - **Ship 1**: `/choreo:codex` single-agent-dispatch fix (20 LoC — fixes documented deferred bug at `docs/project-overview-pdr.md:108`) + `core/observability.mjs` NDJSON logging + Phase 0 ACP feasibility research with hard success metrics (task success rate, synthesis latency p95, evidence-to-claim ratio, cancel reliability, user selection rate) as gate criteria.
   - **Ship 2**: Dual-protocol broker + per-agent adapters (Codex native, Claude ACP-or-stream-JSON, OpenCode `serve`, Gemini subprocess) + broker lifecycle hooks.
   - **Ship 3**: Council port with evolutions A (structured JSON positions), B (evidence citations — structured field, best-effort for subprocess agents), E (minority preservation), G (structured JSON synthesis schema) + `council.json` per-phase checkpoint for crash recovery + multi-bundle regression verification in Phase 4/5 gates.
   - **Ship 4 (NEW)**: **Verifier Loop** — replaces the original plan's Stop-review gate.
   - **Ship 5**: Adversarial review + cleanup + doc refresh + `codex exec` retirement.

3. **Evolutions dropped/deferred**: Kill Evolution F (cross-session persistence) — file-locking complexity without proven need. Defer Evolution C (adaptive rounds) and Evolution D (adversarial round at N-1) to post-Ship-5 increments — both change control flow and should wait until base protocol is stable.

4. **opencode serve** stays as a mandate with fail-loud probe and no silent subprocess fallback — consistent-structured-output across the council requires it.

5. **Pi.dev** remains deferred.

---

## The Verifier Loop — Ship 4 (user-driven addition)

Inspired by Andy Devdann's Pi Verifier pattern. Replaces the simple Stop-review gate with a goal-reaching iteration loop.

### Concept
Builder (primary coding agent) writes code → on Stop hook, one or more Verifiers kick off → each Verifier decomposes work into atomic claims → checks claims via LLM judgment + deterministic scripts → emits structured report → if any claim fails, broker injects targeted feedback into builder's next turn → loop until convergence, round cap, or user-escalated critical fork.

### Report Schema (extends adversarial review)
```json
{
  "verifier_id": "sql-schema",
  "builder_run_id": "string",
  "round": 1,
  "status": "pass | fail | feedback | error",
  "confidence": 0.0-1.0,
  "verified_claims": [{"id", "claim", "method": "deterministic|llm", "evidence"}],
  "failed_claims":   [{"id", "claim", "method", "expected", "actual"}],
  "couldnt_verify":  [{"id", "claim", "reason"}],
  "feedback_given": "string|null",
  "improvement_needed": "string|null",
  "script_outputs": [{"script", "exit_code", "stdout"}]
}
```
`improvement_needed` is the flywheel — gets compacted into verifier system prompts over time.

### IPC
**Piggyback on Ship 2 broker.** Verifier registers as named consumer `verifier:{id}`. Builder completion event fires as NDJSON on broker stream. No separate Unix socket. Unified observability path.

### Re-prompt mechanism
File-based handoff + Stop-hook BLOCK. Verifier writes `.choreographer/verifier/{id}/feedback-round-{n}.json`. Builder Stop hook checks for pending feedback before exit. If present AND round < cap, Stop hook emits BLOCK reason containing compact feedback summary; builder reads file directly for full detail. No new slash command. Full audit trail.

### Composition (USER DECISION: parallel default)
**Parallel by default, opt-in sequential via `depends_on`.** Three independent verifiers (image-quality + sql-schema + accessibility) run concurrently at 30s each = 30s wall time, not 90s. Conflict resolution: same-claim disagreement flagged as `conflict` in `couldnt_verify[]`; user resolves or autonomous mode resolves by severity. Sequential chains declared explicitly when one verifier needs another's artifacts.

### Goal-definition assistant (USER DECISION: both module + skill)
**Core module** at `core/goal-assistant.mjs` does the work. **Skill front-end** at `.claude/skills/verifier-setup/SKILL.md` provides user-invocable surface. Three phases:
1. **Scope interview** — 3-5 questions: what's the deliverable, what's "done," what's failure.
2. **Claim extraction** — converts answers to candidate atomic claims, grouped by verifier type.
3. **Output** — writes `.choreographer/goals.json` + per-verifier system prompt to `.verifier/{id}/system-prompt.txt`.

Freeform mode (skip assistant, write `goals.json` directly, or inline `--goal=...`) always works. Assistant is optional help, not mandatory.

### Bash policy
Each verifier declares exactly ONE allowed script path in its YAML config. Broker wraps bash tool calls; rejects non-matching `argv[0]`. If verifier needs multiple scripts → separate named verifier (enforces "one agent, one purpose" structurally). Plus: `max_runtime_sec`, `network: false`, `filesystem: readonly:<scope>` declarations.

### Round cap + convergence
Default cap: 3 rounds, configurable per verifier. Convergence: all `failed_claims[]` empty AND `improvement_needed: null`. Non-convergence escalates to user with summary + delta + decision prompt. Oscillation detection: identical `failed_claims` set for 2 consecutive rounds → immediate escalation (no more rounds burned).

### Config schema
`.choreographer/verifiers.yaml` per repo (YAML for comments + readability).
```yaml
verifiers:
  - id: sql-schema
    description: "Validates schema against goals.json"
    model: codex/gpt-5.5           # optional, inherits adapter default
    system_prompt: .verifier/sql-schema/system-prompt.md
    allowed_script: scripts/verify-schema.sh
    sandbox:
      allowed_tools: [sqlite3]
      max_runtime_sec: 30
      network: false
      filesystem: "readonly:artifacts/"
    parallel: true
    depends_on: []
    max_rounds: 3
    goal_sources: [goals.json, plan, inline]
    triggers: [builder_stop]
    confidence_threshold: 0.85
```

### Autonomous mode (USER DECISION)
Per-invocation flag `--autonomous` plus per-repo default in `.choreographer/config.yaml`. In autonomous mode, LLM drives; user is pulled in ONLY at critical forks:
- **Plan deviation** — verifier wants to relax an acceptance criterion from the plan
- **Oscillation + exhausted alternates** — round cap hit, tried model swap + cap extension, still failing
- **Security sensitive** — bash outside allowlist, write outside declared filesystem scope
- **Ambiguous fork** — verifier declines to pick between multiple viable interpretations; also includes budget caps (>N tokens or >M min)

Claim approval in autonomous mode: skipped. LLM claims accepted if `confidence >= threshold` (default 0.85); below threshold, claim flags to user.

### Design-concern mitigations baked in
- **Oscillation detection**: identical `failed_claims` set across 2 rounds → immediate escalation.
- **Claim-decomposition quality gate**: goal-definition assistant shows proposed claims (in non-autonomous mode); confidence threshold (in autonomous mode).
- **Feedback sanitization**: verifier feedback strings pass through a sanitizer (strip imperative instructions masquerading as data, allowlist tokens, 2K-char cap) before builder sees them.
- **Flywheel prompt compaction**: periodic compaction of accumulated `improvement_needed` entries via a dedicated skill invocation (modelled after `/caveman:compress`). Prevents verifier prompt bloat over time.

---

## Gaps added to plan (unanimous adoption from debate)

1. **`core/observability.mjs`** — structured NDJSON event stream from Ship 1. Every adapter invocation, phase transition, broker request, verifier round. `~/.choreo/logs/<date>.ndjson`. 7-day rotation, 100MB cap.
2. **`council.json` phase checkpoint** — written per phase transition; crash-safe resume for multi-phase council.
3. **Hard success metrics as Phase 0 gate** — task success rate, synthesis latency p95, evidence-to-claim ratio, cancel reliability, user selection rate. Not just ACP feasibility.
4. **Multi-bundle regression gate** — `npm run check-bundles` + smoke test through each of plugin-claude/, plugin-codex/, plugin-opencode/ before marking Phase 4/5 complete.

---

## Remaining Disagreements (honest per Rule 5)

1. **Broker existence debate**. opencode1 and opencode3 Round-1 positions held "broker last, only extract if telemetry warrants." The final plan ships broker in Ship 2 (before council). Tradeoff: front-loads infra risk, but council + Verifier Loop both depend on unified IPC. Without broker, Ship 4's Verifier Loop cannot piggyback on a shared bus.

2. **Evolution B (citations)**. opencode1, opencode3, opencode4 wanted it dropped entirely because subprocess agents can't guarantee line-number precision. Others kept it best-effort. Final plan keeps it with explicit "best-effort for subprocess agents" semantics. If Ship 3 shows the precision gap creates false-positive failed_claims, demote to advisory.

3. **Whether the Verifier Loop is Ship 4 or earlier**. opencode5 strongly wanted it as Ship 1. Most others accepted Ship 4 because the loop benefits from the broker + council infrastructure. User-confirmed Ship 4.

---

## Confidence: **PARTIAL CONSENSUS — pending per-member validation**
