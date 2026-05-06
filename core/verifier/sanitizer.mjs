/**
 * Verifier feedback sanitizer.
 *
 * Strips imperative instructions masquerading as data, allows only safe tokens,
 * and enforces a 2K character cap. Prevents verifier-to-builder prompt injection.
 */

const MAX_LENGTH = 2048;

// Patterns that look like instructions rather than data
const INSTRUCTION_PATTERNS = [
  /^(please|you should|you must|make sure|ensure that|don't forget|remember to)\b/i,
  /^(fix|change|update|modify|remove|add|delete|rewrite|refactor)\s+(the|this|your)\b/i,
  /^(i recommend|i suggest|consider|try to)\b/i,
  /^(go to|navigate to|open|edit|create)\s+\S+\s+and\b/i,
];


/**
 * Sanitize verifier feedback before injecting into builder context.
 *
 * @param {string} raw - Raw feedback text from verifier
 * @returns {string} Sanitized feedback, capped at 2K chars
 */
export function sanitizeFeedback(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();

  // Strip instruction-like lines
  const lines = text.split('\n');
  const safeLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (INSTRUCTION_PATTERNS.some((p) => p.test(trimmed))) return false;
    return true;
  });

  text = safeLines.join('\n').trim();

  // Cap at 2K characters
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH - 3) + '...';
  }

  return text || null;
}

/**
 * Check if feedback contains instruction-like patterns.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function containsInstructions(text) {
  if (!text) return false;
  return INSTRUCTION_PATTERNS.some((p) => p.test(text));
}
