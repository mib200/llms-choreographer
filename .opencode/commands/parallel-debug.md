---
description: Parallel root-cause hypotheses from Claude and Codex for a bug symptom
---

!`"$(dirname "$0")/_helpers/run-parallel.sh" \
  "A software bug has been reported. Generate a ranked list of hypotheses for the root cause.
Focus area: application logic, state management, data flow.
Format: numbered list, most likely first, one sentence per hypothesis.

Symptom: $ARGUMENTS" \
  "A software bug has been reported. Generate a ranked list of hypotheses for the root cause.
Focus area: edge cases in input handling, type coercion, off-by-one errors.
Format: numbered list, most likely first, one sentence per hypothesis.

Symptom: $ARGUMENTS"`
