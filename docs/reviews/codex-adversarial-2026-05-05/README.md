# Codex Adversarial Review — Ship 1 Cross-Check

**Branch:** `feature/acp-migration` (HEAD `1bf15de`, code state `36861d7`)
**Base:** `main`
**Reviewer:** Codex CLI (gpt-5.x)
**Date:** 2026-05-05
**Scope:** `core/observability.mjs`, `core/companion.mjs` agent subcommand, `core/tests/*`, shipped plugin bundles

## Why this review exists

Ship 1 foundation landed via merge `5371e012` and was hardened by 3 sequential `/xreview` rounds (commits `94ca34d` / `b0c9696` / `36861d7`), all driven by the **Claude panel** (opus-4.7, qwen3.6-plus, gpt-5.4/5.5, kimi). This Codex cross-check asks: would an independent reviewer in a different model family converge on the same findings, or surface blind spots the Claude panel shared?

Output: 3 passes (base → fix-verification → final vs `main`) + this rollup.

## Pass artifacts

| Pass | Target | File | Finding count |
|------|--------|------|---------------|
| 1 | merge `5371e012` base | [pass-1-base-merge.md](pass-1-base-merge.md) | 8 total: **1×P0, 5×P1, 2×P2** |
| 2 | fix stack `94ca34d` → `b0c9696` → `36861d7` | [pass-2-fix-verification.md](pass-2-fix-verification.md) | 4/8 fixed, 2 partial, 2 unchanged, **2 new findings** (1×P1, 1×P2) |
| 3 | final state vs `main` (residual + cross-commit) | [pass-3-final-vs-main.md](pass-3-final-vs-main.md) | 2 total: **1×P1 SHIP-1, 1×P3 SHIP-2** |

## Disposition of Pass-1 findings after 3 hardening rounds

| Id | Title | Sev | Final | Fixed by | Residual |
|----|-------|-----|-------|----------|----------|
| F1 | Active-day rotation truncates audit log | P0 | **fixed** | Phase A (rename-to-backup), Phase B (sequential), Phase C (O_EXCL reservation) | none — BUT see FF1 |
| F2 | Agent child failures not returned to caller | P1 | **fixed** | Phase A (process.exit) → Phase B regression → Phase C (drain + hard exit) | none |
| F3 | Raw task text + no private file mode | P1 | **partial** | Phase A (hash+length redaction) | `mkdirSync` / `appendFileSync` still use default perms (no `0700`/`0600`) |
| F4 | Retention deletes by mtime on any `.ndjson` | P1 | **partial** | Phase A/B (owned-name whitelist) | mtime-only deletion still drops current-date logs restored with old mtime |
| F5 | Size-cap rotation racy across emitters | P1 | **fixed** | Phase A/B/C composite | none — BUT see FF1 |
| F6 | Env inheritance + `--dangerously-skip-permissions` | P1 | **unchanged** | none | full parent env still flows to child agents; bypass flag still default |
| F7 | Tests write to real `~/.choreo/logs` | P2 | **fixed** | Phase A (`CHOREO_LOG_DIR` injectable) | none |
| F8 | Flag-stripping corrupts task text starting `--` | P2 | **unchanged** | none | parser still drops every `--*` token |

**New issues the fix commits themselves introduced:**

| Id | Title | Sev | Source |
|----|-------|-----|--------|
| NF1 | Unsafe dispatch + `--dangerously-skip-permissions` shipped in all plugin bundles | P1 | Phase A regenerated bundles |
| NF2 | Flag-stripping bug propagated into all plugin bundles | P2 | Phase A regenerated bundles |

**Cross-commit interaction / residual (Pass 3):**

| Id | Title | Sev | Gate |
|----|-------|-----|------|
| FF1 | O_EXCL reserves destination but not active source — concurrent rotation can still drop events | P1 | SHIP-1 blocker |
| FF2 | `agent_completion` lacks `task_hash` / invocation id — cannot correlate under parallel runs | P3 | SHIP-2 |

## Does Codex corroborate the Claude panel?

**Yes, with two material exceptions.**

