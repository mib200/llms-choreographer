# Findings — 260423-quality

## Finding 1: --dangerously-skip-permissions passed universally to all agent invocations

**Severity:** CRITICAL
**Confidence:** HIGH
**Location:** `core/companion.mjs:53,62,69,140,145`
**Consensus:** 5/5 personas (SA-1, DA-2, AR+PE+RE confirm)
**Priority Score:** 2.20

**Evidence:**
Every claude and opencode invocation across all commands (council, review, debug, second-opinion, vote) appends `'--dangerously-skip-permissions'` unconditionally. This suppresses all permission confirmation UI. Combined with user-controlled input injected into prompts (Finding 3), a prompt injection attack gives the spawned agent full filesystem and network access with no interrupt.

**Recommendation:**
Remove `--dangerously-skip-permissions` from non-destructive commands (vote, council, debug). For review, use `--allowedTools read` or equivalent. At minimum, document that this flag disables all safety checks.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Required for non-interactive but no per-command opt-out |
| Security Analyst | ✓ | Maintains CRITICAL — one prompt injection = full shell access |
| Performance Engineer | ✓ | Confirms presence in all code paths |
| Reliability Engineer | ✓ | Confirms universal application |
| Devil's Advocate | ✓ | Concedes — required for operation, but no escape hatch |

---

## Finding 2: vote tally silently accepts all-INVALID results as valid output

**Severity:** CRITICAL
**Confidence:** HIGH
**Location:** `core/companion.mjs:244-260`
**Consensus:** 5/5 personas (RE-4, DA-4, PE-6, AR, SA)
**Priority Score:** 2.20

**Evidence:**
```js
const tally = { yes: 0, no: 0, abstain: 0, invalid: 0 };
results.map(r => {
  const { vote, rationale } = parseVote(r.output);
  tally[vote.toLowerCase()]++;  // 'invalid' incremented silently
  ...
});
// table printed unconditionally — no quorum check, no exit(1)
```
If all agents fail or return gibberish, tally = `{yes:0, no:0, abstain:0, invalid:3}`. Output looks like a valid tally with zero consensus. No non-zero exit code. JSON path also emits a structurally valid but semantically meaningless result.

**Recommendation:**
After tallying, check `if (tally.invalid === parsed.length)` — emit error and `process.exit(1)`. In JSON mode, include `"error": "all votes invalid"`. At minimum, set non-zero exit code when `tally.invalid > 0`.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Correctness contract violation |
| Security Analyst | ✓ | Could be exploited to force false consensus |
| Performance Engineer | ✓ | Confirms silent pass on partial results |
| Reliability Engineer | ✓ | Upgraded to CRITICAL — callers cannot trust return value |
| Devil's Advocate | ✓ | No dispute — clear correctness bug |

---

## Finding 3: git diff injected into LLM prompt — LLM prompt injection + maxBuffer overflow

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `core/companion.mjs:84-98`
**Consensus:** 5/5 personas (SA-3, DA-1, PE-3, DA-7, AR)
**Priority Score:** 1.80

**Evidence:**
`spawnSync('git', ['diff', 'HEAD'], { encoding: 'utf8' })` captures full diff (no `maxBuffer` — default 1MB; large repos overflow and throw). Diff content then concatenated verbatim into agent prompt args: `` `Review...\n\n${diff}` ``. A crafted commit diff containing adversarial instructions is passed to agents with `--dangerously-skip-permissions` active. Additionally `git diff HEAD` omits untracked files — new files are never reviewed.

**Recommendation:**
1. Cap diff: `diff.slice(0, 100_000)` or set `maxBuffer: 10 * 1024 * 1024` in spawnSync options
2. Wrap diff in delimiter: `<diff>…</diff>` with system instruction not to follow embedded directives
3. Add `git ls-files --others --exclude-standard` to surface untracked files
4. Move to async `execFile` to avoid blocking

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Prompt injection surface + no size limit |
| Security Analyst | ✓ | Shell injection impossible (array args), but LLM injection real |
| Performance Engineer | ✓ | maxBuffer overflow upgraded to HIGH/HIGH |
| Reliability Engineer | ✓ | Confirms no size cap |
| Devil's Advocate | ✓ | Confirms both vectors |

