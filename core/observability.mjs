import { mkdirSync, appendFileSync, readdirSync, statSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LOG_DIR = join(homedir(), '.choreo', 'logs');
const MAX_BYTES_PER_DAY = 100 * 1024 * 1024; // 100 MB
const RETENTION_DAYS = 7;

function ensureDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function todayFile() {
  const today = new Date().toISOString().slice(0, 10);
  return join(LOG_DIR, `${today}.ndjson`);
}

/**
 * Emit a structured event to today's NDJSON log.
 *
 * @param {object} event - Structured event object
 * @param {string} event.type - Event type (e.g. "agent_invocation", "phase_transition")
 * @param {string} [event.timestamp] - ISO timestamp (auto-generated if omitted)
 * @param {string} [event.session_id] - Optional session identifier
 */
export function emit(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  ensureDir();
  const file = todayFile();

  // Rotate if today's file exceeds cap
  if (existsSync(file)) {
    const st = statSync(file);
    if (st.size >= MAX_BYTES_PER_DAY) {
      // Truncate and start fresh — old data preserved in prior days' files
      appendFileSync(file, '', 'utf8');
    }
  }

  appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Rotate old log files. Removes files older than RETENTION_DAYS.
 * Call this periodically or on startup.
 */
export function rotate() {
  ensureDir();
  if (!existsSync(LOG_DIR)) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.ndjson'));

  for (const file of files) {
    const fullPath = join(LOG_DIR, file);
    const st = statSync(fullPath);
    if (st.mtimeMs < cutoff) {
      unlinkSync(fullPath);
    }
  }
}

/**
 * Return today's log file path. Useful for tests and verification.
 */
export function logPath() {
  return todayFile();
}

/**
 * Read all events from a specific log file. Useful for tests.
 */
export function readEvents(dateStr) {
  const file = join(LOG_DIR, `${dateStr}.ndjson`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));
}
