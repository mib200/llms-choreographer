#!/usr/bin/env node
// Usage:
//   npx @mib200/choreographer-monorepo install --target=all
//   node bin/install.mjs --target=claude
//   node bin/install.mjs --target=codex
//   node bin/install.mjs --target=opencode

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(__dirname, '..');

const MARKETPLACE_NAME = 'mib200';
const PLUGIN_NAME = 'choreo';
const PLUGIN_VERSION = '1.0.0';

// ── parse args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let target = '';

for (const arg of args) {
  if (arg.startsWith('--target=')) target = arg.slice('--target='.length);
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: install.mjs --target=claude|codex|opencode|all');
    process.exit(0);
  }
}

if (!target) {
  console.error('Error: --target is required. Use --target=claude|codex|opencode|all');
  process.exit(1);
}

// ── install helpers ───────────────────────────────────────────────────────────

function installClaude() {
  const dest = join(homedir(), '.claude', 'plugins', 'cache', MARKETPLACE_NAME, PLUGIN_NAME, PLUGIN_VERSION);
  console.log(`Installing Claude plugin → ${dest}`);
  mkdirSync(dest, { recursive: true });
  cpSync(join(REPO_DIR, 'plugin-claude'), dest, { recursive: true });
  console.log(`✓ Claude plugin installed. Restart Claude Code and run: /plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
}

function installCodex() {
  const dest = join(homedir(), '.codex', 'plugins', 'cache', MARKETPLACE_NAME, PLUGIN_NAME, PLUGIN_VERSION);
  console.log(`Installing Codex plugin → ${dest}`);
  mkdirSync(dest, { recursive: true });
  cpSync(join(REPO_DIR, 'plugin-codex'), dest, { recursive: true });
  console.log('✓ Codex plugin installed. Restart Codex — skills will appear automatically.');
}

function installOpenCode() {
  const cmdDir = join(homedir(), '.config', 'opencode', 'commands');
  const distDir = join(homedir(), '.config', 'opencode', 'choreo');
  const srcCmds = join(REPO_DIR, 'plugin-opencode', '.opencode', 'commands');
  const srcBundle = join(REPO_DIR, 'plugin-opencode', 'dist', 'companion.mjs');
  const installedBundle = join(distDir, 'companion.mjs');

  if (!existsSync(srcBundle)) {
    console.error(`✗ dist/companion.mjs not found. Run "npm run bundle" before installing.`);
    process.exit(1);
  }

  console.log(`Installing OpenCode commands → ${cmdDir}`);
  mkdirSync(cmdDir, { recursive: true });
  mkdirSync(distDir, { recursive: true });

  const copied = [];
  try {
    for (const f of readdirSync(srcCmds).filter(n => n.startsWith('choreo-') && n.endsWith('.md'))) {
      const src = join(srcCmds, f);
      const dst = join(cmdDir, f);
      // B-04: Rewrite relative bundle path to absolute install path
      const body = readFileSync(src, 'utf8')
        .replace(/\$\(dirname\s+"\$0"\)\/\.\.\/\.\.\/dist\/companion\.mjs/g, installedBundle);
      writeFileSync(dst, body);
      copied.push(dst);
    }
    cpSync(srcBundle, installedBundle);
    copied.push(installedBundle);
  } catch (e) {
    console.error(`✗ OpenCode install failed: ${e.message}`);
    console.error(`  Cleaning up partial install...`);
    // B-08: Remove each file we copied; don't rm shared cmdDir
    for (const p of copied) { try { rmSync(p, { force: true }); } catch {} }
    rmSync(distDir, { recursive: true, force: true });
    process.exit(1);
  }

  console.log('✓ OpenCode commands installed. Restart OpenCode — /choreo-* commands will appear.');
}

// ── run ───────────────────────────────────────────────────────────────────────

switch (target) {
  case 'claude':   installClaude(); break;
  case 'codex':    installCodex(); break;
  case 'opencode': installOpenCode(); break;
  case 'all':      installClaude(); installCodex(); installOpenCode(); break;
  default:
    console.error(`Unknown target: ${target}. Use claude|codex|opencode|all`);
    process.exit(1);
}

console.log('\nDone.');