---

## Finding 4: readdirSync throws unhandled ENOENT if commands directory absent

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `bin/install.mjs:63-64`
**Consensus:** 5/5 personas (RE-3, SA cross-exam, AR, PE, DA)
**Priority Score:** 1.80

**Evidence:**
```js
const srcCmds = join(REPO_DIR, 'plugin-opencode', '.opencode', 'commands');
for (const f of readdirSync(srcCmds).filter(...)) {
  cpSync(join(srcCmds, f), join(cmdDir, f));
}
cpSync(join(REPO_DIR, 'plugin-opencode', 'dist', 'companion.mjs'), ...);
```
No try/catch. If `commands/` absent (partial checkout) or `dist/companion.mjs` absent (bundle not built), install throws mid-execution. `mkdirSync` calls at lines ~58-61 already created target directories — install left in inconsistent state with no rollback.

**Recommendation:**
Wrap entire opencode install block in try/catch. On failure, `rmSync(dest, {recursive:true, force:true})`. Before install, check `dist/companion.mjs` exists and emit clear error: `"Run npm run bundle before installing"`.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Partial install state = inconsistent |
| Security Analyst | ✓ | Confirmed in cross-exam |
| Performance Engineer | ✓ | Synchronous + no error handling |
| Reliability Engineer | ✓ | Origin finding RE-3 |
| Devil's Advocate | ✓ | No dispute |

---

## Finding 5: checkCli spawnSync has no timeout — blocks event loop at startup

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `core/runners.mjs:14`
**Consensus:** 5/5 personas (RE-2, PE-2, AR, SA, DA)
**Priority Score:** 1.80

**Evidence:**
```js
const r = spawnSync(binary, ['--version'], { encoding: 'utf8' });
```
No `timeout` option. Called N times (once per agent) in `filterAvailable` before every command. On NFS stall, auth prompt, or misconfigured PATH, Node.js event loop blocks completely — no async escape. With 3 agents: 3 synchronous blocking calls at every command invocation.

**Recommendation:**
Add `{ timeout: 5000 }` to spawnSync options. Check `r.error?.code === 'ETIMEDOUT'` and return `{ status: 'unavailable' }`. Consider caching results per process lifetime in a module-level Map.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | N×blocking at startup |
| Security Analyst | ✓ | DoS via slow binary |
| Performance Engineer | ✓ | Origin finding PE-2 |
| Reliability Engineer | ✓ | Origin finding RE-2 |
| Devil's Advocate | ✓ | PATH pollution amplifies this (DA-6) |

---

## Finding 6: runAgent spawns process with no timeout — hangs indefinitely

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `core/runners.mjs:54-68`
**Consensus:** 4/5 personas (PE-1, RE-1, DA-3, SA-4; DA disputed severity to HIGH)
**Priority Score:** 1.72

**Evidence:**
```js
return new Promise(resolve => {
  const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.on('close', (code, signal) => resolve({...}));
  proc.on('error', e => resolve({...}));
  // no setTimeout, no AbortController, no maxBuffer
});
```
If agent process hangs (rate-limit, auth prompt, deadlock), `Promise.all(available.map(...))` never resolves. stdin is `'ignore'` so agent cannot be unblocked. stdout/stderr accumulate without bound in `out[]`/`err[]` arrays.

**Recommendation:**
```js
const timer = setTimeout(() => {
  proc.kill('SIGTERM');
  resolve({ name, output: '', error: 'timeout', code: 1 });
}, AGENT_TIMEOUT_MS);
proc.on('close', (...) => { clearTimeout(timer); resolve({...}); });
```
Also add running byte counter: kill and resolve with error if buffer exceeds 10MB.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | No recovery path |
| Security Analyst | ✓ | DoS vector |
| Performance Engineer | ✓ | CRITICAL downgraded to HIGH per DA |
| Reliability Engineer | ✓ | Origin RE-1 |
| Devil's Advocate | ✗ | Disputes CRITICAL — developer tool, can kill manually |

---

