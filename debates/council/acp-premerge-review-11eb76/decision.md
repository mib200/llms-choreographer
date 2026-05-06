## Council Decision: ACP Premerge Fixes Code Review

### Members
- claude: session-default, role=moderator (orchestrator) + anonymous debater sub-agent
- opencode1: opencode-go/kimi-k2.6
- opencode2: opencode-go/qwen3.6-plus
- opencode3: amazon-bedrock/global.anthropic.claude-opus-4-7
- opencode4: opencode/gpt-5.5

### Consensus Position

**Merge `codex/acp-premerge-fixes` after applying 2 targeted fixes in `core/agents/acp-client.mjs`:**

1. **COR-002 (line 246)** — Store the `setTimeout` handle and `clearTimeout` when `promptPromise` wins the race. Without this, the orphaned `timeoutPromise` rejects into the void, producing an **unhandled promise rejection** that crashes the process in Node >= 15.

2. **COR-006 (line 258)** — Change `if (!output && response.output)` to `if (!output.trim() && response.output)`. Whitespace-only chunks from `outputChunks.join('')` are truthy but contain no useful content. Without this fix, the fallback to `response.output` is suppressed and `result.output` becomes empty after `.trim()`.

**All other 10 findings: ACCEPT or DEFER.** No further fixes required before merge.

### Key Agreements

- COR-002 is the only P1: unhandled rejection = process crash (5/5 unanimous from Round 1)
- COR-006 is P2: real data-loss edge in high-blast-radius file (5/5 unanimous after Round 2)
- SEC-001 (TOCTOU) is mitigated by parent directory 0o700 on single-tenant dev machines (5/5)
- SEC-005 is factually incorrect: `stdin.destroy()` sends EOF not SIGPIPE (4/5 confirmed)
- COR-001 (parseStructured trim): JSON.parse tolerates whitespace per ECMA-262 §24.5.1 (4/5)
- ACP-only architecture is sound: fail-closed + circuit breaker + git-revert rollback (5/5)
- All SEC findings are theatre on single-tenant developer machines (5/5)

### Resolved Debates

- **COR-001 (claude vs rest):** claude initially wanted COR-001 fixed (1-char change). After 3 members showed JSON.parse spec explicitly handles whitespace, claude conceded in Round 1. No behavioral change from fixing it.
- **COR-003 (opencode4 vs rest):** opencode4 initially required COR-003 (teardown race). After grep confirmed all callsites are sequential `await prompt() → finally → await teardown()`, opencode4 conceded in Round 1. No concurrent caller exists.
- **COR-006 (claude+opencode2 vs rest):** claude and opencode2 initially said COR-006 was non-issue. After opencode4 demonstrated the control flow (fallback check at line 258 precedes trim at line 264, whitespace strings are truthy), both conceded in Round 2.

### Remaining Disagreements

- **COR-003 deferral (opencode1 dissent):** opencode1 maintains COR-003 should be fixed in this PR as a zero-cost safety measure (one line: `this.connection = null` after `closeSession()`). The 4/5 majority defers because no concurrent caller exists. opencode1 argues this is "latent hazard for future misuse." Both positions are technically valid — this is a judgment call about defensive coding standards, not a correctness disagreement.

### Confidence Level

**PARTIAL CONSENSUS** (4/5 FULL + 1 PARTIAL on COR-003 deferral)

### Debate Summary
- Members: 5
- Rounds: 2 (converged early, Round 3 skipped)
- Pre-flight questions collected: 12 across 4 members
- Pre-flight unique questions answered: 4 (after deduplication)
- Members who needed no clarifications: none (all asked 3 questions)
- Concessions by member:
  - claude: COR-001 (Round 1), COR-006 (Round 2) = 2 concessions
  - opencode1: COR-003 deferral not fully conceded, SEC-005 incorrect (Round 1) = 1 concession
  - opencode2: COR-006 (Round 2) = 1 concession
  - opencode3: COR-001 cheap fix worth taking (Round 1), COR-006 (Round 1), blast radius (Round 1) = 3 concessions
  - opencode4: COR-003 defer (Round 1), COR-001 optional (Round 1) = 2 concessions
- User clarifications requested: 0 (no question routing needed during Phases 1-3)
- Key insight that emerged from debate: **The unhandled promise rejection from COR-002 is worse than a "timer leak" — it's a Node >= 15 process crash.** opencode1 elevated the severity correctly. Also: **the control flow ordering (fallback check before trim) is what makes COR-006 real** — a subtle sequencing bug that three members initially missed because they assumed trim preceded the check.
