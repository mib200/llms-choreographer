#!/usr/bin/env bash
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/mib200/choreographer/main/bin/install.sh) --target=all
#   bash <(curl -fsSL ...) --target=claude
#   bash <(curl -fsSL ...) --target=codex
#   bash <(curl -fsSL ...) --target=opencode
#
# Local install (from a cloned repo):
#   ./bin/install.sh --target=all --local

set -euo pipefail

REPO_URL="https://github.com/mib200/choreographer"
PLUGIN_VERSION="1.0.0"
MARKETPLACE_NAME="mib200"
PLUGIN_NAME="choreo"

TARGET=""
LOCAL=false
REPO_DIR=""

# ── parse args ────────────────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --target=*) TARGET="${arg#--target=}" ;;
    --local)    LOCAL=true ;;
    --repo=*)   REPO_DIR="${arg#--repo=}" ;;
    --help|-h)
      echo "Usage: install.sh --target=claude|codex|opencode|all [--local] [--repo=<path>]"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Error: --target is required. Use --target=claude|codex|opencode|all" >&2
  exit 1
fi

# ── resolve repo ──────────────────────────────────────────────────────────────

TMPDIR_CREATED=false

if [[ "$LOCAL" == "true" ]]; then
  if [[ -z "$REPO_DIR" ]]; then
    # Assume script lives in bin/ inside the repo
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
  fi
  echo "Using local repo: $REPO_DIR"
else
  # Download tarball
  TMPDIR="$(mktemp -d)"
  TMPDIR_CREATED=true
  trap 'rm -rf "$TMPDIR"' EXIT

  echo "Downloading choreographer from GitHub..."
  if command -v curl &>/dev/null; then
    curl -fsSL "$REPO_URL/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMPDIR" --strip-components=1
  elif command -v wget &>/dev/null; then
    wget -qO- "$REPO_URL/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMPDIR" --strip-components=1
  else
    echo "Error: curl or wget required" >&2
    exit 1
  fi
  REPO_DIR="$TMPDIR"
fi

# ── install helpers ───────────────────────────────────────────────────────────

install_claude() {
  local dest="$HOME/.claude/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$PLUGIN_VERSION"
  echo "Installing Claude plugin → $dest"
  mkdir -p "$dest"
  cp -r "$REPO_DIR/plugin-claude/." "$dest/"
  echo "✓ Claude plugin installed. Restart Claude Code and run: /plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}"
}

install_codex() {
  local dest="$HOME/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$PLUGIN_VERSION"
  echo "Installing Codex plugin → $dest"
  mkdir -p "$dest"
  cp -r "$REPO_DIR/plugin-codex/." "$dest/"
  echo "✓ Codex plugin installed. Restart Codex — skills will appear automatically."
}

install_opencode() {
  local cmd_dir="$HOME/.config/opencode/commands"
  echo "Installing OpenCode commands → $cmd_dir"
  mkdir -p "$cmd_dir"
  for f in "$REPO_DIR/plugin-opencode/.opencode/commands"/choreo-*.md; do
    cp "$f" "$cmd_dir/"
  done
  # Copy bundled companion so commands can resolve it
  local dist_dir="$HOME/.config/opencode/choreo"
  mkdir -p "$dist_dir"
  cp "$REPO_DIR/plugin-opencode/dist/companion.mjs" "$dist_dir/companion.mjs"
  echo "✓ OpenCode commands installed. Restart OpenCode — /choreo-* commands will appear."
}

# ── run ───────────────────────────────────────────────────────────────────────

case "$TARGET" in
  claude)   install_claude ;;
  codex)    install_codex ;;
  opencode) install_opencode ;;
  all)      install_claude; install_codex; install_opencode ;;
  *)
    echo "Unknown target: $TARGET. Use claude|codex|opencode|all" >&2
    exit 1
    ;;
esac

echo ""
echo "Done. Run 'npm test' in the repo to verify core tests pass."
