---
member: claude
model: opus-4.7
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-05T00:30:00Z
exit_code: 0
---

## Round 2: Verifier Loop Design

### 1. REPORT SCHEMA
Extend adversarial schema; no separate top-level `atomic_claims[]` — derive from `verified_claims + failed_claims + couldnt_verify`.
```json
{
  "verifier_id": "string",
  "builder_run_id": "string",
  "round": "number",
  "status": "pass|fail|partial|error",
  "confidence": 0.0-1.0,
  "verified_claims": [{"claim", "method": "deterministic|llm", "evidence"}],
  "failed_claims": [{"claim", "method", "expected", "actual"}],
  "couldnt_verify": [{"claim", "reason"}],
  "feedback_given": "string|null",
  "improvement_needed": "boolean",
  "script_outputs": [{"script", "exit_code", "stdout"}]
}
```

### 2. IPC MECHANISM
Piggyback on Ship 2 broker. Named consumer `verifier:{id}`. Builder completion = NDJSON event on broker stream. Verifier subscribes, runs, posts report back. One IPC surface, simpler security/monitoring.

### 3. RE-PROMPT MECHANISM
File-based handoff, simplest and most auditable. Verifier writes `choreographer/.verifier/{id}/feedback-round-{n}.json`. Builder Stop hook checks for file before exit. If present AND round < cap, Stop hook returns BLOCK reason with feedback summary. Builder reads file directly for detail. No new slash command. Full audit trail.

### 4. MULTI-VERIFIER COMPOSITION
Sequential default. Each verifier runs in order; fail → re-prompt builder before advancing. Opt-in parallel via `parallel: true` when provably independent. Conflict resolution: disagreement flagged as `conflict` in `couldnt_verify[]` with both verdicts, user resolves. No automatic arbitration.

### 5. GOAL-DEFINITION ASSISTANT
Lives as skill at `.claude/skills/verifier-setup/SKILL.md`. Three phases:
- **Phase 1 — Scope interview**: what builder produces, what "done" means, what failure looks like. 3-5 questions max.
- **Phase 2 — Claim extraction**: converts answers into candidate atomic claims grouped by verifier type. Shows user for approval/edit.
- **Phase 3 — Output**: writes `choreographer/goals.json` + per-verifier system prompt to `.verifier/{id}/system-prompt.txt`.

Freeform mode still works. Skill invocable, not mandatory. Modeled after Claude's skill-builder.

### 6. BASH POLICY
Each verifier names exactly ONE allowed script path (`allowed_script: "scripts/verify-sql-schema.sh"`). Broker/harness intercepts bash tool calls; rejects non-matching `argv[0]`. Thin wrapper checks allowlist before exec. Verifier system prompt also states restriction explicitly. If verifier needs multiple scripts → separate named verifier. Enforces "one agent, one purpose" structurally.

### 7. ROUND CAP + CONVERGENCE
Default cap: 3 rounds. Configurable per verifier (`max_rounds: N`). Convergence: all `failed_claims[]` empty AND `improvement_needed: false`. On cap without convergence: escalate to user with summary of which claims never passed, delta between round 1 and round N, decision prompt (accept partial, extend cap, abort). No silent pass.

### 8. CONFIG SCHEMA
`choreographer/.verifier/config.json` per repo.
```json
{
  "verifiers": [{
    "id": "string",
    "model": "string",
    "system_prompt_file": ".verifier/{id}/system-prompt.txt",
    "allowed_script": "scripts/{name}.sh",
    "parallel": false,
    "max_rounds": 3,
    "goal_sources": ["goals.json", "plan", "inline"],
    "triggers": ["builder_stop"]
  }]
}
```
`triggers` allows future extension (PR trigger, manual trigger) without schema change.

## TOP 3 DESIGN CONCERNS

1. **Claim atomicity quality.** Entire loop reliability depends on verifier decomposing work into genuinely atomic, falsifiable claims. LLM-generated claims tend toward vague judgments ("code is clean") not testable predicates. Goal-definition assistant mitigates but can't fully prevent.

2. **Re-prompt injection scope.** Injecting verifier feedback into builder via Stop hook is powerful but creates a channel where misconfigured/adversarial verifier can manipulate builder behavior. Feedback string must be sanitized and length-capped.

3. **Sequential verifier latency.** Three sequential verifiers, each with builder fix loops, compound to 9+ round-trips. Users may abandon feature on slow tasks. Parallel-by-default reduces latency but introduces conflict problem. Right default needs empirical validation.
