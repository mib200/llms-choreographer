# Build Pipeline

> 17 nodes · cohesion 0.13

## Key Concepts

- **System Architecture** (11 connections) — `docs/system-architecture.md`
- **parsers.mjs — output parsers** (4 connections) — `docs/codebase-summary.md`
- **bundled outputs committed to git** (3 connections) — `docs/system-architecture.md`
- **--dangerously-skip-permissions on delegated Claude calls** (3 connections) — `docs/system-architecture.md`
- **--output-format stream-json constraint (Bedrock)** (3 connections) — `docs/system-architecture.md`
- **esbuild bundle pipeline** (2 connections) — `docs/deployment-guide.md`
- **no runtime npm deps constraint** (2 connections) — `docs/system-architecture.md`
- **parseClaudeStreamJson — Claude stream output parser** (2 connections) — `docs/codebase-summary.md`
- **round-trip delegation matrix** (2 connections) — `docs/delegation.md`
- **Delegation Round-Trip Reference** (2 connections) — `docs/delegation.md`
- **Deployment Guide** (2 connections) — `docs/deployment-guide.md`
- **Learn Session Summary 2026-04-23** (2 connections) — `learn/260423-update/summary.md`
- **parseOpenCodeOutput — OpenCode output parser** (1 connections) — `docs/codebase-summary.md`
- **Rationale: bundles committed because plugins installed by file copy not npm install** (1 connections) — `docs/system-architecture.md`
- **Rationale: no running server — subprocess invocation at command time** (1 connections) — `docs/system-architecture.md`
- **Rationale: --dangerously-skip-permissions required for non-interactive delegated Claude** (1 connections) — `docs/system-architecture.md`
- **Rationale: Bedrock returns empty result with plain --print; stream-json only reliable format** (1 connections) — `docs/system-architecture.md`

## Relationships

- [[Agent Routing]] (3 shared connections)
- [[Slash Commands]] (3 shared connections)
- [[Project Overview]] (1 shared connections)

## Source Files

- `docs/codebase-summary.md`
- `docs/delegation.md`
- `docs/deployment-guide.md`
- `docs/system-architecture.md`
- `learn/260423-update/summary.md`

## Audit Trail

- EXTRACTED: 38 (88%)
- INFERRED: 5 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*