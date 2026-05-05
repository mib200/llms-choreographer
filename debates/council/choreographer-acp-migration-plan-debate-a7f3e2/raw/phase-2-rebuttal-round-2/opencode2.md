---
member: opencode2
model: opencode-go/qwen3.6-plus
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-04T20:18:34Z
exit_code: 0
---

[council] phase=phase-2-rebuttal-round-2 member=opencode2 model=opencode-go/qwen3.6-plus
[0m
> build · qwen3.6-plus
[0m
## 1. REPORT SCHEMA

```json
{
  "task_id": "string",
  "verifier_id": "string",
  "timestamp": "ISO8601",
  "status": "success|failed|feedback",
  "confidence": "high|medium|low|feedback",
  "atomic_claims": [
    {
      "id": "string",
      "description": "string",
      "status": "verified|failed|could_not_verify",
      "method": "deterministic|non_deterministic",
      "evidence": "string (script output or LLM rationale)",
      "confidence": "high|medium|low"
    }
  ],
  "failed_claims": ["claim_id"],
  "couldnt_verify": ["claim_id"],
  "feedback_given": "string",
  "improvement_needed": "string",
  "findings": [],
  "verdict": "pass|fail|needs_revision"
}
```

Extends adversarial schema: `atomic_claims[]` added alongside existing `findings[]`. `verdict` is derived from claim statuses (any failed → fail, all verified → pass, unverified present → feedback). `confidence` at top level is min of claim confidences.

## 2. IPC MECHANISM

**Piggyback on the broker.** Unix sockets add process lifecycle complexity the choreographer already solves via the broker's session management. The broker already handles: session routing, message queuing, protocol adapters. Adding a `verifier` message type (~50 lines) is cheaper than maintaining a parallel socket daemon.

Unix sockets only make sense if the verifier runs as a separate OS process with different credentials. In our model, the verifier is another agent session managed by the same orchestrator. The broker's event bus is the natural spine.

Exception: if the verifier needs to run deterministic scripts in a sandboxed process, that sandbox talks to the verifier agent via stdin/stdout, not via a separate IPC layer.

## 3. RE-PROMPT MECHANISM

**File-based handoff via the broker's message queue.** Verifier writes its report to `tasks/<id>/verifier/<n>/report.json`. The broker detects this, reads the report, and if `status != success`, posts a new message to the builder's session with:

```
{
  "type": "verifier_feedback",
  "round": N,
  "claims_failed": [...],
  "feedback": "specific text from verifier",
  "action_required": "fix_and_resubmit"
}
```

The builder's Stop hook recognizes `verifier_feedback` messages and treats them as a BLOCK reason — the builder resumes, addresses the feedback, and calls Stop again. No new slash command needed. The existing Stop→broker→agent loop handles it.

Round number is tracked in the task's `verifier_rounds` counter.

## 4. MULTI-VERIFIER COMPOSITION

**Sequential by default, parallel when independent.** Composition order defined in config. Verifier N runs only after Verifier N-1 reports `success`. If any verifier reports `failed`, the loop stops and re-prompts the builder — no point running remaining verifiers against known-broken output.

Parallel composition allowed when verifiers are declared independent (e.g., image-quality + accessibility don't share concerns). The broker fans out, collects all reports, merges:

- Any `failed` → overall `failed`
- All `success` → overall `success`
- Mixed `success` + `could_not_verify` → `feedback`

Conflicts (Verifier A says pass, Verifier B says fail on overlapping claim) → `failed` with conflict annotation. User resolves.

## 5. GOAL-DEFINITION ASSISTANT

**Lives as a skill in the choreographer repo** (`skills/goal-definition/SKILL.md`). Three phases:

**Phase 1 — Interview:** Multi-turn questions via the host's AskUserQuestion equivalent. Asks: what are you building? what does "done" look like? what constraints exist? what could go wrong? 4-8 questions max.

**Phase 2 — Decomposition:** Converts answers into atomic claims. Each claim maps to a verifier or a deterministic script. Output is `tasks/<id>/goals.json`:

```json
{
  "goals": [
    {
      "id": "G1",
      "description": "Generated images are <500KB",
      "verifier": "image-quality",
      "claims": ["C1", "C2"]
    }
  ]
}
```

**Phase 3 — Prompt Generation:** Produces per-verifier system prompts with the rules baked in. Writes to `tasks/<id>/verifiers/<name>/system-prompt.md`.

Users can skip the assistant and provide goals.json directly, or use `--goal="..."` flags.

## 6. BASH POLICY

**Per-verifier YAML config with an `allowed_scripts` allowlist.** Each verifier definition specifies exactly which scripts it may execute:

```yaml
verifier: image-quality
allowed_scripts:
  - scripts/verify-image-size.sh
  - scripts/check-image-format.sh
max_concurrent_scripts: 1
```

The broker's adapter layer intercepts script execution requests and validates against the allowlist before spawning. Rejects anything not listed. This is enforced at the broker level, not the agent level — the agent can't bypass it because the broker owns process spawning.

For the `plugin-claude/commands/.json` allowed-tools field: keep it coarse (allows `bash`), let the broker do fine-grained filtering.

## 7. ROUND CAP + CONVERGENCE

**Hard cap: 3 rounds.** After round 3, if any claim still fails:

1. Escalate to user with a summary: which claims failed, what the builder tried each round, what the verifier expected.
2. Offer three options: (a) user manually overrides, (b) user relaxes the claim, (c) user takes over the fix.

Convergence = all claims `verified` OR all remaining failures are in `couldnt_verify` with `confidence: low` (verifier admits it can't judge). The latter case produces a `feedback` status with `improvement_needed` — the flywheel field that feeds back into the verifier's system prompt for next time.

No infinite loops. No silent degradation.

## 8. CONFIG SCHEMA

**`choreo.yaml` at repo root.** YAML for readability, JSON Schema for validation. Verifier definition fields:

```yaml
verifiers:
  image-quality:
    description: "Validates generated images meet quality standards"
    system_prompt: "tasks/{task_id}/verifiers/image-quality/system-prompt.md"
    allowed_scripts:
      - "scripts/verify-image-size.sh"
    goals_source: "goals.json"
    composition:
      order: 1
      parallel_with: []
    round_limit: 3
    escalation: "user"
```

Fields: `description`, `system_prompt` (path template), `allowed_scripts`, `goals_source` (which goal file or inline), `composition.order`, `composition.parallel_with`, `round_limit` (overrides global), `escalation` (user|skip|fail-fast).

Global defaults at `choreo.yaml` top level: `verifier_round_limit: 3`, `verifier_escalation: user`.

## TOP 3 DESIGN CONCERNS

1. **Verifier claim decomposition quality** — if the verifier can't break the builder's output into truly atomic, independently-checkable claims, the whole pattern collapses into a vague "looks good" LLM judgment. The goal-definition assistant is the linchpin here; if it produces mushy claims, the loop is useless.

2. **Re-prompt feedback specificity** — the builder needs actionable feedback, not "this failed." If the verifier's `feedback_given` field is vague, the builder will spin on the same mistake for all 3 rounds. The verifier must produce claim-level failure reasons with concrete fix instructions.

3. **Broker complexity creep** — piggybacking on the broker is the right call, but the broker is already ~400 lines. Adding verifier routing, script allowlisting, multi-verifier composition, round tracking, and escalation logic could double it. Risk of the broker becoming the thing that needs a verifier.
---EXIT:0---
