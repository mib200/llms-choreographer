---
member: opencode2
model: opencode/gpt-5.5
phase: phase-1-opening
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
note: "Opencode2 invoked ce-doc-review skill + spawned ce-adversarial-document-reviewer + ce-feasibility-reviewer sub-agents before producing position. Final position embedded below."
---

**YOUR RECOMMENDED APPROACH**

Approve the critical-review plan, but tighten blocker language.

1. **Blockers**
   Research rewrite, Claude package disambiguation, and Gemini re-lock block **Ship 2 coding**, not Ship 1. Ship 1 single-agent-fix and observability should proceed on existing subprocess paths.

2. **Claude package**
   `@agentclientprotocol/claude-agent-acp` wins as the primary Claude ACP path. `@anthropic-ai/claude-agent-sdk` is fallback only. It is not the ACP stdio commitment.

3. **Gemini**
   Ship 5+ re-lock is correct and mandatory. Any Gemini in Ship 1/2 tables, probes, commands, or registry text is a constraint violation, not harmless optionality.

4. **Schema enforcement**
   Use ACP-first client-side validation everywhere. Do not auto-fallback to Codex app-server `outputSchema`. Uniform transport behavior matters more than Codex-only reliability gains.

5. **Broker split**
   Keep `broker.agents[name]` and `broker.events`. The split is necessary now. But the plan must explicitly name producers and consumers: ACP session updates on agent channels, lifecycle/NDJSON/internal events on `broker.events`.

6. **Atomic revision**
   Apply all 10 divergence fixes atomically to the plan/research docs before Ship 2 starts. Implementation remains phased by ship. Documentation disambiguation must not be phased.

**TOP 3 REASONS WHY**

1. Current docs contain directly contradictory implementation instructions: wrong Claude primary path, Gemini leaking into Ship 1/2, and stale adapter-first research. That creates build-risk before code exists.

2. ACP-first is now the user mandate. Codex-native schema fallback and Anthropic SDK primary path both quietly reintroduce adapter-first thinking.

3. Gemini is the clearest scope-control failure. Keeping it out of Ship 1/2 protects the metric-gated path for Claude/Codex/OpenCode.

**KEY RISKS YOU ACCEPT**

1. Client-side schema validation is weaker than Codex native `outputSchema`.

2. `@agentclientprotocol/claude-agent-acp` still needs `npm view` version pinning before Ship 2.

3. Broker split adds structure early, but avoids mixing protocol traffic with lifecycle observability.

**WHAT I WOULD EXPLICITLY NOT DO**

1. Do not start Ship 2 coding before the blocker edits land.

2. Do not include Gemini anywhere in Ship 1/2 scope.

3. Do not make Codex app-server schema enforcement an automatic fallback.

4. Do not keep `@anthropic-ai/claude-agent-sdk` framed as Claude ACP stdio primary.

5. Do not split the 10 doc fixes across phases. That preserves ambiguity.
