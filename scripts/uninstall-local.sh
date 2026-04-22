#!/usr/bin/env bash
# Local uninstall: reverse install-local.sh. Removes symlinks and uninstalls Claude plugins.
# Safe to run even if nothing was installed. Non-destructive to unrelated files.
#
# Usage:
#   scripts/uninstall-local.sh [claude|codex|opencode|all]
#   (default: all)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

log()  { printf '\033[1;34m▶\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

uninstall_claude() {
  log "Claude Code: uninstalling plugins + removing marketplace"
  if ! command -v claude >/dev/null 2>&1; then
    warn "claude CLI not found on PATH — skipping"
    return 0
  fi

  for plugin in claude codex opencode llms-choreographer; do
    claude plugin uninstall "${plugin}@llms-choreographer" 2>&1 | sed 's/^/    /' || true
  done
  claude plugin marketplace remove llms-choreographer 2>&1 | sed 's/^/    /' || true
  ok "Claude Code plugins removed"
}

uninstall_codex() {
  log "Codex: removing skill symlinks from ~/.codex/skills/"
  for skill_dir in "$REPO_ROOT"/for-codex/*/; do
    local name
    name="$(basename "$skill_dir")"
    local target="$HOME/.codex/skills/$name"
    # Only remove if it's a symlink pointing into this repo
    if [[ -L "$target" ]]; then
      local link_target
      link_target="$(readlink "$target")"
      if [[ "$link_target" == "$REPO_ROOT"/* ]]; then
        rm -f "$target"
        printf '    removed: ~/.codex/skills/%s\n' "$name"
      else
        warn "  skipped (not our symlink): ~/.codex/skills/$name"
      fi
    fi
  done
  ok "Codex skill symlinks removed"
}

uninstall_opencode() {
  log "OpenCode: removing command symlinks from ~/.config/opencode/commands/"
  for cmd_file in "$REPO_ROOT"/.opencode/commands/*.md; do
    local name
    name="$(basename "$cmd_file")"
    local target="$HOME/.config/opencode/commands/$name"
    if [[ -L "$target" ]]; then
      local link_target
      link_target="$(readlink "$target")"
      if [[ "$link_target" == "$REPO_ROOT"/* ]]; then
        rm -f "$target"
        printf '    removed: ~/.config/opencode/commands/%s\n' "$name"
      else
        warn "  skipped (not our symlink): ~/.config/opencode/commands/$name"
      fi
    fi
  done
  # Helpers dir
  local helpers_dst="$HOME/.config/opencode/commands/_helpers"
  if [[ -L "$helpers_dst" ]]; then
    local link_target
    link_target="$(readlink "$helpers_dst")"
    if [[ "$link_target" == "$REPO_ROOT"/* ]]; then
      rm -f "$helpers_dst"
      printf '    removed: ~/.config/opencode/commands/_helpers\n'
    fi
  fi
  ok "OpenCode command symlinks removed"
}

case "$TARGET" in
  claude)   uninstall_claude   ;;
  codex)    uninstall_codex    ;;
  opencode) uninstall_opencode ;;
  all)      uninstall_claude; uninstall_codex; uninstall_opencode ;;
  *)        err "unknown target: $TARGET (expected: claude|codex|opencode|all)"; exit 1 ;;
esac

ok "Done."
