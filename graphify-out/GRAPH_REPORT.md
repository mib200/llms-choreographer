# Graph Report - .  (2026-04-25)

## Corpus Check
- Corpus is ~18,759 words - fits in a single context window. You may not need a graph.

## Summary
- 180 nodes · 229 edges · 20 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Bug Findings & Security|Bug Findings & Security]]
- [[_COMMUNITY_Stream Parsers|Stream Parsers]]
- [[_COMMUNITY_Slash Commands|Slash Commands]]
- [[_COMMUNITY_Build Pipeline|Build Pipeline]]
- [[_COMMUNITY_Install & Setup|Install & Setup]]
- [[_COMMUNITY_Agent Routing|Agent Routing]]
- [[_COMMUNITY_Delegation Skills|Delegation Skills]]
- [[_COMMUNITY_Companion Core|Companion Core]]
- [[_COMMUNITY_Test Helpers|Test Helpers]]
- [[_COMMUNITY_Testing Guide|Testing Guide]]
- [[_COMMUNITY_Project Overview|Project Overview]]
- [[_COMMUNITY_Graph Metadata|Graph Metadata]]
- [[_COMMUNITY_Plugin Installers|Plugin Installers]]
- [[_COMMUNITY_Key Decisions|Key Decisions]]
- [[_COMMUNITY_Second Opinion|Second Opinion]]
- [[_COMMUNITY_Bundle Checks|Bundle Checks]]
- [[_COMMUNITY_Plugin Entry Points|Plugin Entry Points]]
- [[_COMMUNITY_Plugin Entry Points|Plugin Entry Points]]
- [[_COMMUNITY_Bundle Scripts|Bundle Scripts]]
- [[_COMMUNITY_Plugin Entry Points|Plugin Entry Points]]

## God Nodes (most connected - your core abstractions)
1. `companion.mjs — core orchestrator / CLI dispatcher` - 13 edges
2. `Findings — 260423-quality (10 ranked findings)` - 12 edges
3. `System Architecture` - 11 edges
4. `Hypothesis Queue — 260423-quality` - 11 edges
5. `Commands Reference` - 10 edges
6. `Codebase Summary` - 8 edges
7. `Completed Work (6 bugs fixed, installer hardened, bundle drift guard)` - 7 edges
8. `Workflow patterns (council/review/debug/second-opinion/vote)` - 6 edges
9. `install-local.sh — symlink repo artifacts into CLI config dirs` - 6 edges
10. `Project Overview / PDR` - 6 edges

## Surprising Connections (you probably didn't know these)
- `graphify skill trigger` --references--> `choreo skill (SKILL.md)`  [INFERRED]
  CLAUDE.md → plugin-claude/skills/choreo/SKILL.md
- `/choreo:codex command` --invokes--> `companion.mjs — core orchestrator / CLI dispatcher`  [INFERRED]
  plugin-claude/commands/codex.md → docs/codebase-summary.md
- `/choreo:opencode command` --invokes--> `companion.mjs — core orchestrator / CLI dispatcher`  [INFERRED]
  plugin-claude/commands/opencode.md → docs/codebase-summary.md
- `/choreo:claude command` --invokes--> `companion.mjs — core orchestrator / CLI dispatcher`  [INFERRED]
  plugin-claude/commands/claude.md → docs/codebase-summary.md
- `choreo skill (SKILL.md)` --enables--> `delegation mesh — all-agent routing`  [INFERRED]
  plugin-claude/skills/choreo/SKILL.md → docs/project-overview-pdr.md

## Communities

### Community 0 - "Bug Findings & Security"
Cohesion: 0.09
Nodes (32): Findings — 260423-quality (10 ranked findings), Finding 1: --dangerously-skip-permissions universal, Finding 10: Supply-chain risk npm name unclaimed + curl-pipe installer, Finding 2: vote tally accepts all-INVALID silently, Finding 3: git diff LLM prompt injection + maxBuffer overflow, Finding 4: readdirSync unhandled ENOENT, Finding 5: checkCli spawnSync no timeout, Finding 6: runAgent no timeout hangs indefinitely (+24 more)

### Community 1 - "Stream Parsers"
Cohesion: 0.17
Nodes (11): checkCli(), filterAvailable(), parseClaudeStreamJson(), parseOpenCodeOutput(), printDelimited(), printJSON(), printMissingWarning(), prompt() (+3 more)

### Community 2 - "Slash Commands"
Cohesion: 0.16
Nodes (19): graphify skill trigger, /choreo:claude command, /choreo:codex command, /choreo:council command, /choreo:opencode command, /choreo:parallel-debug command, /choreo:parallel-review command, /choreo:second-opinion command (+11 more)

### Community 3 - "Build Pipeline"
Cohesion: 0.13
Nodes (17): bundled outputs committed to git, --dangerously-skip-permissions on delegated Claude calls, esbuild bundle pipeline, no runtime npm deps constraint, parseClaudeStreamJson — Claude stream output parser, parseOpenCodeOutput — OpenCode output parser, parsers.mjs — output parsers, round-trip delegation matrix (+9 more)

