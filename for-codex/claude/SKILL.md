---
name: llms-choreographer-claude
description: Delegate a task to Claude Code for a second opinion or alternative analysis.
---

# LLMs Choreographer: Delegate to Claude

This skill delegates tasks to Claude Code when the user asks for a second opinion from Claude or wants to compare answers.

## When to use

- User explicitly asks to delegate to Claude
- User wants a second opinion from Claude
- User wants to compare Claude's answer with Codex's
- User asks "what would Claude say?" or similar

## Invocation

Run Claude Code non-interactively:

```bash
claude --print --output-format stream-json --verbose "<task>" --dangerously-skip-permissions \
  | node -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{ const out=Buffer.concat(c).toString().split('\n').filter(Boolean).flatMap(l=>{try{const d=JSON.parse(l);return d.type==='assistant'?(d.message?.content??[]).filter(x=>x.type==='text').map(x=>x.text):[];}catch{return[];}}).join(''); process.stdout.write(out); })"
```

`--output-format stream-json --verbose` emits ndJSON events. The node one-liner extracts `type === "assistant"` events and concatenates `content[].text` blocks. `--dangerously-skip-permissions` is required for automated execution.

## Output handling

Return Claude's output verbatim — no paraphrasing, no summaries.
