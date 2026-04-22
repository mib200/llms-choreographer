# Graph Report - .  (2026-04-23)

## Corpus Check
- Corpus is ~14,811 words - fits in a single context window. You may not need a graph.

## Summary
- 73 nodes · 129 edges · 6 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Install & Plugin Commands|Install & Plugin Commands]]
- [[_COMMUNITY_Agent Registry & Codex Skills|Agent Registry & Codex Skills]]
- [[_COMMUNITY_Core Orchestrator (companion.mjs)|Core Orchestrator (companion.mjs)]]
- [[_COMMUNITY_Codex Skill Implementations|Codex Skill Implementations]]
- [[_COMMUNITY_Per-Agent Check & Parse Helpers|Per-Agent Check & Parse Helpers]]
- [[_COMMUNITY_Test Suite|Test Suite]]

## God Nodes (most connected - your core abstractions)
1. `Commands reference table (Claude/OpenCode slash commands)` - 12 edges
2. `Install step: claude plugin marketplace add + install` - 11 edges
3. `Agent: Claude CLI (claude --print)` - 10 edges
4. `Claude plugin command: /llms-choreographer:council` - 8 edges
5. `Claude plugin command: /llms-choreographer:debug` - 8 edges
6. `Claude plugin command: /llms-choreographer:vote` - 8 edges
7. `Agent: OpenCode CLI (opencode run)` - 8 edges
8. `Install step: symlink for-codex/<name>/ → ~/.codex/skills/<name>/` - 8 edges
9. `Workflow patterns (council/review/debug/second-opinion/vote)` - 6 edges
10. `install-local.sh — symlink repo artifacts into CLI config dirs` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Commands reference table (Claude/OpenCode slash commands)` --references--> `Claude plugin command: /codex:setup`  [EXTRACTED]
  README.md → plugins/codex/commands/setup.md
- `Commands reference table (Claude/OpenCode slash commands)` --references--> `Claude plugin command: /llms-choreographer:council`  [EXTRACTED]
  README.md → plugins/llms-choreographer/commands/council.md
- `Commands reference table (Claude/OpenCode slash commands)` --references--> `Claude plugin command: /llms-choreographer:debug`  [EXTRACTED]
  README.md → plugins/llms-choreographer/commands/debug.md
- `Commands reference table (Claude/OpenCode slash commands)` --references--> `Claude plugin command: /llms-choreographer:review`  [EXTRACTED]
  README.md → plugins/llms-choreographer/commands/review.md
- `Commands reference table (Claude/OpenCode slash commands)` --references--> `Claude plugin command: /llms-choreographer:second-opinion`  [EXTRACTED]
  README.md → plugins/llms-choreographer/commands/second-opinion.md

## Communities

### Community 0 - "Install & Plugin Commands"
Cohesion: 0.21
Nodes (16): Agent: OpenCode CLI (opencode run), Install step: claude plugin marketplace add + install, Install step: symlink .opencode/commands/*.md → ~/.config/opencode/commands/*.md, Claude plugin command: /claude:review, Claude plugin command: /claude:run, Claude plugin command: /codex:run, Claude plugin command: /codex:setup, Claude plugin command: /opencode:review (+8 more)

### Community 1 - "Agent Registry & Codex Skills"
Cohesion: 0.29
Nodes (15): Agent: Claude CLI (claude --print), Agent: Cursor CLI (agent -p --force), Agent: Gemini CLI (gemini --prompt), Agent: Kilo CLI (kilo run --auto), Codex skill: LLM Council, Codex skill: Parallel Debug, Codex skill: Parallel Vote, Concept: graceful degradation (command -v check, skip missing agents) (+7 more)

### Community 2 - "Core Orchestrator (companion.mjs)"
Cohesion: 0.19
Nodes (4): checkCli(), filterAvailable(), printMissingWarning(), requireAvailable()

### Community 3 - "Codex Skill Implementations"
Cohesion: 0.25
Nodes (11): Codex skill: Delegate to Claude, Codex skill: Delegate to OpenCode, Codex skill: Parallel Code Review, Codex skill: Second Opinion, Concept: companion.mjs script (Claude plugin runner), Concept: second-opinion fallback order (gemini→claude→codex→kilo→cursor), Install step: symlink for-codex/<name>/ → ~/.codex/skills/<name>/, Pattern: parallel-review — code review across agents (+3 more)

### Community 4 - "Per-Agent Check & Parse Helpers"
Cohesion: 0.2
Nodes (2): parseOpenCodeOutput(), stripFlags()

### Community 5 - "Test Suite"
Cohesion: 0.25
Nodes (0): 

## Knowledge Gaps
- **1 isolated node(s):** `Six delegation directions concept`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Commands reference table (Claude/OpenCode slash commands)` connect `Install & Plugin Commands` to `Agent Registry & Codex Skills`, `Codex Skill Implementations`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Install step: claude plugin marketplace add + install` connect `Install & Plugin Commands` to `Agent Registry & Codex Skills`, `Codex Skill Implementations`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `stripFlags()` connect `Per-Agent Check & Parse Helpers` to `Core Orchestrator (companion.mjs)`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `Six delegation directions concept` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._