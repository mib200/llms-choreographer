---
member: opencode2
model: opencode-go/qwen3.6-plus
phase: phase-0-preflight
timestamp: 2026-05-04T18:50:24Z
exit_code: 0
---

[council] phase=phase-0-preflight member=opencode2 model=opencode-go/qwen3.6-plus cmd=opencode run --dangerously-skip-permissions --agent build -m opencode-go/qwen3.6-plus "..."
[0m
> build · qwen3.6-plus
[0m
[0m→ [0mRead ../../../../.claude/plans/harmonic-noodling-pumpkin.md
[0m→ [0mRead docs/codex-appserver-migration-plan.md
[0m→ [0mRead docs/project-overview-pdr.md
[0m→ [0mRead ../../../../.claude/skills/council/SKILL.md
[0m→ [0mRead core/companion.mjs
Now let me also read the key external plugin files referenced in the plan:
[0m→ [0mRead ../../../../Downloads/codex-plugin-cc-main/plugins/codex/scripts/app-server-broker.mjs
[0m→ [0mRead core/runners.mjs
1. **Codex ACP shim feasibility**: The plan recommends deciding in Phase 0 between writing an ACP↔app-server translator vs keeping Codex on native app-server with a dual-protocol broker. Has anyone already verified whether `codex app-server`'s `thread/resume`, `turn/interrupt`, and streaming notification semantics have direct ACP equivalents, or is this still a pure unknown that could block Ships 2–5?

2. **Broker generalization scope**: The external plugin's broker (`app-server-broker.mjs`) is Codex-specific — it manages a single `CodexAppServerClient` connection with active-request routing. The plan generalizes this to "one broker process that manages N long-lived agent connections keyed by agent name." What is the expected transport uniformity across agents (Unix socket JSON-RPC for all? HTTP/WS for opencode? stdio for Claude?) — has the ACP spec been confirmed to support a shared multiplexing broker pattern, or would each agent need its own broker instance?

3. **Wholesale council port vs incremental**: The plan ports the full 490-line global council protocol (6 phases, Question Routing, DEADLOCK veto, Gemini retry/fallback/skip, anonymization, pre-flight dedup) in a single Phase 4. Given the current council is a 3-fixed-role `Promise.all` with no state machine, has the complexity of porting the entire protocol at once been weighed against an incremental approach (e.g., synthesis-only first, then rebuttals), especially since the protocol relies heavily on Claude Code's `AskUserQuestion` tool which may not exist in Codex/opencode host environments?
---EXIT:0---
