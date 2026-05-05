---
member: opencode5
model: opencode/gemini-3-flash
phase: phase-1-opening
timestamp: 2026-05-05T00:10:00Z
exit_code: 0
---

## RECOMMENDED APPROACH

**Pivot from "Infrastructure-First Broker" to "Protocol-First Bridge."**

We are over-engineering the transport layer at the expense of the reasoning logic. The proposed Path B broker daemon is a classic architectural trap: building a universal adapter layer (ACP) before we have a stable multi-agent conversation. Instead of a shared broker daemon, we should implement the Council Protocol as a stateless orchestrator library that operates over direct agent-to-agent bridges. We must prioritize the Adversarial Review value of Codex over the Universal Parity of a broker that treats every agent as a generic JSON-passing node.

## TOP 3 REASONS

1. **The Infrastructure-Product Mismatch:** 5-increment ship plan where the first two increments (Adapters and Broker) provide zero user-facing value. Spending two months on a broker daemon is a terminal mistake. By the time Ship 3 lands with the Council port, the underlying agents will have changed their API signatures twice. Ship 1 should be a functional Codex-Claude adversarial loop, not a transport shim.

2. **The Lowest-Common-Denominator Adapter:** The Codex ACP shim fundamentally dilutes what makes Codex unique — its deep integration with the IDE and its specific stop-event lifecycle. By forcing it behind an ACP abstraction, we are stripping away the context-aware "magic" of Codex to make it look like a generic Gemini instance. Parity is a false idol; we should be leaning into agent specialization.

3. **Protocol Bloat (490 lines vs 39 lines):** Moving from a 39-line flat Promise.all to a 490-line, 6-phase, 7-evolution protocol is a 12x increase in complexity. Adding "adaptive round counts," "minority position preservation," and "cross-session persistence" simultaneously will lead to an un-debuggable "Council of Slop" where agents timeout waiting for synthesis. We need the 6 phases, but we must kill at least 4 of the 7 evolutions to maintain a tight feedback loop.

## KEY RISKS YOU ACCEPT

By rejecting the Broker-first approach, we accept that transport logic will be duplicated across initial agent adapters. We also accept a higher integration tax whenever a new agent is added, as we won't have a universal ACP daemon. We are trading long-term "clean" infrastructure for immediate adversarial signal.

## WHAT YOU EXPLICITLY WOULD NOT DO

**I would NOT port Evolution (F): Cross-session debates.**

Managing `_index.json` for cross-session persistence adds a stateful requirement to what should be a stateless, prompt-driven orchestration. It introduces file-locking issues, cache invalidation bugs, and context-window bloat if we try to re-read old debates into new rounds. If a debate is important enough to persist, it should be committed as a markdown artifact by the user, not managed by a hidden choreo-index.

## POSITIONS ON DECISIONS

* **ACP-First Broker (REJECT):** Path B gold-plating. A broker daemon is a solution looking for a problem. Use a lightweight library; do not force a daemon process that requires lifecycle management and fail-loud probes.
* **Codex ACP Shim (REJECT):** Do not shim. Create a direct CodexAdapter that knows how to talk to the codex-app-server. Shimming to ACP adds serialization/deserialization that hides headers/metadata we need for Stop-review gates.
* **Opencode Serve Mandate (SUPPORT):** The only part of the plan that respects reality. No silent fallback is essential. If the environment isn't set up for multi-agent work, crash immediately rather than provide a degraded, single-agent experience the user mistakes for a Council.
* **Pi.dev Deferral (SUPPORT):** Correct. Adding a third-party hosted orchestrator while we are still struggling with local companion.mjs logic is a distraction.
* **Stop-review Gate (SUPPORT — ELEVATE TO SHIP 1):** The Killer App of the choreographer. Having Codex review Claude's final output is the single most valuable contribution this repo can make. Should be Ship 1, not Ship 5.

The goal is a better answer, not a cleaner diagram. Let's build the bridge, not the terminal.
