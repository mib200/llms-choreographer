<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **llms-choreographer** (1857 symbols, 2413 relationships, 43 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/llms-choreographer/context` | Codebase overview, check index freshness |
| `gitnexus://repo/llms-choreographer/clusters` | All functional areas |
| `gitnexus://repo/llms-choreographer/processes` | All execution flows |
| `gitnexus://repo/llms-choreographer/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Documented Solutions

`docs/solutions/` — documented solutions to past problems (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

## Active Migration — ACP-First Plan

Active plan: `docs/plans/2026-05-05-acp-migration-plan.md` (5 ships: foundation → ACP broker → council → verifier loop → adversarial review).

**Ship 1 status:** SHIPPED on `feature/acp-migration` (commits `5371e012` → `3e8c9ef`). Codex cross-check passes 1–5 in `docs/reviews/codex-adversarial-2026-05-05/`.

**Deferred Ship-1 residuals (do NOT fix between ships):**
- **F8 residual** — `core/companion.mjs:70-79`: known flags (`--json`, `--model=`, `--effort=`) consumed after first positional task token.
- **NFF1** — `core/runners.mjs:18-47`: env allowlist lacks additive opt-in (`CHOREO_AGENT_ENV_ALLOW`); users forced into full `CHOREO_AGENT_ENV_PASSTHROUGH=1` bypass for proxy/ADC vars.

Re-test + fix only during **post-Ship-5 final plan review**, per plan §"Ship 1 — deferred to final plan review". Ship 1 → Ship 2 handoff proceeds with these as carried debt.
