---
title: Claude Code Write tool silently drops parameters on large payloads — chunked-write workaround
date: 2026-05-05
category: docs/solutions/developer-experience
module: claude-code-write-tool
problem_type: developer_experience
component: tooling
severity: high
applies_when:
  - Writing a file with Write tool where content exceeds roughly 20 KB
  - Producing long-form documents (plans, reports, wikis) in a single Write call
  - Rewriting or regenerating a large file that already exists on disk
  - Session context is large (long conversation history preceding the write)
symptoms:
  - "Write tool emits call with empty file_path and content parameters"
  - "InputValidationError: The required parameter `file_path` is missing"
  - "InputValidationError: The required parameter `content` is missing"
  - Failure correlates with output size; smaller writes in same session succeed
  - Retrying the same large Write produces the same error deterministically
related_components:
  - documentation
  - development_workflow
tags:
  - claude-code
  - write-tool
  - chunked-writes
  - large-file-authoring
  - input-validation-error
  - plan-authoring
  - tooling-limit
---

# Claude Code Write tool silently drops parameters on large payloads — chunked-write workaround

## Context

The Claude Code `Write` tool silently drops both required parameters (`file_path` and `content`) when the payload exceeds a size threshold, causing the call to fail with:

```
InputValidationError: Write failed due to the following issues:
  The required parameter `file_path` is missing
  The required parameter `content` is missing
```

The error message is misleading — it looks like a programmer error (forgot to pass arguments), but both parameters were present in the generating model's intent. What actually happens is the serialization or context-passing layer drops the arguments entirely when `content` is too large. The threshold is not precisely documented, but session evidence places it at approximately **20 KB**; a 48 KB payload failed while multiple 10 KB payloads in the same session succeeded.

This is a recurring failure mode. The user has described it as happening "often," not occasionally. Session history (session history) shows **21+ consecutive Write calls failed across 2 prior sessions** trying to write a post-council migration plan — and each session ended without the file written because the Edit-append workaround was never attempted. Retrying the same large Write in the same session does not reliably fix it; the failure is a function of payload size, not transient network conditions.

The practical consequence is that all generated tokens for the payload are lost on failure, and the model must regenerate the content. No pre-flight size check. No warning. No partial write.

## Guidance

Use one `Write` call for the first chunk and sequential `Edit` calls for all subsequent chunks.

**When to suspect the size issue**

- The error message says both `file_path` and `content` are missing, but you clearly provided them.
- The file you are writing is larger than approximately 20 KB.
- Smaller Write calls in the same session succeeded without issue.
- You are rewriting or regenerating a file you already wrote (rewrites are the most common trigger).

**The chunked-write pattern**

1. **Divide at logical boundaries** — top-level sections (`##`), phases, chapters, numbered steps. Do not split at arbitrary byte counts; let the structure guide the cuts. ~10 KB per chunk is a side-effect of sectioning, not the goal.

2. **Write the first chunk** with explicit `file_path` and `content`. End the chunk at a complete logical boundary. Include the closing 1–2 distinctive lines of the section — these become the anchor for the next Edit.

3. **For each subsequent chunk**, use an `Edit` call:
   - `old_string`: the final 1–2 distinctive lines of the previous chunk, copied exactly.
   - `new_string`: those same lines, followed by the next section's content.
   - `replace_all: false` (the default).
   - The anchor must be unique in the file at the time of the call. Avoid `---` or blank lines.

4. **Verify the assembled file**:
   ```bash
   wc -l /path/to/file.md
   grep -n "^## " /path/to/file.md
   ```
   Confirm line count + section headers in order.

**Concrete code pattern**

First chunk via Write:

```
Write(
  file_path="/abs/path/doc.md",
  content="# Title\n\n## Section A\n\n[...content...]\n\n## Section B\n\n[...content...]\n\nClosing line of section B that is distinctive."
)
```

Subsequent chunks via Edit:

```
Edit(
  file_path="/abs/path/doc.md",
  old_string="Closing line of section B that is distinctive.",
  new_string="Closing line of section B that is distinctive.\n\n## Section C\n\n[...content...]\n\nClosing line of section C."
)
```

Note `new_string` repeats the `old_string` verbatim and appends. Each section's closing line becomes the next Edit's anchor.

## Why This Matters

