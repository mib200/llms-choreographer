#!/bin/sh
# Print --plugin-dir args for all installed @llms-choreographer plugins.
# Reads ~/.claude/plugins/installed_plugins.json.
# Exits 0 with no output if registry missing — caller gets a clear claude error.
REGISTRY="$HOME/.claude/plugins/installed_plugins.json"
[ -f "$REGISTRY" ] || exit 0

if command -v jq >/dev/null 2>&1; then
  jq -r '
    .plugins
    | to_entries[]
    | select(.key | endswith("@llms-choreographer"))
    | .value[] | .installPath // empty
  ' "$REGISTRY" 2>/dev/null | while IFS= read -r path; do
    [ -n "$path" ] && printf -- '--plugin-dir %s ' "$path"
  done
else
  awk '
    /"[^"]+@llms-choreographer"[[:space:]]*:/ { in_scope = 1; next }
    /^[[:space:]]*"[^"]+@[^"]+"[[:space:]]*:/ { in_scope = 0 }
    in_scope && /"installPath"/ {
      gsub(/.*"installPath"[[:space:]]*:[[:space:]]*"/, "")
      gsub(/".*/, "")
      if (length($0) > 0) printf "--plugin-dir %s ", $0
    }
  ' "$REGISTRY"
fi
