# Deployment Guide — Choreographer

> See also: [System Architecture](./system-architecture.md) · [Codebase Summary](./codebase-summary.md) · [Delegation Reference](./delegation.md)

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 22 | ESM + `node:test` built-in required |
| npm | any | Only needed for `npm install` / `npm run bundle` |
| esbuild | ^0.28.0 | devDependency — installed via `npm install` |

At least one of the target AI CLI runtimes must be installed:

| Runtime | Install |
|---------|---------|
| Claude Code | `npm install -g @anthropic-ai/claude-code` |
| Codex | `npm install -g @openai/codex` |
| OpenCode | see opencode.ai |

---

## Step 1 — Clone and Install Dev Dependencies

```bash
git clone <repo-url> choreographer
cd choreographer
npm install       # installs esbuild devDependency
```

---

## Step 2 — Build the Bundles

The bundled `companion.mjs` outputs are **committed to git** and should already be present. Rebuild only if you have modified `core/` source.

```bash
npm run bundle
# equivalent: node scripts/bundle.mjs
```

This runs esbuild with:
- `format: 'esm'`
- `platform: 'node'`
- `target: 'node22'`
- `bundle: true`
- `external: ['node:*']`

Outputs:

| Entry point | Bundle output |
|-------------|---------------|
| `plugin-claude/src/entry.mjs` | `plugin-claude/scripts/companion.mjs` |
| `plugin-codex/src/entry.mjs` | `plugin-codex/scripts/companion.mjs` |
| `plugin-opencode/src/entry.mjs` | `plugin-opencode/dist/companion.mjs` |

Each output is ~439 lines, self-contained, no runtime npm dependencies.

---

## Step 3 — Install Plugins

### Option A — Node installer (recommended)

```bash
# Install for all three runtimes
node bin/install.mjs --target=all

# Install for a single runtime
node bin/install.mjs --target=claude
node bin/install.mjs --target=codex
node bin/install.mjs --target=opencode
```

### Option B — Bash installer

```bash
bash bin/install.sh --target=all
```

### Option C — npx (when published)

```bash
npx @mib200/choreographer-monorepo install --target=all
```

---

## Install Paths by Runtime

### Claude Code

```
~/.claude/plugins/cache/mib200/choreo/1.0.0/
```

The installer copies the entire `plugin-claude/` directory here via `cpSync`.

After install:
1. Restart Claude Code.
2. Run `/plugin install choreo@mib200` to activate.

Commands become available as `/choreo:*`.

### Codex

```
~/.codex/plugins/cache/mib200/choreo/1.0.0/
```

The installer copies the entire `plugin-codex/` directory here.

After install:
1. Restart Codex.
2. Skills appear automatically — no activation command needed.

Skills are available as `choreo-*` (e.g. `choreo-council`).

### OpenCode

Two locations:

```
~/.config/opencode/commands/choreo-*.md   ← 8 command files
~/.config/opencode/choreo/companion.mjs   ← bundled binary
```

The installer:
1. Copies all `choreo-*.md` files from `plugin-opencode/.opencode/commands/`.
2. Copies `plugin-opencode/dist/companion.mjs` to `~/.config/opencode/choreo/companion.mjs`.

After install:
1. Restart OpenCode.
2. Commands available as `/choreo-*` (e.g. `/choreo-council`).

---

## Marketplace Setup

### Claude Code Marketplace

File: `.claude-plugin/marketplace.json`

```json
{
  "name": "mib200",
  "plugins": [{ "name": "choreo", "path": "./plugin-claude" }]
}
```

The marketplace name `mib200` is the scope used in `/plugin install choreo@mib200`.

### Codex Marketplace

File: `.agents/plugins/marketplace.json`

```json
{
  "name": "mib200",
  "plugins": [{ "name": "choreo", "path": "./plugin-codex" }]
}
```

Both marketplace files are scoped to the local repo — no remote registry is configured.

---

## Verify Install

```bash
# Check all three runtimes are reachable
node core/companion.mjs check-all

# Expected output (if all installed):
# ✓ claude: <version>
# ✓ codex: <version>
# ✓ opencode: <version>
```

If a runtime is missing:
```
✗ claude not installed. Run /choreo:claude
```

---

## Rebuild After Core Changes

If you modify any file in `core/`:

```bash
npm run bundle   # rebuild all 3 companion.mjs outputs
npm test         # confirm 32 tests pass
node bin/install.mjs --target=all   # re-install updated bundles
```

The bundled outputs must be re-installed manually — there is no hot-reload.

---

## OpenCode npm Package (Not Yet Published)

`plugin-opencode/` has a `package.json` with name `@mib200/choreo-opencode`. The package structure is complete but has not been published to the npm registry. When published, the install flow would be:

```bash
npm install -g @mib200/choreo-opencode
```

Until then, use `bin/install.mjs --target=opencode`.

---

## No Remote Git

No git remote is configured. The repo is local-only. To share with other machines, copy the repo directory or set up a remote manually:

```bash
git remote add origin <url>
git push -u origin main
```
