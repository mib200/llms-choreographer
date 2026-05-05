import { mkdirSync, appendFileSync, renameSync, readdirSync, statSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const MAX_BYTES_PER_DAY = 100 * 1024 * 1024; // 100 MB
const RETENTION_DAYS = 7;

function logDir() {
  return process.env.CHOREO_LOG_DIR || join(homedir(), '.choreo', 'logs');
}

function ensureDir() {
  const dir = logDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function todayFile() {
  const today = new Date().toISOString().slice(0, 10);
  return join(logDir(), `${today}.ndjson`);
}

let rotatedThisProcess = false;

process.on('SIGUSR1', () => {
  try { rotate(); } catch { /* signal handler must not throw */ }
});

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

  // Enforce retention once per process on first emit.
  if (!rotatedThisProcess) {
    rotatedThisProcess = true;
    try { rotate(); } catch { /* retention sweep must not block emit */ }
  }

  const file = todayFile();

  // Rotate today's file to a numbered backup if it exceeds the cap.
  if (existsSync(file)) {
    const st = statSync(file);
    if (st.size >= MAX_BYTES_PER_DAY) {
      const rotatedName = `${file}.${Date.now()}`;
      try { renameSync(file, rotatedName); } catch { /* if rename fails, append anyway */ }
    }
  }

  appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Rotate old log files. Removes files older than RETENTION_DAYS.
 * Call this periodically or on startup.
 */
export function rotate() {
  const dir = logDir();
  if (!existsSync(dir)) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  // Cover both base files ("YYYY-MM-DD.ndjson") and rotated backups ("YYYY-MM-DD.ndjson.<epoch>").
  const files = readdirSync(dir).filter(f => f.includes('.ndjson'));

  for (const file of files) {
    const fullPath = join(dir, file);
    let st;
    try { st = statSync(fullPath); } catch { continue; }
    if (st.mtimeMs < cutoff) {
      try { unlinkSync(fullPath); } catch { /* concurrent rotate race — skip */ }
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
  const file = join(logDir(), `${dateStr}.ndjson`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}
