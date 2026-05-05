---
member: opencode4
model: opencode/gpt-5.4
phase: phase-2-rebuttal-round-2
timestamp: 2026-05-04T20:18:34Z
exit_code: 0
---

[council] phase=phase-2-rebuttal-round-2 member=opencode4 model=opencode/gpt-5.4
[0m
> build · gpt-5.4
[0m
[0m→ [0mSkill "brainstorming"
[0m→ [0mSkill "ce-brainstorm"
Assumption: verifier loop sits inside the new brokered runtime, not beside it.

1. REPORT SCHEMA  
Yes. Extend the adversarial review schema instead of inventing a second report family. Keep `findings[]` for reviewer-style issues, add `atomic_claims[]` as first-class verification units.

```json
{
  "schema_version": "verifier_report/v1",
  "verifier_id": "sql-schema",
  "run_id": "vrf_2026_05_05_001",
  "builder_run_id": "bld_2026_05_05_001",
  "round": 1,
  "max_rounds": 3,
  "verdict": "success|failed|feedback",
  "confidence": "high|medium|low",
  "summary": "short human summary",
  "resolved_goals": [],
  "atomic_claims": [],
  "findings": [],
  "feedback_for_builder": "targeted reprompt text",
  "improvement_needed": [],
  "artifacts": [],
  "timings": {},
  "metadata": {}
}
```

`atomic_claims[]` should carry `id`, `goal_id`, `claim`, `method` (`deterministic|llm|mixed`), `status`, `confidence`, `evidence`, and `repair_hint`. That gives one schema for reviewers and verifiers.

2. IPC MECHANISM  
Use the broker, not a direct Unix socket pair. Reason: broker already owns lifecycle, protocol normalization, model routing, and observability. Builder and verifier are roles on one control plane. Add a `builder.stopped` event and a `verifier.run` request to broker API. If you want local low-latency transport, the broker itself can still listen on a Unix domain socket, but the contract should be broker-mediated, not builder-to-verifier bespoke IPC.

3. RE-PROMPT MECHANISM  
Automatic by default. Flow: builder hits Stop hook -> broker marks run `pending_verification` -> broker runs verifiers -> aggregator decides. If pass, Stop completes. If fail and rounds remain, broker injects a synthetic follow-up turn into the same builder session with:
- structured verifier summary
- failed claim IDs
- exact repair instructions
- path to full JSON report

This is better than a slash command or loose file handoff because the loop stays closed. On cap reached, broker returns a hard stop reason like `verification_failed_round_cap` and shows the compact failure summary to the user. Keep a manual `/choreo:verify-resume` only for user-edited goals.

4. MULTI-VERIFIER COMPOSITION  
Run independent verifiers in parallel. Aggregate after all finish. Sequential only when one verifier depends on artifacts from another, via explicit `after:` dependency. Conflict rule: each goal has one primary verifier. Other verifiers may emit advisory findings but cannot overturn that claim. Aggregate verdict:
- any `failed` from a primary verifier => overall `failed`
- else any `feedback` => overall `feedback`
- else `success`

If two primaries contradict on the same claim, mark aggregator status `conflict`, stop auto-loop, escalate to user.

5. GOAL-DEFINITION ASSISTANT  
Make it a separate skill/package, not hardwired repo logic. Repo should only carry schemas and prompt templates. Phases:
1. Intake: choose source mix from prompt, plan section, existing `goals.json`, inline `--goal`.
2. Interview: one question at a time, extract concrete success criteria and exclusions.
3. Normalize: turn prose into atomic goals with IDs, owners, measurable checks.
4. Bind: assign each goal to verifier or script.
5. Generate: emit `goals.json` plus per-verifier resolved system prompts.
6. Confirm: show user the synthesized goals before run.

Outputs:
- `goals.json`
- `verifier-prompts.json`
- optional `goal-resolution.json` for traceability

Precedence should be: inline flag > explicit `goals.json` > user interview output > plan requirements > verifier defaults.

6. BASH POLICY  
Enforce at two layers. First, host command manifests expose only broker entrypoints, not raw shell tools. Second, each verifier definition declares either:
- `script: path/to/script`
- or `scripts: [path1, path2]`

Broker enforces exact path allowlist plus fixed arg templates. No arbitrary command strings. If verifier asks for shell outside allowlist, broker rejects. That gets you the video's "one script" policy without trusting prompt discipline alone.

7. ROUND CAP + CONVERGENCE  
Default cap: 3 automatic rounds. That is enough to repair concrete misses without hiding churn. Escalate early if convergence stalls. Convergence means one of:
- all blocking claims verified
- failed-claim set unchanged for 2 consecutive rounds
- builder produced no diff relevant to failed claims
- verifier confidence drops from `high/medium` to `low`
- only unverified claims remain and they require user judgment

At non-convergence or round 3 failure, stop automation and ask user. Show claim delta across rounds so the user can see whether progress is real.

8. CONFIG SCHEMA  
Use repo-local YAML at `.choreographer/verifiers.yaml`. YAML is better here than JSON because humans will tune prompts, policies, dependencies, and comments. Each verifier needs:
- `id`
- `description`
- `type` (`llm|script|hybrid`)
- `model` / `adapter`
- `prompt_template`
- `goal_select`
- `blocking`
- `round_cap`
- `timeout_sec`
- `after`
- `allowed_tools`
- `scripts`
- `inputs`
- `artifacts`
- `confidence_threshold`
- `evidence_required`
- `report_schema_version`

Keep run artifacts under `.choreographer/runs/<run-id>/` so reports, prompt snapshots, and evidence stay auditable.

## TOP 3 DESIGN CONCERNS
1. False authority: weak LLM claim decomposition can turn fuzzy judgment into fake certainty.  
2. Non-convergent loops: builder and verifier can ping-pong unless failed-claim diffs are strict.  
3. Policy escape: bash restrictions fail if enforcement lives only in prompts, not broker code.
---EXIT:0---
