---
description: Put a yes/no proposition to Claude and Codex and tally their votes
---

!`
HELPERS="$(dirname "$0")/_helpers"
PROMPT="Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.

Proposition: $ARGUMENTS"

TMPDIR_BASE=$(mktemp -d)
CLAUDE_OUT="$TMPDIR_BASE/claude.out"
CODEX_OUT="$TMPDIR_BASE/codex.out"

PLUGIN_ARGS=$(sh "$HELPERS/claude-print-args.sh" 2>/dev/null || true)
claude --print $PLUGIN_ARGS "$PROMPT" --dangerously-skip-permissions > "$CLAUDE_OUT" 2>&1 &
CLAUDE_PID=$!
codex exec "$PROMPT" > "$CODEX_OUT" 2>&1 &
CODEX_PID=$!
wait $CLAUDE_PID; wait $CODEX_PID

CLAUDE_RESULT=$("$HELPERS/parse-vote.sh" claude "$CLAUDE_OUT")
CODEX_RESULT=$("$HELPERS/parse-vote.sh" codex "$CODEX_OUT")

YES_COUNT=$(printf '%s\n%s\n' "$CLAUDE_RESULT" "$CODEX_RESULT" | grep -c ': YES')
NO_COUNT=$(printf '%s\n%s\n' "$CLAUDE_RESULT" "$CODEX_RESULT" | grep -c ': NO')
ABSTAIN_COUNT=$(printf '%s\n%s\n' "$CLAUDE_RESULT" "$CODEX_RESULT" | grep -c ': ABSTAIN')

printf "## Vote Tally\n\n| Vote | Count |\n|------|-------|\n| YES  | %d |\n| NO   | %d |\n| ABSTAIN | %d |\n\n## Per-Agent Rationale\n\n%s\n%s\n" \
  "$YES_COUNT" "$NO_COUNT" "$ABSTAIN_COUNT" "$CLAUDE_RESULT" "$CODEX_RESULT"

rm -rf "$TMPDIR_BASE"
`
