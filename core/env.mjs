/**
 * Agent environment allowlist — extracted to avoid circular imports.
 *
 * runners.mjs imports adapters, adapters need buildAgentEnv.
 * This module has zero internal imports so it can be safely imported by both.
 */

const ENV_ALLOW_EXACT = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'TZ', 'TMPDIR',
  'LANG', 'PWD', 'NO_COLOR', 'FORCE_COLOR',
  'NODE_OPTIONS', 'NODE_ENV',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL',
  'CHOREO_LOG_DIR', 'CHOREO_LOG_MAX_BYTES',
  'CHOREO_AGENT_ENV_ALLOW', 'CHOREO_AGENT_ENV_PASSTHROUGH',
]);

const ENV_ALLOW_PREFIXES = [
  'LC_', 'XDG_',
  'ANTHROPIC_', 'CLAUDE_', 'OPENCODE_', 'CODEX_',
];

export function buildAgentEnv(src = process.env) {
  if (src.CHOREO_AGENT_ENV_PASSTHROUGH === '1') return { ...src };
  const extraAllow = parseExtraAllowlist(src.CHOREO_AGENT_ENV_ALLOW);
  const out = Object.create(null);
  for (const [key, value] of Object.entries(src)) {
    if (ENV_ALLOW_EXACT.has(key) || extraAllow.has(key) || ENV_ALLOW_PREFIXES.some(p => key.startsWith(p))) {
      out[key] = value;
    }
  }
  return out;
}

function parseExtraAllowlist(value) {
  const allowed = new Set();
  if (!value) return allowed;
  for (const raw of String(value).split(/[,\s:]+/)) {
    const key = raw.trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) allowed.add(key);
  }
  return allowed;
}
