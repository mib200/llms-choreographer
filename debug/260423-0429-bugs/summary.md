# Debug Summary — [PHONE]-bugs

**Ran:** 15 iterations (bounded)
**Result:** 6 confirmed bugs, 9 eliminated hypotheses

## Severity breakdown

| ID | Severity | Title | Root fix |
|---|---|---|---|
| B-04 | CRITICAL | OpenCode command path broken after install | Installer path rewrite |
| B-01 | HIGH | Plugin bundles stale — pre-fix code shipped | `npm run bundle` + commit |
| B-03 | HIGH | Codex skills use relative `scripts/companion.mjs` | Absolute path in skills |
| B-06 | HIGH | No pre-commit hook for bundle drift | Add CI/husky bundle check |
| B-02 | MEDIUM | install.sh lacks bundle-existence check | Add `[[ -f ]]` guard |
| B-05 | MEDIUM | plugin-opencode choreo.ts never installed | Delete or copy+fix path |
| B-08 | MEDIUM | install.mjs rollback incomplete for cmd files | Track copied files |

## Recommended fix order

1. **B-01 + B-06** — rebundle + add drift guard (root cause)
2. **B-04** — fix opencode install layout (CRITICAL user impact)
3. **B-05** — delete unused choreo.ts OR install it properly
4. **B-02, B-08** — installer hardening
5. **B-03** — requires codex-runtime research before patching

## Themes

- **Monorepo restructure aftermath** — bundle drift, path breakage, incomplete installer updates. Symptoms of rushed chunk 10.
- **No CI validation** — no automated check that bundles match core source, installers actually work, commands resolve their targets.
