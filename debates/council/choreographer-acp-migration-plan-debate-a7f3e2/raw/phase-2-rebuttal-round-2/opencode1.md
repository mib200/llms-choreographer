---
member: opencode1
model: opencode-go/kimi-k2.6
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-04T20:18:34Z
exit_code: 0
---

[council] phase=phase-2-rebuttal-round-2 member=opencode1 model=opencode-go/kimi-k2.6
[0m
> build · kimi-k2.6
[0m
1. **REPORT SCHEMA** — Extend the adversarial review schema with an `atomic_claims` array and verifier-specific metadata:

```json
{
  "verdict": "success|failed|feedback",
  "confidence": "high|medium|low|feedback",
  "verifier_id": "sql-schema",
  "round": 2,
  "atomic_claims": [
    {"id": "c1", "claim": "users table has email index", "method": "deterministic", "status": "verified", "evidence": "schema.json#L47"},
    {"id": "c2", "claim": "no N+1 queries in listing", "method": "llm", "status": "failed", "evidence": "Detected loop at routes/list.mjs:L12"}
  ],
  "verified_claims": ["c1"],
  "failed_claims": ["c2"],
  "couldnt_verify": [{"claim": "latency < 100ms under load", "reason": "no load harness", "needed": "k6 script path"}],
  "feedback_given": "Remove the for-loop at list.mjs:L12; use JOIN.",
  "improvement_needed": "Add p95 latency benchmark script."
}
```

2. **IPC MECHANISM** — Piggyback on the broker. The broker already normalizes Codex/Claude adapters and routes topics (~400 lines). Adding a dedicated `verifier.*` channel avoids a second IPC surface. Unix sockets add platform debt (Windows, socket cleanup) for marginal gain in a local dev tool. If isolation becomes critical, implement a Unix-socket adapter as just another broker endpoint later.

3. **RE-PROMPT MECHANISM** — File-based handoff at `.choreo/rounds/{n}/verifier-feedback.json`. The verifier writes this file on completion. The builder's next iteration checks for pending feedback at startup and prepends `feedback_given` plus `failed_claims` into its context as a system reminder. This survives session restarts, is fully auditable in git, and avoids blocking the broker. The Stop hook triggers the verifier asynchronously; no BLOCK reason needed.

4. **MULTI-VERIFIER COMPOSITION** — Parallel by default; sequential opt-in via `depends_on`. All verifiers receive the same artifact snapshot. A reducer aggregates results: strictest `verdict` wins (`failed` > `feedback` > `success`), and `failed_claims` concatenate. Conflicts on the same claim resolve by deterministic method overriding LLM method. If a verifier is `blocking: true` and fails, the reducer short-circuits to re-prompt immediately.

5. **GOAL-DEFINITION ASSISTANT** — Lives in the choreographer repo as `core/goal-assistant.mjs`. Phases: (1) **Discovery** — multi-turn interview asking intent, constraints, and "done" criteria; (2) **Decomposition** — breaks intent into atomic goals; (3) **Assignment** — maps each goal to a verifier ID and verification method; (4) **Output** — writes `.choreo/goals/goals.json` and per-verifier `.choreo/goals/{verifier}.prompt.md`. Invoked via `choreo init --goals` or auto-triggered before first verifier run if no goals exist.

6. **BASH POLICY** — Enforce via per-verifier YAML config. Each `.choreo/verifiers/*.yaml` contains `allowed_scripts: [scripts/verify-sql.mjs]`. The broker's verifier executor checks this whitelist before spawning any subprocess and hard-fails if the verifier attempts anything else. This is auditable, version-controlled, and simpler than spreading policy across plugin-claude command JSON.

7. **ROUND CAP + CONVERGENCE** — Default cap: 3 rounds. Escalate to user if round 4 is reached, if `failed_claims` are identical between rounds N and N-1 (oscillation), or if `confidence` is `feedback` for two consecutive rounds. Convergence requires `failed_claims: []`, `couldnt_verify: []`, and `improvement_needed: null`.

8. **CONFIG SCHEMA** — `.choreo/verifiers.yaml`:

```yaml
verifiers:
  - id: image-quality
    name: Image Quality
    model: claude-sonnet-4
    system_prompt: .choreo/goals/image-quality.prompt.md
    goal_source: goals.json
    allowed_scripts: [scripts/verify-images.mjs]
    round_cap: 3
    blocking: false
    depends_on: []
default_round_cap: 3
escalation_policy: ask_user
```

## TOP 3 DESIGN CONCERNS
1. **Oscillation loops:** Builder "fixes" one claim but regresses another, or reinterprets feedback each round. Claim IDs must be stable across rounds, and oscillation detection must short-circuit early.
2. **Prompt injection via feedback:** `feedback_given` is injected into builder context. A creative verifier could hijack the builder with instructions disguised as feedback. Sanitize feedback through an allowlist and consider a lightweight sanity filter.
3. **Broker as single point of failure:** If the broker drops or misroutes a verifier result, the builder hangs indefinitely. Idempotency keys and a dead-letter queue for verifier messages are essential before this ships.
---EXIT:0---
