# Pre-Merge ACP Audit — 2026-05-06

Branch: `codex/acp-premerge-fixes`

## Fixed Before Merge

- ACP SDK request shape mismatch in `core/agents/acp-client.mjs`
  - Replaced string protocol version with SDK `PROTOCOL_VERSION`.
  - Sent `clientCapabilities`, not legacy `capabilities`.
  - Added required `mcpServers: []` to session creation/load.
  - Sent prompt blocks via `prompt`, not legacy `messages`.
  - Captured output from `session/update` `agent_message_chunk` events.

- Native fallback and unsafe permission bypass
  - Removed `_invokeNative` paths from Claude, Codex, and OpenCode adapters.
  - Removed `--dangerously-skip-permissions` from production adapter code and generated plugin bundles.
  - ACP errors now fail closed with `transport: "acp"` and `exitCode: 1`.

- ACP child-process lifecycle
  - `AcpClient.teardown()` now waits for subprocess close after termination.
  - CLI broker commands now exit explicitly after broker shutdown.

- Environment handling
  - Added additive exact-key opt-in via `CHOREO_AGENT_ENV_ALLOW`.
  - Kept full passthrough behind explicit `CHOREO_AGENT_ENV_PASSTHROUGH=1`.
  - Converted agent CLI tests to execute ACP spawn paths when checking env propagation.

- Unix socket endpoint hardening
  - Runtime sockets now live under a per-user `0700` directory.
  - Socket files are chmodded to `0600` after listen.
  - Optional endpoint tokens are enforced.
  - Endpoint rejects messages without a string `method`.

- Dead endpoint lifecycle contract
  - Removed `CHOREO_BROKER_ENDPOINT` injection until a persistent endpoint process exists.
  - `handleSessionEnd()` tolerates absent broker and still cleans env files.

- CLI correctness
  - `stripFlags()` now strips `--model`, `--effort`, `--mode`, and `--sandbox` anywhere in args.
  - `debug` now invokes only available agents after passing the minimum-agent check.

- Test hardening
  - Added real SDK-backed ACP client integration coverage.
  - Converted fake agents to ACP stdio servers.
  - Updated vote, agent, debug, council, and second-opinion tests to prove ACP path behavior.

## Remaining TODOs

- Gemini adapter remains deferred per user lock.
- `npm audit` reports 6 moderate upstream vulnerabilities through `@agentclientprotocol/claude-agent-acp -> @anthropic-ai/claude-agent-sdk`; latest published `@agentclientprotocol/claude-agent-acp` is already `0.32.0`, so no non-downgrade fix is currently available.
- GitNexus index refresh failed on local `.gitnexus/lbug` lock, so `detect_changes()` under-reported changed code symbols. Manual impact checks were run before edited symbols, and test/bundle verification passed.

## Verification

- `npm test`: 172 tests, 172 pass, 0 fail.
- `npm run check-bundles`: all generated plugin bundles fresh.
- Production scan: no `_invokeNative`, `dangerously-skip-permissions`, stale ACP `messages`, or string protocol-version patterns outside regression tests.
- Production invocation scan: companion/council paths call `broker.invoke()`, and adapters instantiate `AcpClient`.
