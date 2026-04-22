/** Parse claude --output-format stream-json --verbose output, extract assistant text. */
export function parseClaudeStreamJson(raw) {
  const text = raw.split('\n')
    .filter(l => l.trim())
    .flatMap(l => {
      try {
        const d = JSON.parse(l);
        if (d.type !== 'assistant') return [];
        return (d.message?.content ?? [])
          .filter(c => c.type === 'text')
          .map(c => c.text);
      } catch (e) { process.stderr.write(`[choreo:parse-warn] ${e.message}\n`); return []; }
    })
    .join('');
  return text.trim() || raw.trim();
}

/** Strip ANSI escape codes and OpenCode progress lines, return clean text. */
export function parseOpenCodeOutput(raw) {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .split('\n')
    .filter(l => l.trim())
    .join('\n')
    .trim() || raw.trim();
}
