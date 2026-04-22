# Delegation Round-Trip Reference

All six directions between Claude Code, Codex, and OpenCode are operational.

## Round-Trip Matrix

| From → To | Mechanism | File:Line |
|-----------|-----------|-----------|
| Claude → Codex | `spawn('codex', ['exec', task], {stdio:['ignore','pipe','pipe']})` | `plugins/codex/scripts/companion.mjs` |
| Claude → OpenCode | `spawn('opencode', ['run', task, '--dangerously-skip-permissions'], {stdio:['ignore','pipe','pipe']})` + ANSI-strip | `plugins/opencode/scripts/companion.mjs` |
| Codex → Claude | `claude --print --output-format=stream-json --verbose "<task>" --dangerously-skip-permissions \| jq` (Codex shell) | `for-codex/claude/SKILL.md` |
| Codex → OpenCode | `opencode run "<task>" --dangerously-skip-permissions` (Codex shell) | `for-codex/opencode/SKILL.md` |
| OpenCode → Claude | `/delegate-claude <task>` slash command → `claude --print --output-format=stream-json --verbose \| jq` | `.opencode/commands/delegate-claude.md` |
| OpenCode → Codex | `/delegate-codex <task>` slash command → `codex exec` | `.opencode/commands/delegate-codex.md` |

## Code Snippets

### Claude → Codex (`plugins/codex/scripts/companion.mjs`)
```js
const proc = spawn('codex', ['exec', task], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PATH: fakePath ?? process.env.PATH },
});
// buffer proc.stdout, resolve on 'close'
```

### Claude → OpenCode (`plugins/opencode/scripts/companion.mjs`)
```js
// opencode emits plain text (+ ANSI escape codes) — no --format flag needed
function parseOpenCodeOutput(raw) {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // strip ANSI codes
    .split('\n')
    .filter(l => l.trim())
    .join('\n')
    .trim() || raw.trim();
}

const proc = spawn('opencode', ['run', task, '--dangerously-skip-permissions'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
// buffer proc.stdout, call parseOpenCodeOutput on close
```

### Codex → Claude (`for-codex/claude/SKILL.md`)
```bash
claude --print --output-format=stream-json --verbose "<task>" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text'
```
`--output-format=stream-json --verbose` is required — plain `--print` returns an empty `result` field on Bedrock. `jq` extracts assistant text from the ndJSON event stream. `--dangerously-skip-permissions` enables non-interactive tool use.

### Codex → OpenCode (`for-codex/opencode/SKILL.md`)
```bash
opencode run "<task>" --dangerously-skip-permissions
# Output is plain text with ANSI escape codes — strip ANSI, return verbatim.
```

### OpenCode → Claude (`.opencode/commands/delegate-claude.md`)
```bash
claude --print --output-format=stream-json --verbose "$ARGUMENTS" --dangerously-skip-permissions \
  | jq -r 'select(.type=="assistant" and .message.content[0].type=="text") | .message.content[].text'
```
OpenCode user types `/delegate-claude <task>`. The `jq` pipeline extracts assistant text from the stream-json event stream; output is injected into the prompt context.

### OpenCode → Codex (`.opencode/commands/delegate-codex.md`)
```bash
codex exec "$ARGUMENTS"
```
OpenCode user types `/delegate-codex <task>`. Shell output captured and injected into the prompt context.

## Worked Example: Claude → OpenCode

From Claude Code, invoke:
```
/opencode:run explain closures in JavaScript
```

Claude Code calls `plugins/opencode/scripts/companion.mjs run "explain closures in JavaScript"`, which:
1. Spawns `opencode run "explain closures in JavaScript" --dangerously-skip-permissions`
2. Buffers plain-text stdout (opencode emits plain text, not ndJSON)
3. Strips ANSI escape codes
4. Returns the cleaned text as the Bash tool result back to Claude Code

## Worked Example: OpenCode → Claude

Inside an OpenCode session, type:
```
/delegate-claude explain closures in JavaScript
```

OpenCode runs `claude --print --output-format=stream-json --verbose "explain closures in JavaScript" --dangerously-skip-permissions | jq -r '...'`, extracts assistant text via the jq pipeline, and injects it into the conversation context.

## OpenCode Slash Commands

All eight orchestration commands available inside OpenCode sessions via `.opencode/commands/`:

| Command | Purpose |
|---------|---------|
| `/delegate-claude <task>` | Delegate to Claude Code, return output |
| `/delegate-codex <task>` | Delegate to Codex, return output |
| `/check-agents` | Report ✓/✗ availability of claude and codex |
| `/council <task>` | Claude (correctness) + Codex (scope) in parallel |
| `/parallel-review` | Review current `git diff HEAD` with both agents |
| `/parallel-debug <symptom>` | Root-cause hypotheses from both agents |
| `/second-opinion <approach>` | Quick approve/caveat/reject from Claude |
| `/vote <proposition>` | YES/NO/ABSTAIN tally from both agents |

Zero per-turn token cost — commands are lazy-loaded only when invoked.

## Warm-Server Mode (Optional)

For chained workflows (council, review, vote), avoid per-call OpenCode cold-start by pre-starting a server:

```bash
opencode serve &
export OPENCODE_SERVER_URL=http://localhost:4096
```

When `OPENCODE_SERVER_URL` is set, the companion appends `--attach $OPENCODE_SERVER_URL` to every `opencode run` call, reusing the warm session. The default path remains stateless if the env var is absent.

## Caveats

- **Codex sandbox**: file access limited to the working directory — cross-project delegation yields partial results.
- **OpenCode plain text**: opencode emits plain text with ANSI codes, not ndJSON. `parseOpenCodeOutput` strips ANSI and returns the text verbatim.
- **Claude subprocess output**: `claude --print` returns an empty `result` field on Bedrock when run as a subprocess. Use `--output-format=stream-json --verbose` and extract text from `{"type":"assistant"}` events via `jq`.
- **Session continuity**: pass `--session <id>` or `--continue` to `opencode run` to maintain conversation state across calls (useful for multi-turn council sessions).
- **`--dangerously-skip-permissions`**: intentional on all delegated Claude calls — the delegated instance runs in a sandboxed context under the host agent's supervision.
- **Slash commands are user-initiated**: OpenCode's model cannot self-invoke slash commands mid-reasoning. If autonomous model-initiated delegation is needed, an MCP server is required (not included; build separately if needed).
