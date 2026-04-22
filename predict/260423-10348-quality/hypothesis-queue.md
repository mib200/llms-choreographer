# Hypothesis Queue — 260423-quality

Ranked hypotheses for `--chain debug,fix` handoff.

| Rank | ID | Hypothesis | Confidence | Location | Consensus |
|------|----|-----------|-----------|----------|-----------|
| 1 | H-01 | `--dangerously-skip-permissions` on every agent invocation enables full shell access via prompt injection | HIGH | core/companion.mjs:53 | 5/5 |
| 2 | H-02 | vote command exits 0 and prints valid-looking tally even when all agent votes are INVALID | HIGH | core/companion.mjs:244-260 | 5/5 |
| 3 | H-03 | git diff content injected verbatim into LLM prompt; spawnSync default maxBuffer (1MB) overflows on large repos | HIGH | core/companion.mjs:84-98 | 5/5 |
| 4 | H-04 | installOpenCode crashes with unhandled ENOENT if plugin-opencode/.opencode/commands/ or dist/companion.mjs absent | HIGH | bin/install.mjs:63-64 | 5/5 |
| 5 | H-05 | checkCli spawnSync blocks event loop indefinitely — no timeout option set | HIGH | core/runners.mjs:14 | 5/5 |
| 6 | H-06 | runAgent Promise never resolves if spawned agent process hangs | HIGH | core/runners.mjs:54-68 | 4/5 |
| 7 | H-07 | requireAvailable calls process.exit(1) inside exported library — any importer gets hard-killed | HIGH | core/runners.mjs:~100 | 4/5 |
| 8 | H-08 | parseClaudeStreamJson silently drops malformed JSON lines — caller receives empty string with no error signal | HIGH | core/parsers.mjs:8-14 | 4/5 |
| 9 | H-09 | install.mjs PLUGIN_VERSION hardcoded '1.0.0' — future versions silently overwrite same path, no rollback | MEDIUM | bin/install.mjs:19,44-45 | 2/5 |
| 10 | H-10 | npm package name unclaimed + curl-pipe installer enables supply-chain attack before first publish | LOW | bin/install.sh | 1/5 |
