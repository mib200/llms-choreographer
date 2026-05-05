---
member: opencode2
model: opencode/gpt-5.5
phase: phase-2-rebuttal-round-1
timestamp: 2026-05-05T00:00:00Z
exit_code: 0
---

**Rebuttal**

I concede: opencode1 is right on narrow blocker semantics. Research rewrite is not required to type the first Ship 1 routing patch if Ship 1 means only "change `runAgent` routing and keep existing subprocess behavior."

I still disagree: that narrow definition is not the right gate for this review. This debate is about approving the ACP migration plan as implementation ground truth. If the plan and research contradict each other, implementers inherit ambiguous requirements. That blocks starting the migration from a reviewed baseline, even if one small Ship 1 patch is mechanically obvious.

Updated position: research rewrite is a **Ship 1 plan-approval / Ship 1 exit / Ship 2 start blocker**, not a "first 20 LoC cannot be written" blocker. The plan should say that explicitly.

I concede: opencode3's label is best: "Ship 1 exit / Ship 2 start blocker." It preserves velocity without pretending contradictory source docs are harmless.

I disagree with opencode1's phased-disambiguation argument. Phasing implementation is correct. Phasing known plan corrections is not. The 10 items are doc edits, not engineering milestones. Leaving some corrections for later creates an intermediate plan that everyone already knows is partially wrong.

Sharpened position: **atomic revision of plan docs, phased implementation of code**. Ship 1 should not wait for perfect research prose if someone is prototyping locally, but the approved migration plan should not remain internally inconsistent after review.

**Concessions**

I concede: `@agentclientprotocol/claude-agent-acp` should be the primary Claude ACP stdio package. `@anthropic-ai/claude-agent-sdk` is fallback/reference only, because it is wrapped by the ACP package rather than being the ACP stdio adapter itself.

I concede: Gemini must be removed from Ship 1/2. Keeping Gemini in `REGISTRY`, `/choreo:gemini`, or adapter tables violates the current constraint and invites accidental scope creep.

I concede: schema validation should be ACP-first and client-side uniform. Codex-native schema guarantees should not create a privileged path or automatic fallback.

I concede: broker split is correct. The current plan gap is not the split itself. The gap is missing concrete event taxonomy, producers, and consumers.

**Broker Text Fix**

The plan should add a concrete table like this:

```markdown
### Broker channels and event ownership

`broker.agents[name]` carries per-agent ACP traffic only.

Producer: each ACP client adapter.
Events: `session_update`, `content_delta`, `tool_call`, `tool_result`, `agent_error`, `agent_exit`.
Consumers: terminal UI, agent transcript recorder, observability adapter for per-agent stream metrics.

`broker.events` carries choreography lifecycle and cross-agent coordination events.

Producers: `lifecycle.mjs`, builder orchestration, verifier dispatcher.
Events: `session_start`, `session_end`, `builder_stop`, `verifier_dispatch`, `verifier_report`, `lifecycle_transition`, `run_error`.
Consumers: `core/observability.mjs`, verifier loop, final run summary, future dashboard/event sink.

Rule: ACP protocol frames stay on `broker.agents[name]`; orchestration decisions and lifecycle facts stay on `broker.events`.
```

This resolves the shared plan-text gap. It names channels, event types, producers, consumers, and boundary rule.

**Updated Position**

Research rewrite: blocker for approved migration baseline, Ship 1 exit, and Ship 2 start; not blocker for a local Ship 1 routing prototype.

Claude package: `@agentclientprotocol/claude-agent-acp` primary; Claude SDK fallback/reference.

Gemini: remove from Ship 1/2 entirely.

Schema: uniform ACP-first client-side validation.

Broker split: keep it, but add concrete event taxonomy.

Revision strategy: make all 10 doc corrections atomically now; implement code in phases after that.
