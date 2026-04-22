# Delegation Round-Trip Reference

All six directions between Claude Code, Codex, and OpenCode are operational.

## Round-Trip Matrix

| From → To | Mechanism | File:Line |
|-----------|-----------|-----------|
| Claude → Codex | `spawn('codex', ['exec', task], {stdio:['ignore','pipe','pipe']})` | `plugins/codex/scripts/companion.mjs` |
| Claude → OpenCode | `spawn('opencode', ['run', task, '--format', 'json', '--dangerously-skip-permissions'], {stdio:['ignore','pipe','pipe']})` + ndJSON parse | `plugins/opencode/scripts/companion.mjs` |
| Codex → Claude | `claude --print "<task>" --dangerously-skip-permissions` (Codex shell) | `for-codex/claude/SKILL.md` |
| Codex → OpenCode | `opencode run "<task>" --format json --dangerously-skip-permissions` (Codex shell) | `for-codex/opencode/SKILL.md` |
| OpenCode → Claude | `/delegate-claude <task>` slash command → `claude --print` | `.opencode/commands/delegate-claude.md` |
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
function runOpenCode(task) {
  const args = ['run', task, '--format', 'json', '--dangerously-skip-permissions'];
  const serverUrl = process.env.OPENCODE_SERVER_URL;
  if (serverUrl) args.push('--attach', serverUrl);
  const proc = spawn('opencode', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  // buffer stdout, parse ndJSON on close
}

function parseOpenCodeOutput(raw) {
  // extract text from {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}} events
  const lines = raw.split('\n').filter(l => l.trim());
  const messages = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'assistant' && obj.message?.content) {
        for (const block of obj.message.content) {
          if (block.type === 'text') messages.push(block.text);
        }
      }
    } catch { /* non-JSON progress lines */ }
  }
  return messages.length > 0 ? messages.join('\n').trim() : raw.trim();
}
```

### Codex → Claude (`for-codex/claude/SKILL.md`)
```bash
claude --print "<task>" --dangerously-skip-permissions
```
Codex captures stdout verbatim. `--dangerously-skip-permissions` enables non-interactive tool use.

### Codex → OpenCode (`for-codex/opencode/SKILL.md`)
```bash
opencode run "<task>" --format json --dangerously-skip-permissions
# Parse assistant text from ndJSON stream:
# {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
```

### OpenCode → Claude (`.opencode/commands/delegate-claude.md`)
```bash
claude --print "$ARGUMENTS" --dangerously-skip-permissions
```
OpenCode user types `/delegate-claude <task>`. Shell output captured and injected into the prompt context.

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
1. Spawns `opencode run "explain closures in JavaScript" --format json --dangerously-skip-permissions`
2. Buffers the ndJSON event stream from stdout
3. Extracts all `{"type":"assistant"}` text blocks
4. Returns the concatenated text as the Bash tool result back to Claude Code

## Worked Example: OpenCode → Claude

Inside an OpenCode session, type:
```
/delegate-claude explain closures in JavaScript
```

OpenCode runs `claude --print "explain closures in JavaScript" --dangerously-skip-permissions`, captures stdout, and injects it into the conversation context.

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
- **OpenCode ndJSON format**: only `{"type":"assistant"}` events carry assistant text. Progress events (`tool_use`, `tool_result`, etc.) are silently skipped by the parser.
- **Session continuity**: pass `--session <id>` or `--continue` to `opencode run` to maintain conversation state across calls (useful for multi-turn council sessions).
- **`--dangerously-skip-permissions`**: intentional on all delegated Claude calls — the delegated instance runs in a sandboxed context under the host agent's supervision.
- **Slash commands are user-initiated**: OpenCode's model cannot self-invoke slash commands mid-reasoning. If autonomous model-initiated delegation is needed, an MCP server is required (not included; build separately if needed).
