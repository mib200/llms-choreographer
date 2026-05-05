---
member: opencode3
model: opencode-go/deepseek-v4-pro
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-04T20:18:34Z
exit_code: 0
---

[council] phase=phase-2-rebuttal-round-2 member=opencode3 model=opencode-go/deepseek-v4-pro
[0m
> build · deepseek-v4-pro
[0m
## 1. REPORT SCHEMA

Extend the adversarial review schema with `atomic_claims` at the top level:

```json
{
  "verdict": "pass|fail|feedback",
  "confidence": "high|medium|low",
  "verified_at": "ISO8601",
  "round": 1,
  "atomic_claims": [
    {
      "id": "c1",
      "claim": "SQLite database CreatedCards table exists with correct schema",
      "method": "deterministic",
      "tool": "sql-schema-verifier",
      "passed": true,
      "evidence": "PRAGMA table_info(CreatedCards) returned correct columns..."
    },
    {
      "id": "c2",
      "claim": "Generated image dimensions exactly 1200x630",
      "method": "non-deterministic",
      "tool": "image-quality-verifier",
      "passed": false,
      "reason": "Image is 1200x628 — off by 2px height",
      "confidence": "high"
    }
  ],
  "couldnt_verify": [
    {
      "claim": "Font 'Inter' renders with correct kerning",
      "reason": "No kerning measurement script available",
      "wish": "Need a text-extraction tool that preserves glyph positions"
    }
  ],
  "feedback_given": "Resize height to 630px. Use sharp bicubic filter.",
  "improvement_needed": "Add a kerning-measurement script to image-quality verifier",
  "findings": [],
  "summary": "..."
}
```

Key difference from adversarial review: `atomic_claims[]` is the heart — each is a falsifiable unit. `couldnt_verify[]` is the flywheel field. `feedback_given` only present when `re_prompt=true`.

## 2. IPC MECHANISM

**Piggyback on the broker.** Unix sockets add deployment complexity, port conflicts, and a second IPC layer to debug. The broker already exists (~400 lines planned) and handles message routing. The verifier is just another protocol participant: it subscribes to `builder.stop` events and emits `verifier.report`. Same JSON-line transport, same auth context. One less moving part. The video's socket model was chosen because GPT-5.5 couldn't share a process — our choreographer broker owns the process space.

## 3. RE-PROMPT MECHANISM

The verifier's report with `feedback_given` triggers a `Stop` hook reason `BLOCKED_BY_VERIFIER`. The choreographer controller (the broker's orchestrator) reads the report, resets the builder's conversation with injected context: the failed claims, the feedback text, and the original task. This is **not** a new slash command — it's a protocol-level loop managed by the controller. The builder sees a system message: `Verifier round 1/3: height off by 2px. [...]` and continues where it left off. File-based handoff is the fallback for manual resolution.

## 4. MULTI-VERIFIER COMPOSITION

**Parallel by default, sequential when chained.** Each verifier is independent — they run simultaneously on the builder's Stop event. The controller collects all reports, merges `atomic_claims[]` arrays, and computes the aggregate verdict:

- All pass → `pass`. Builder continue.
- Any fail → `feedback`. Builder gets merged feedback, re-runs.
- Any `couldnt_verify` → appended to aggregate. Does not block.

Conflict resolution: if two verifiers disagree on the same claim (e.g., schema-verifier says table exists, accessibility-verifier says it's missing), that claim automatically moves to `couldnt_verify` with reason `"inter-verifier conflict"` and escalates to user. No verifier overrides another — they're peers. A verifier can declare a dependency (`depends_on: "sql-schema-verifier"`) to force sequential ordering, but the default is parallel.

## 5. GOAL-DEFINITION ASSISTANT

**Phases:**
1. **Scope** — asks "What are you building? What's the deliverable?" (multi-turn)
2. **Constraints** — extracts hard rules (size limits, schema must-haves, no missing translations, etc.)
3. **Verifier mapping** — presents candidate verifiers from registry. User selects.
4. **Output** — writes `goals.json` to `docs/goals/<task-id>.json` plus per-verifier system prompt snippets.

**Outputs:** `goals.json` with the schema from question 1's `atomic_claims` template plus metadata. Per-verifier system prompts as markdown fragments.

**Location:** Lives in the choreographer repo as `core/goal-assistant.mjs`. Not a separate skill — it's a bootstrapping tool invoked by `/choreo:define` or auto-triggered when no `goals.json` exists and the user opted into assisted mode. Its prompts are skill-like (interview pattern) but it's part of the toolchain, not user-installable.

## 6. BASH POLICY

Enforced at the **verifier definition level** in config. Each verifier declares:

```yaml
sandbox:
  allowed_tools: ["sqlite3", "identify", "convert"]
  scripts: ["verify_schema.sh"]
  max_runtime_sec: 30
  network: false
  filesystem: "readonly:/tmp/artifacts"
```

The choreographer broker wraps bash execution — no raw shell access. Equivalent to the video's "one script" policy: the verifier can call its declared tools plus exactly one verification script. The script receives the artifact path as `$CHOREO_ARTIFACT`. No `curl`, no `rm`, no `sudo`. The broker kills processes that exceed `max_runtime_sec`. Tool allowlists are validated at verifier registration time.

## 7. ROUND CAP + CONVERGENCE

**Cap: 3 rounds default, configurable per verifier** (`max_rounds: 3`). After round 3 with remaining failures:
- Failures escalate to user with a structured summary (what failed, what passed, what wasn't verified).
- User can manually resolve (override verdict, modify goals, abort).
- Counter resets if user modifies goals.

**Convergence definition:** All `atomic_claims` with `method: deterministic` pass, and all `non-deterministic` claims pass with `confidence: high`. Mixed-confidence passes (e.g., `confidence: low` on a non-deterministic claim) do NOT converge — they block. This prevents the loop from cycling on fuzzy LLM judgments.

## 8. CONFIG SCHEMA

Per-repo config at `.choreographer/verifiers.yaml`:

```yaml
verifiers:
  sql-schema:
    description: "Validates SQLite schema against goals.json"
    model: "gpt-5.5"  # optional, defaults to primary agent
    protocol: "codex"  # codex | claude | gemini
    max_rounds: 3
    sandbox:
      allowed_tools: ["sqlite3"]
      max_runtime_sec: 15
    triggers:
      file_patterns: ["*.sql", "*.db"]
      goals_keywords: ["schema", "table", "column", "migration"]
  image-quality:
    description: "Verifies generated images match spec dimensions/quality"
    protocol: "codex"
    sandbox:
      allowed_tools: ["identify", "convert", "pngcheck"]
      scripts: ["verify_image.sh"]
      max_runtime_sec: 30
    triggers:
      file_patterns: ["*.png", "*.jpg", "*.webp"]
```

YAML over JSON — readable, comment-friendly, and the rest of the choreographer config ecosystem uses YAML. A verifier definition needs: `description`, `protocol`, `sandbox` (tools + runtime), `triggers` (when to activate), and optional `model`.

---

## TOP 3 DESIGN CONCERNS

1. **Non-deterministic claim convergence is unreliable.** LLM judgment with `confidence: high` is still stochastic. A verifier could pass on round 1 and fail on round 4 with identical artifacts. Mitigation: deterministic claims gate the loop; non-deterministic claims escalate after N passes.

2. **Parallel verifiers scaling the builder timeout.** If 5 verifiers each take 30s, the builder sits idle for 2.5 minutes. This kills momentum. Mitigation: verifiers run async; the builder's Stop hook is non-blocking. The controller queues the report and re-prompts later.

3. **Verifier prompt drift.** The `couldnt_verify` → flywheel feedback loop means verifier system prompts grow over time. If not pruned, they become bloated and contradictory. Mitigation: periodic prompt compaction (modeled after `/caveman:compress`) invoked by the user or after N additions.
---EXIT:0---
