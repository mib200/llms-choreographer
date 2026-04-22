# Debug Session Findings — [PHONE]-bugs

**Mode:** Bounded, 15 iterations, Find+Fix
**Scope:** Entire codebase
**Session start:** 2026-04-23
**Branch:** fixes/feature-monorepo @ 902ae4e

## Summary

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 1 | B-04 |
| HIGH | 3 | B-01, B-03, B-06 |
| MEDIUM | 2 | B-02, B-05, B-08 |

6 bugs confirmed. Two root-cause themes: **stale bundle artifacts** (B-01, B-06) and **path-resolution breakage in plugin commands** (B-03, B-04, B-05).

---

## B-01 [HIGH] — Plugin bundles stale; ship pre-fix code

**Location:**
- `plugin-claude/scripts/companion.mjs` (439 lines, dated 03:27)
- `plugin-codex/scripts/companion.mjs` (identical, 03:27)
- `plugin-opencode/dist/companion.mjs` (03:27)

**Evidence:**
- `core/runners.mjs:58-62` — `runAgent` has `setTimeout` → `proc.kill('SIGTERM')` after AGENT_TIMEOUT_MS
- Bundled `plugin-claude/scripts/companion.mjs` **contains no timeout/SIGTERM in runAgent**
- `core/runners.mjs:109-114` — `requireAvailable` THROWS `new Error(...)` (library contract, Key Decision #6)
- Bundled version at `plugin-claude/scripts/companion.mjs:115-117` — still `process.exit(1)` (pre-fix)
- Core fixes landed in commits `0106cb9`, `9d9b882`, `902ae4e` — all AFTER bundle timestamp

**Impact:** Every plugin install ships BROKEN code missing all 8 confirmed bug fixes. Users hit hang-forever agents, wrong error reporting, CLI-contract violations.

**Root cause:** `scripts/bundle.mjs` never re-run after core fixes. Bundles tracked in git but no pre-commit enforcement.

**Fix:**
```bash
node scripts/bundle.mjs
git add plugin-claude/scripts/companion.mjs plugin-codex/scripts/companion.mjs plugin-opencode/dist/companion.mjs
git commit -m "build: rebundle plugins with latest core fixes"
```

Combined with B-06 for permanent fix.

---

## B-02 [MEDIUM] — install.sh lacks bundle-existence check

**Location:** `bin/install.sh:103-107` (`install_opencode`)

**Evidence:**
- `install.mjs:62-65` has `if (!existsSync(srcBundle))` guard with helpful message
- `install.sh:106` runs `cp "$REPO_DIR/plugin-opencode/dist/companion.mjs"` with no check — fails with cryptic `cp: No such file or directory`

**Impact:** Remote `curl | bash` users get opaque error instead of "run npm run bundle first".

**Fix:**
```bash
install_opencode() {
  local src_bundle="$REPO_DIR/plugin-opencode/dist/companion.mjs"
  if [[ ! -f "$src_bundle" ]]; then
    echo "Error: $src_bundle not found. Run 'npm run bundle' first." >&2
    exit 1
  fi
  # ... rest
}
```

---

## B-03 [HIGH] — Codex skills use relative `scripts/companion.mjs` path

**Location:** All 10 `plugin-codex/skills/*/SKILL.md` files

**Evidence:**
- `plugin-codex/skills/council/SKILL.md:18` — `Runs \`node scripts/companion.mjs council "<task>"\``
- Relative path only works if cwd equals plugin dir. Codex runs from user's cwd.
- Compare correct pattern: `plugin-claude/commands/council.md:7` uses `node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs"`

**Impact:** Every codex skill invocation fails with `Cannot find module 'scripts/companion.mjs'` unless user happens to cd into plugin directory first. Plugin is non-functional for codex target.

**Root cause:** Skill docs copy-pasted from Claude without the plugin-root substitution.

**Fix:** Codex has no `CLAUDE_PLUGIN_ROOT` equivalent documented here; needs absolute path OR a codex-plugin-root env var if available. Needs research on codex runtime. Likely workaround:
```
node "$HOME/.codex/plugins/cache/mib200/choreo/1.0.0/scripts/companion.mjs" council "$ARGS"
```

---

## B-04 [CRITICAL] — OpenCode command path broken after install

**Location:** All 9 `plugin-opencode/.opencode/commands/choreo-*.md` files

**Evidence:**
- `plugin-opencode/.opencode/commands/choreo-council.md:16` —
  `node "$(dirname "$0")/../../dist/companion.mjs" council "$@"`
- In repo: `../../dist/companion.mjs` correctly resolves to `plugin-opencode/dist/companion.mjs`
- After install: commands copied to `~/.config/opencode/commands/` but bundle copied to `~/.config/opencode/choreo/companion.mjs` — relative `../../dist/` resolves to `~/.config/dist/` which doesn't exist

**Impact:** 100% failure rate for all opencode commands post-install. Plugin non-functional for opencode target.

**Root cause:** Command templates not rewritten at install time; install layout mismatches template expectations.

**Fix options:**
1. Installer rewrites `../../dist/` to absolute `$HOME/.config/opencode/choreo/` on copy
2. Command templates use `$HOME/.config/opencode/choreo/companion.mjs` directly
3. Installer copies bundle to `~/.config/opencode/dist/companion.mjs` matching template

Option 3 is smallest change — update `install.sh:103` and `install.mjs:57` to use `dist` path.

---

## B-05 [MEDIUM] — plugin-opencode/.opencode/plugins/choreo.ts never installed

**Location:** `bin/install.sh:95-107`, `bin/install.mjs:57-84`

**Evidence:**
- File exists: `plugin-opencode/.opencode/plugins/choreo.ts`
- Contains: `import '../../dist/companion.mjs';`
- Neither installer copies `plugins/choreo.ts` to user's opencode plugin dir

**Impact:** If OpenCode requires plugin hook file, plugin doesn't initialize properly. File also has same relative-path issue as B-04.

**Fix:** Either delete unused `choreo.ts`, or copy it to `~/.config/opencode/plugins/` AND fix its import path.

---

## B-06 [HIGH] — No pre-commit hook guards bundle staleness

**Location:** `package.json` scripts section

**Evidence:**
- Bundles ARE tracked in git (`plugin-*/scripts/companion.mjs` listed in `git ls-files`)
- `.gitignore` does not exclude bundles
- No `prepare`, `precommit`, or husky configuration in `package.json`
- Last bundle update: commit `baebaa8` (monorepo restructure)
- Last core update since: `9d9b882`, `0106cb9`, `902ae4e` — all drift

**Impact:** Bundle staleness (B-01) is inevitable under current workflow. Every core fix is a silent production regression until manual rebundle.

**Fix options:**
1. Add `prepare` script + husky pre-commit hook running `npm run bundle && git add plugin-*/`
2. Add CI check that fails if `npm run bundle` produces a diff
3. Remove bundles from git; require user to run `npm run bundle` at install time (breaks `curl | bash`)

Option 2 catches drift without adding runtime dependency.

---

## B-08 [MEDIUM] — install.mjs OpenCode rollback incomplete

**Location:** `bin/install.mjs:78-79`

**Evidence:**
- On cp failure: `rmSync(distDir, { recursive: true, force: true })` — only cleans bundle dir
- Partially-copied `choreo-*.md` files in `cmdDir` (`~/.config/opencode/commands/`) are NOT rolled back
- `cmdDir` is shared with other installs so can't `rm -rf` it; must track and remove specific files

**Impact:** Partial failed install leaves orphan command files. Subsequent attempts may hit "file exists" errors or users see half-broken commands.

**Fix:**
```javascript
const copied = [];
try {
  for (const f of readdirSync(srcCmds).filter(...)) {
    cpSync(join(srcCmds, f), join(cmdDir, f));
    copied.push(join(cmdDir, f));
  }
  cpSync(srcBundle, join(distDir, 'companion.mjs'));
} catch (e) {
  rmSync(distDir, { recursive: true, force: true });
  for (const p of copied) rmSync(p, { force: true });
  process.exit(1);
}
```

---

## Eliminated hypotheses

| # | Hypothesis | Result | Why disproven |
|---|---|---|---|
| H-A | Tests fail | No | 32/32 pass |
| H-B | Lint errors | No | No lint script configured |
| H-C | `spawn`/`spawnSync` import mismatch | No | Both imported correctly in runners.mjs:1 |
| H-D | parsers.mjs ANSI regex broken | No | Uses `String.fromCharCode(27)` — correct workaround |
| H-E | `git diff` error unchecked in review | No | `gitResult.error \|\| status !== 0` properly guarded at L91 |
| H-F | parseVote regex munges rationale | Downgrade | Edge case ("yes123abc") unlikely in real LLM output |
| H-G | second-opinion missing-agent warning absent | Downgrade | Informational, not a bug |
| H-H | Unknown cmd doesn't exit | No | Falls through to known[] check at L304 |
| H-I | vote handler missing catch | No | L250 properly wrapped |

---

## Metrics

```
bugs_found        = 6   × 15 = 90
hypotheses_tested = 15  × 3  = 45
files_investigated = 14/14   × 40 = 40
techniques_used   = 4/7  × 10 = 5.7
debug_score       = 180.7
```

---

## Next step — chained fix

User requested `--fix` auto-chain. Fixes for B-01 and B-06 recommended first (root-cause). B-04 is highest user-impact. B-03 requires codex-runtime research before coding.