- **Retrying does not help.** The same large Write will fail again. The correct response is not to retry; it is to split the payload. Session history documents 21+ failed retries before any alternative strategy was even considered.
- **The cost is high.** A failed Write wastes every token spent generating the payload. On a 48 KB file, that is hundreds of tokens of generated prose — gone with no partial save.
- **The error message actively misleads.** "Required parameter `file_path` is missing" reads like a code bug, not a size issue. Without prior knowledge of this failure mode, a model or user will waste time checking call syntax rather than addressing the root cause.
- **The pattern is common, not edge case.** Users encounter this "often" per the user's own framing (auto memory [claude]). Any workflow producing large files — migration plans, architectural documents, generated configurations, large fixtures — will hit this regularly. Chunked writes should be the default for files over 20 KB, not a fallback.
- **Chunked writes reduce blast radius.** If one Edit fails mid-sequence, previously written chunks are already on disk. A monolithic failed Write loses everything.
- **This is a cross-project concern.** The Write tool is part of the Claude Code harness, not the choreographer repo. The workaround applies to every project; this learning is promoted to global memory (`~/.claude/CLAUDE.md` or equivalent) for that reason.

## When to Apply

- Target file will be larger than approximately 20 KB.
- Content has clear logical boundaries — sections, phases, chapters — that serve as natural cut points.
- You are regenerating or rewriting a file you already have on disk (common failure case).
- A previous Write call just failed with "required parameter missing" despite the parameters being present — diagnostic signal you hit the size limit.

**Do not chunk** when:
- The file is small (under ~10 KB) and will fit comfortably.
- Content has no logical boundaries to anchor Edits against.
- The file must be written atomically (e.g., JSON config where a partial write would be invalid and could be read mid-sequence).

## Examples

### BEFORE — failure-prone

**Intent:** Write a 646-line, 48 KB migration plan in a single call.

```
Write(
  file_path="/Users/mk/.claude/plans/harmonic-noodling-pumpkin.md",
  content="# ACP Migration Plan\n\n## Context\n[2,000 words]\n\n## Phase 0\n[800 words]\n\n## Ship 1\n[1,200 words]\n\n## Ship 2\n[1,200 words]\n\n## Ship 3\n[1,000 words]\n\n## Ship 4\n[900 words]\n\n## Ship 5\n[700 words]\n\n## Closing\n[400 words]"
)
```

**Observed result:**

```
InputValidationError: Write failed due to the following issues:
  The required parameter `file_path` is missing
  The required parameter `content` is missing
```

Both parameters were present. The runtime dropped them. Entire 48 KB payload lost. Session history: this exact pattern failed 21+ times across 2 prior sessions before the Edit-append workaround was discovered. (session history)

### AFTER — chunked 5-step pattern

**Step 1** — Write the first chunk (Context + Overview + Phase 0 + Ship 1, ~10 KB):

```
Write(
  file_path="/Users/mk/Repositories/mib200/AI/choreographer/docs/plans/2026-05-05-acp-migration-plan.md",
  content="# Choreographer Migration Plan — Revised per Council Decision\n\n[...Context, Overview, Phase 0, Ship 1 sections...]\n\n- Fake-agent test harness `core/tests/helpers/fake-agents.mjs` extended to assert single-agent paths"
)
```

**Step 2** — Append Ship 2:

```
Edit(
  file_path="/Users/mk/Repositories/mib200/AI/choreographer/docs/plans/2026-05-05-acp-migration-plan.md",
  old_string="- Fake-agent test harness `core/tests/helpers/fake-agents.mjs` extended to assert single-agent paths",
  new_string="- Fake-agent test harness `core/tests/helpers/fake-agents.mjs` extended to assert single-agent paths\n\n---\n\n## Ship 2 — dual-protocol broker + per-agent adapters\n\n[...full Ship 2 section...]\n\n- `plugins/codex/scripts/session-lifecycle-hook.mjs` — session-env injection"
)
```

**Steps 3–5** — same pattern. Each `old_string` is the exact closing line of the previous chunk. Each `new_string` = `old_string` + newline + next section.

**Verification after Step 5:**

```bash
wc -l /Users/mk/Repositories/mib200/AI/choreographer/docs/plans/2026-05-05-acp-migration-plan.md
# actual: 646

grep -n "^## " /Users/mk/Repositories/mib200/AI/choreographer/docs/plans/2026-05-05-acp-migration-plan.md
# confirms 16 section headers in expected order
```

Final file: 48,526 bytes. Assembled cleanly. No data loss.

## Related

- Session where the workaround was first successfully applied: `~/.claude/projects/-Users-mk-Repositories-mib200-AI-choreographer/memory/project_session_choreographer_acp_migration_council.md`
- Plan file that exercised it: `docs/plans/2026-05-05-acp-migration-plan.md` (this repo)
- Session history: 21+ prior failed Write attempts across sessions `9363c578` and `5f7e6589` (2026-05-05) — neither session recovered because the Edit-append pattern was not tried. (session history)
