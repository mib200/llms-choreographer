#!/bin/sh
# Usage: parse-vote.sh <agent-name> <agent-output-file>
# Prints: AGENT_NAME: VOTE — rationale
# Exits 0 always.

NAME="$1"
FILE="$2"

FIRST_LINE=$(grep -m1 '[^[:space:]]' "$FILE" 2>/dev/null || echo "")
CLEAN=$(printf '%s' "$FIRST_LINE" | tr -d '*_`' | tr '[:lower:]' '[:upper:]' | sed 's/^[[:space:]]*//')

if printf '%s' "$CLEAN" | grep -qE '^YES[^A-Z]|^YES$'; then
  VOTE="YES"
  RATIONALE=$(printf '%s' "$FIRST_LINE" | sed 's/^[Yy][Ee][Ss][^a-zA-Z]*//' | sed 's/^[[:space:]]*//')
elif printf '%s' "$CLEAN" | grep -qE '^NO[^A-Z]|^NO$'; then
  VOTE="NO"
  RATIONALE=$(printf '%s' "$FIRST_LINE" | sed 's/^[Nn][Oo][^a-zA-Z]*//' | sed 's/^[[:space:]]*//')
elif printf '%s' "$CLEAN" | grep -qE '^ABSTAIN[^A-Z]|^ABSTAIN$'; then
  VOTE="ABSTAIN"
  RATIONALE=$(printf '%s' "$FIRST_LINE" | sed 's/^[Aa][Bb][Ss][Tt][Aa][Ii][Nn][^a-zA-Z]*//' | sed 's/^[[:space:]]*//')
else
  VOTE="INVALID"
  RATIONALE="$FIRST_LINE"
fi

printf '%s: %s — %s\n' "$NAME" "$VOTE" "$RATIONALE"
