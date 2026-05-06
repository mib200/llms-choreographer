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

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g');

/** Strip ANSI escape codes and OpenCode progress lines, return clean text. */
export function parseOpenCodeOutput(raw) {
  return raw
    .replace(ANSI_RE, '')
    .split('\n')
    .filter(l => l.trim())
    .join('\n')
    .trim() || raw.trim();
}

/**
 * Client-side JSON validation for ACP structured output.
 *
 * ACP doesn't enforce JSON schemas — validation happens here.
 * Parse failures return null gracefully (don't crash).
 *
 * @param {string} raw — raw output string from agent
 * @param {object} schema — JSON schema with optional `required` array
 * @returns {object|null} — parsed object if valid, null otherwise
 */
export function parseStructuredOutput(raw, schema) {
  if (!schema) return null;
  try {
    // Find JSON object by scanning for '{' and counting braces
    let start = raw.indexOf('{');
    while (start >= 0) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = raw.slice(start, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (schema.required && Array.isArray(schema.required)) {
                for (const key of schema.required) {
                  if (!(key in parsed)) return null;
                }
              }
              if (schema.properties) {
                for (const [k, propSchema] of Object.entries(schema.properties)) {
                  if (k in parsed && propSchema.enum && !propSchema.enum.includes(parsed[k])) {
                    return null;
                  }
                }
              }
              return parsed;
            } catch { /* not valid JSON at this boundary, try next '{' */ }
            break;
          }
        }
      }
      start = raw.indexOf('{', start + 1);
    }
    return null;
  } catch {
    return null;
  }
}
