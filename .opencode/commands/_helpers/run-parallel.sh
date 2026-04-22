#!/bin/sh
# Usage: run-parallel.sh "<claude-prompt>" "<codex-prompt>"
# Runs both CLIs in parallel, waits, prints delimited output.
# Writes agent output to temp files so parallel execution doesn't interleave.

CLAUDE_PROMPT="$1"
CODEX_PROMPT="$2"
SEP="════════════════════════════════════════════════════════════"

TMPDIR_BASE=$(mktemp -d)
CLAUDE_OUT="$TMPDIR_BASE/claude.out"
CODEX_OUT="$TMPDIR_BASE/codex.out"

claude --print "$CLAUDE_PROMPT" --dangerously-skip-permissions > "$CLAUDE_OUT" 2>&1 &
CLAUDE_PID=$!
codex exec "$CODEX_PROMPT" > "$CODEX_OUT" 2>&1 &
CODEX_PID=$!

wait $CLAUDE_PID
CLAUDE_EXIT=$?
wait $CODEX_PID
CODEX_EXIT=$?

printf "%s\nAGENT: CLAUDE\n%s\n" "$SEP" "$SEP"
if [ $CLAUDE_EXIT -eq 0 ]; then
  cat "$CLAUDE_OUT"
else
  printf "[error: claude exited %d]\n" "$CLAUDE_EXIT"
  cat "$CLAUDE_OUT"
fi

printf "\n\n%s\nAGENT: CODEX\n%s\n" "$SEP" "$SEP"
if [ $CODEX_EXIT -eq 0 ]; then
  cat "$CODEX_OUT"
else
  printf "[error: codex exited %d]\n" "$CODEX_EXIT"
  cat "$CODEX_OUT"
fi

printf "\n%s\n" "$SEP"

rm -rf "$TMPDIR_BASE"
