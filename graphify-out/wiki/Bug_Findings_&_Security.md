# Bug Findings & Security

> 32 nodes · cohesion 0.09

## Key Concepts

- **Findings — 260423-quality (10 ranked findings)** (12 connections) — `predict/260423-10348-quality/findings.md`
- **Hypothesis Queue — 260423-quality** (11 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **Completed Work (6 bugs fixed, installer hardened, bundle drift guard)** (7 connections) — `llms/context/session-summary.md`
- **Session Summary — choreographer** (6 connections) — `llms/context/session-summary.md`
- **Predict Analysis — 260423-quality** (4 connections) — `predict/260423-10348-quality/overview.md`
- **Finding 1: --dangerously-skip-permissions universal** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 2: vote tally accepts all-INVALID silently** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 5: checkCli spawnSync no timeout** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 6: runAgent no timeout hangs indefinitely** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 7: requireAvailable calls process.exit(1) in library** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 8: parseClaudeStreamJson silently swallows JSON errors** (3 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 10: Supply-chain risk npm name unclaimed + curl-pipe installer** (2 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 3: git diff LLM prompt injection + maxBuffer overflow** (2 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 4: readdirSync unhandled ENOENT** (2 connections) — `predict/260423-10348-quality/findings.md`
- **Finding 9: install.mjs silently overwrites no version guard no rollback** (2 connections) — `predict/260423-10348-quality/findings.md`
- **H-01: --dangerously-skip-permissions universal (HIGH, 5/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-02: vote exits 0 on all-INVALID tally (HIGH, 5/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-03: git diff injected verbatim into LLM prompt + maxBuffer overflow (HIGH, 5/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-04: readdirSync ENOENT if commands dir absent (HIGH, 5/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-05: checkCli spawnSync no timeout (HIGH, 5/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-06: runAgent no timeout — hangs indefinitely (HIGH, 4/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-07: requireAvailable calls process.exit(1) in library (HIGH, 4/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-08: parseClaudeStreamJson silently drops malformed JSON (HIGH, 4/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-09: PLUGIN_VERSION hardcoded 1.0.0 no rollback (MEDIUM, 2/5)** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- **H-10: Supply-chain risk npm name unclaimed + curl-pipe** (2 connections) — `predict/260423-10348-quality/hypothesis-queue.md`
- *... and 7 more nodes in this community*

## Relationships

- [[Key Decisions]] (1 shared connections)

## Source Files

- `llms/context/session-summary.md`
- `plugin-codex/skills/vote/SKILL.md`
- `predict/260423-10348-quality/findings.md`
- `predict/260423-10348-quality/hypothesis-queue.md`
- `predict/260423-10348-quality/overview.md`

## Audit Trail

- EXTRACTED: 81 (85%)
- INFERRED: 14 (15%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*