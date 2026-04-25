# Install & Setup

> 15 nodes · cohesion 0.15

## Key Concepts

- **Workflow patterns (council/review/debug/second-opinion/vote)** (6 connections) — `README.md`
- **install-local.sh — symlink repo artifacts into CLI config dirs** (6 connections) — `scripts/install-local.sh`
- **LLMs Choreographer (project overview)** (4 connections) — `README.md`
- **Install section (prerequisites + scripts)** (3 connections) — `README.md`
- **Install step: claude plugin marketplace add + install** (2 connections) — `scripts/install-local.sh`
- **claude-print-args.sh — print --plugin-dir args for installed plugins** (2 connections) — `scripts/claude-print-args.sh`
- **uninstall-local.sh — reverse of install-local.sh** (2 connections) — `scripts/uninstall-local.sh`
- **Install step: symlink for-codex/<name>/ → ~/.codex/skills/<name>/** (1 connections) — `scripts/install-local.sh`
- **Install step: symlink .opencode/commands/*.md → ~/.config/opencode/commands/*.md** (1 connections) — `scripts/install-local.sh`
- **Pattern: council — all agents answer in parallel** (1 connections) — `README.md`
- **Pattern: parallel-debug — root-cause triage across agents** (1 connections) — `README.md`
- **Pattern: parallel-review — code review across agents** (1 connections) — `README.md`
- **Pattern: second-opinion — single peer agent alternative perspective** (1 connections) — `README.md`
- **Pattern: vote — agents vote YES/NO/ABSTAIN** (1 connections) — `README.md`
- **Six delegation directions concept** (1 connections) — `README.md`

## Relationships

- [[Slash Commands]] (1 shared connections)

## Source Files

- `README.md`
- `scripts/claude-print-args.sh`
- `scripts/install-local.sh`
- `scripts/uninstall-local.sh`

## Audit Trail

- EXTRACTED: 31 (94%)
- INFERRED: 2 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*