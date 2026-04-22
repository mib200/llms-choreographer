# Delegation Round-Trip Reference

All six directions between Claude Code, Codex, and OpenCode are operational. No upstream changes required.

## Round-Trip Matrix

| From → To | Mechanism | File:Line |
|-----------|-----------|-----------|
| Claude → Codex | `spawn('codex', ['exec', task], {stdio:['ignore','pipe','pipe']})` | `plugins/codex/scripts/companion.mjs` |
| Claude → OpenCode | `spawn('opencode', ['run', task, '--format', 'json', '--dangerously-skip-permissions'], {stdio:['ignore','pipe','pipe']})` + ndJSON parse | `plugins/opencode/scripts/companion.mjs` |
| Codex → Claude | `claude --print "<task>" --dangerously-skip-permissions` (Codex shell) | `for-codex/claude/SKILL.md` |
| Codex → OpenCode | `opencode run "<task>" --format json --dangerously-skip-permissions` (Codex shell) | `for-codex/opencode/SKILL.md` |
| OpenCode → Claude | `delegate_claude` MCP tool → `spawn('claude', ['--print', task, '--dangerously-skip-permissions'])` | `for-opencode/src/index.js:delegateToClaude` |
| OpenCode → Codex | `delegate_codex` MCP tool → `spawn('codex', ['exec', task])` | `for-opencode/src/index.js:delegateToCodex` |

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

### OpenCode → Claude (`for-opencode/src/index.js:delegateToClaude`)
```js
async function delegateToClaude(task) {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', task, '--dangerously-skip-permissions'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(out)));
  });
}
```

### OpenCode → Codex (`for-opencode/src/index.js:delegateToCodex`)
```js
async function delegateToCodex(task) {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', ['exec', task], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(out)));
  });
}
```

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