## Finding 7: requireAvailable calls process.exit(1) inside an exported library function

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `core/runners.mjs:~100`
**Consensus:** 4/5 personas (AR-2, PE reframe, RE, SA; PE abstains on severity)
**Priority Score:** 1.72

**Evidence:**
```js
export function requireAvailable(agents, min = 2) {
  ...
  if (available.length < min) {
    ...
    process.exit(1);  // kills host process unconditionally
  }
}
```
This is a named export. Any caller that imports it into a larger process gets hard-killed with no cleanup, error handling, or graceful shutdown. Tests must use subprocess isolation to exercise the failure path.

**Recommendation:**
Throw an `Error` instead of calling `process.exit`. Let the CLI entry point own the exit decision. This also enables unit testing without subprocess overhead.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Contract violation for a library export |
| Security Analyst | ✓ | No cleanup on kill |
| Performance Engineer | ~ | Abstains — not a perf issue |
| Reliability Engineer | ✓ | Untestable failure path |
| Devil's Advocate | ✓ | Confirms |

---

## Finding 8: JSON parse errors in parseClaudeStreamJson silently swallowed

**Severity:** HIGH
**Confidence:** HIGH
**Location:** `core/parsers.mjs:8-14`
**Consensus:** 4/5 personas (SA-7, RE-6, AR, PE; DA disputes)
**Priority Score:** 1.72

**Evidence:**
```js
.flatMap(l => {
  try {
    const d = JSON.parse(l);
    ...
  } catch { return []; }  // all errors discarded
})
```
Malformed or truncated stream-json lines silently dropped. Caller receives empty string or partial output with no indication of parse failure. `output === ''` with `code === 0` is indistinguishable from successful empty response. `vote` command then receives `parseVote('')` → `{vote:'INVALID'}`.

**Recommendation:**
Log parse errors to stderr: `catch (e) { process.stderr.write(`[parse-warn] ${e.message}\n`); return []; }`. Track malformed-line count and surface warning if rate exceeds threshold.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Silent degradation |
| Security Analyst | ✓ | Masks corrupted output |
| Performance Engineer | ✓ | Confirms |
| Reliability Engineer | ✓ | Origin RE-6 |
| Devil's Advocate | ✗ | Disputes — silent fallback is correct UX for a CLI tool |

---

## Finding 9: install.mjs silently overwrites existing installation — no version guard or rollback

**Severity:** MEDIUM
**Confidence:** MEDIUM
**Location:** `bin/install.mjs:44-45`
**Consensus:** 2/5 (AR-6, SA; others abstain)
**Priority Score:** 1.08

**Evidence:**
`PLUGIN_VERSION` hardcoded as `'1.0.0'` (line 19). Every future version installs to the same path. No check whether a newer version is already present. `cpSync` failure leaves install in inconsistent state.

**Recommendation:**
Read existing version from `dest/package.json` before overwriting. Abort or prompt if installed ≥ source. Wrap cpSync in try/catch with cleanup on failure.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ✓ | Origin AR-6 |
| Security Analyst | ✓ | Confirms |
| Performance Engineer | ~ | Abstains |
| Reliability Engineer | ~ | Abstains |
| Devil's Advocate | ~ | Abstains |

---

## Finding 10: Supply-chain risk — npm name unclaimed + curl-pipe installer

**Severity:** MEDIUM
**Confidence:** LOW
**Location:** `bin/install.sh`, `package.json`
**Consensus:** 1/5 (RE only; DA abstains, SA downgraded to unconfirmed)
**Priority Score:** 1.02

**Evidence:**
README documents `bash <(curl -fsSL .../install.sh)` with no checksum. `@mib200/choreographer-monorepo` npm package name unverified as claimed. Both vectors require external verification.

**Recommendation:**
Publish SHA-256 checksums with each release. Claim npm package name immediately. Consider `npx` with pinned version as primary install path.

**Persona Votes:**
| Persona | Vote | Note |
|---------|------|------|
| Architecture Reviewer | ~ | Abstains |
| Security Analyst | ~ | Downgraded to unconfirmed |
| Performance Engineer | ~ | Abstains |
| Reliability Engineer | ✓ | Confirms risk |
| Devil's Advocate | ✗ | Cannot confirm without registry check |
