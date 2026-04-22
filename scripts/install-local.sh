#!/usr/bin/env bash
# Local install: symlink repo artifacts into each CLI's global config dir.
# Idempotent — safe to run multiple times. Uninstall via scripts/uninstall-local.sh.
#
# Usage:
#   scripts/install-local.sh [claude|codex|opencode|all]
#   (default: all)
#
# Targets:
#   Claude Code  → `claude plugin marketplace add` + `claude plugin install`
#   Codex        → symlink for-codex/<name>/ → ~/.codex/skills/<name>/
#   OpenCode     → symlink .opencode/commands/*.md → ~/.config/opencode/commands/*.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

log()  { printf '\033[1;34m▶\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

install_claude() {
  log "Claude Code: registering marketplace + installing plugins"
  if ! command -v claude >/dev/null 2>&1; then
    warn "claude CLI not found on PATH — skipping"
    return 0
  fi

  claude plugin marketplace add "$REPO_ROOT" 2>&1 | sed 's/^/    /' || true
  for plugin in claude codex opencode llms-choreographer; do
    claude plugin install "${plugin}@llms-choreographer" 2>&1 | sed 's/^/    /' || \
      warn "  install failed: ${plugin}"
  done
  ok "Claude Code plugins installed — run '/plugin' in a Claude session to verify"
}

install_codex() {
  log "Codex: symlinking skills to ~/.codex/skills/"
  mkdir -p "$HOME/.codex/skills"
  for skill_dir in "$REPO_ROOT"/for-codex/*/; do
    local name
    name="$(basename "$skill_dir")"
    local target="$HOME/.codex/skills/$name"
    if [[ -L "$target" || -e "$target" ]]; then
      rm -f "$target"
    fi
    ln -s "$skill_dir" "$target"
    printf '    ~/.codex/skills/%s → %s\n' "$name" "$skill_dir"
  done
  # Link shared helper dir (_shared) so skills can access claude-print-args.sh
  local shared_src="$REPO_ROOT/for-codex/_shared"
  local shared_dst="$HOME/.codex/skills/_shared"
  if [[ -d "$shared_src" ]]; then
    if [[ -L "$shared_dst" || -e "$shared_dst" ]]; then
      rm -rf "$shared_dst"
    fi
    ln -s "$shared_src" "$shared_dst"
    printf '    ~/.codex/skills/_shared → %s\n' "$shared_src"
  fi
  ok "Codex skills linked — launch 'codex' from any dir to use them"
}

install_opencode() {
  log "OpenCode: symlinking commands to ~/.config/opencode/commands/"
  mkdir -p "$HOME/.config/opencode/commands"
  for cmd_file in "$REPO_ROOT"/.opencode/commands/*.md; do
    local name
    name="$(basename "$cmd_file")"
    local target="$HOME/.config/opencode/commands/$name"
    if [[ -L "$target" || -e "$target" ]]; then
      rm -f "$target"
    fi
    ln -s "$cmd_file" "$target"
    printf '    ~/.config/opencode/commands/%s\n' "$name"
  done
  # Link the shared helpers dir too (run-parallel.sh, parse-vote.sh)
  local helpers_src="$REPO_ROOT/.opencode/commands/_helpers"
  local helpers_dst="$HOME/.config/opencode/commands/_helpers"
  if [[ -d "$helpers_src" ]]; then
    if [[ -L "$helpers_dst" || -e "$helpers_dst" ]]; then
      rm -rf "$helpers_dst"
    fi
    ln -s "$helpers_src" "$helpers_dst"
    printf '    ~/.config/opencode/commands/_helpers → %s\n' "$helpers_src"
  fi
  ok "OpenCode commands linked — launch 'opencode' from any dir to use them"
}

case "$TARGET" in
  claude)   install_claude   ;;
  codex)    install_codex    ;;
  opencode) install_opencode ;;
  all)      install_claude; install_codex; install_opencode ;;
  *)        err "unknown target: $TARGET (expected: claude|codex|opencode|all)"; exit 1 ;;
esac

ok "Done."