### Community 4 - "Install & Setup"
Cohesion: 0.15
Nodes (15): Install step: claude plugin marketplace add + install, Install step: symlink for-codex/<name>/ → ~/.codex/skills/<name>/, Install step: symlink .opencode/commands/*.md → ~/.config/opencode/commands/*.md, Pattern: council — all agents answer in parallel, Pattern: parallel-debug — root-cause triage across agents, Pattern: parallel-review — code review across agents, Pattern: second-opinion — single peer agent alternative perspective, Pattern: vote — agents vote YES/NO/ABSTAIN (+7 more)

### Community 5 - "Agent Routing"
Cohesion: 0.24
Nodes (11): choreo namespace /choreo:* and /choreo-*, delegation mesh — all-agent routing, fake-agents.mjs — test helpers, filterAvailable — filters available agents, plugin-claude — Claude Code plugin, plugin-codex — Codex plugin, plugin-opencode — OpenCode plugin (npm), REGISTRY — agent availability registry (+3 more)

### Community 6 - "Delegation Skills"
Cohesion: 0.25
Nodes (11): Skill: choreo-claude (delegate task to Claude Code), Skill: choreo-codex (delegate task to Codex), Skill: choreo-council (parallel review all agents, different foci), Council review foci: Claude=correctness/security, Codex=scope/simplicity, OpenCode=integration, choreo-council usage: companion.mjs council <task>, Skill: choreo-debug (alias for parallel-debug), Skill: choreo-opencode (delegate task to OpenCode), Skill: choreo-parallel-debug (root-cause hypotheses all agents) (+3 more)

### Community 7 - "Companion Core"
Cohesion: 0.31
Nodes (4): checkCli(), filterAvailable(), printMissingWarning(), requireAvailable()

### Community 8 - "Test Helpers"
Cohesion: 0.25
Nodes (0): 

### Community 9 - "Testing Guide"
Cohesion: 0.25
Nodes (8): CI / Automation (no CI, local only), Coverage Expectations, createFakeAgents(agents, tmpDir), Testing Guide — Choreographer, helpers/fake-agents.mjs, runCompanion(args, env), Test File Reference (7 test files), Test Strategy (unit + integration + fallback)

### Community 10 - "Project Overview"
Cohesion: 0.33
Nodes (7): Choreographer — multi-agent delegation monorepo, no model selection — each agent uses own config, no persistent state — results ephemeral, Project Overview / PDR, Rationale: each AI CLI is an island — context lost at boundaries without orchestration, Choreographer, Install

### Community 11 - "Graph Metadata"
Cohesion: 0.29
Nodes (7): Communities 0-12, Graph Report 2026-04-25, God Nodes (most connected abstractions), Knowledge Gaps (isolated nodes + thin communities), Suggested Questions (bridge nodes, isolation), Graph Summary (89 nodes, 151 edges, 13 communities), Surprising Connections

### Community 12 - "Plugin Installers"
Cohesion: 0.5
Nodes (0): 

### Community 13 - "Key Decisions"
Cohesion: 0.67
Nodes (3): Key Decisions (template syntax, stream-json for bedrock), Rationale: ${VAR} curly braces required for Claude Code template substitution, Rationale: stream-json over --print for Bedrock (empty result field)

### Community 14 - "Second Opinion"
Cohesion: 0.67
Nodes (3): Skill: choreo-second-opinion (single peer agent alternative perspective), second-opinion fallback order: gemini→claude→codex→kilo→cursor, second-opinion verdict: approve / approve-with-caveats / reject

### Community 15 - "Bundle Checks"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Plugin Entry Points"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Plugin Entry Points"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Bundle Scripts"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Plugin Entry Points"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **48 isolated node(s):** `Six delegation directions concept`, `Pattern: council — all agents answer in parallel`, `Pattern: parallel-review — code review across agents`, `Pattern: parallel-debug — root-cause triage across agents`, `Pattern: second-opinion — single peer agent alternative perspective` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Bundle Checks`** (2 nodes): `sha()`, `check-bundles.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plugin Entry Points`** (1 nodes): `entry.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plugin Entry Points`** (1 nodes): `entry.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bundle Scripts`** (1 nodes): `bundle.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plugin Entry Points`** (1 nodes): `entry.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `companion.mjs — core orchestrator / CLI dispatcher` connect `Slash Commands` to `Build Pipeline`, `Agent Routing`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `Commands Reference` connect `Slash Commands` to `Project Overview`, `Install & Setup`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `LLMs Choreographer (project overview)` connect `Install & Setup` to `Slash Commands`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `companion.mjs — core orchestrator / CLI dispatcher` (e.g. with `/choreo:vote command` and `/choreo:parallel-debug command`) actually correct?**
  _`companion.mjs — core orchestrator / CLI dispatcher` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Six delegation directions concept`, `Pattern: council — all agents answer in parallel`, `Pattern: parallel-review — code review across agents` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bug Findings & Security` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._