| Theme | Claude panel | Codex | Convergence |
|-------|--------------|-------|-------------|
| Active-day truncation (F1 / Phase A P0) | ✅ flagged, fixed | ✅ F1 P0, confirms fix | **Corroborates** |
| Agent exit propagation (F2 / Phase A P1) | ✅ flagged, fixed | ✅ F2 P1, confirms final fix | **Corroborates** |
| Raw task in event (F3 / Phase A P1) | ✅ flagged, fixed redaction | ✅ F3 P1, confirms partial — flags missing file perms | **Deeper** |
| Retention sweeping unowned files (F4 / Phase B) | ✅ flagged, whitelist added | ✅ F4 P1, confirms partial — flags mtime-only residual | **Deeper** |
| Rotation race (F5 / Phase C O_EXCL) | ✅ flagged, fixed via O_EXCL destination | ✅ fix path confirmed BUT **FF1 flags source-rename gap the Claude panel missed** | **Codex-unique P1** |
| Env inheritance / `skip-permissions` (F6) | ⚠️ absent — Claude panel did not raise this | ✅ F6 P1 + NF1 P1 (shipped in plugin bundles) | **Codex-unique P1** |
| Flag-stripping task corruption (F8) | ⚠️ absent — Claude panel did not raise | ✅ F8 P2 + NF2 P2 (shipped in bundles) | **Codex-unique P2** |
| Completion correlation (FF2) | ⚠️ absent | ✅ FF2 P3 | **Codex-unique P3** |

**Convergence on hardened findings:** Codex independently confirms every Pass-1 Claude-panel finding the hardening stack closed, validating that the fix direction was correct.

**Divergence / Claude-panel blind spots:**
- **F6 / NF1 — security posture of the child-agent spawn path.** Claude panel treated `--dangerously-skip-permissions` as intentional (per `MEMORY.md`) and did not adversarially review the env-inheritance risk of a delegated child-agent. Codex flags it as P1.
- **F8 / NF2 — argv parsing.** Claude panel focused almost exclusively on observability; the companion agent subcommand's task parser was never put under review. Codex catches a silent task-text corruption.
- **FF1 — rotation source race.** All 3 /xreview rounds focused on the **backup-destination collision** race. O_EXCL was added to reserve the destination name. Codex surfaces that the **active source file** between `statSync` and `renameSync` is still unguarded; a second process can `ENOENT` during rename, the exception is swallowed in `emit()` by the companion, and the event is silently lost. This is the same class of race the panel thought it had closed.

## Ship gate verdict

**HOLD (MERGE-WITH-FIX).** Codex identifies:

- **1 SHIP-1 blocker:** FF1 (rotation source-file race) — a P1 that voids the stated "fail-closed observability" invariant documented in the solution doc. Without a source-ownership guarantee, concurrent cap rotations can still lose audit events.
- **2 cross-cutting Ship-1 concerns not raised by Claude panel:** F6/NF1 (env + permission bypass in shipped plugin bundles) and F8/NF2 (task-text corruption). The user's durable decision (`~/.claude/projects/.../decision_h01_skip_permissions.md`) has already accepted H-01 `--dangerously-skip-permissions`. But env-inheritance without allowlist is an independent issue Codex raises that the accepted decision does not explicitly cover.
- **Safe to defer (SHIP-2):** F3 residual (file perms `0700`/`0600`), F4 residual (mtime-only retention), FF2 (completion correlation id).

## Recommendation for a Phase D commit

If the user chooses to close the SHIP-1 gap before merging `feature/acp-migration` to `main`:

1. **FF1 (P1)** — rotate with source ownership: either `renameSync`-with-`ENOENT`-tolerance + retry the append loop, or use a lock file bounded to the day-file path. Add a concurrent-rotation test that spawns 2 processes against the same daily file at the cap boundary.
2. **F6 (P1)** — pass an allowlisted `env` object to `spawn()` in `runAgent()`. Keep `--dangerously-skip-permissions` per H-01 but scrub `AWS_*`, `GITHUB_TOKEN`, `*_API_KEY`, etc. unless the caller opts in.
3. **F8 (P2)** — gate task-text filtering on a known-flag allowlist, OR require `--` as explicit task delimiter.
4. **NF1 / NF2** — regenerate plugin bundles after the F6 / F8 source fixes.

Items 3–4 can be rolled into the same Phase D commit; item 1 deserves its own commit with a dedicated concurrent test.

## Files of record

- [pass-1-base-merge.md](pass-1-base-merge.md) — independent Codex attack on merge `5371e012`
- [pass-2-fix-verification.md](pass-2-fix-verification.md) — disposition matrix over Phase A/B/C
- [pass-3-final-vs-main.md](pass-3-final-vs-main.md) — composed-state review + bundle parity + ship-gate call
- Claude-panel comparator: `docs/solutions/developer-experience/xreview-multi-round-hardening-2026-05-05.md`
- Commits in scope: `5371e012`, `94ca34d`, `b0c9696`, `36861d7` on `feature/acp-migration`
