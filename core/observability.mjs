import { mkdirSync, appendFileSync, renameSync, readdirSync, statSync, unlinkSync, existsSync, readFileSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_MAX_BYTES_PER_DAY = 100 * 1024 * 1024; // 100 MB
const RETENTION_DAYS = 7;

// Matches "YYYY-MM-DD.ndjson" (seq undefined) or "YYYY-MM-DD.ndjson.<N>" (numbered backup).
const LOG_NAME_RE = /^(\d{4}-\d{2}-\d{2})\.ndjson(?:\.(\d+))?$/;

function logDir() {
  return process.env.CHOREO_LOG_DIR || join(homedir(), '.choreo', 'logs');
}

function maxBytesPerDay() {
  const env = process.env.CHOREO_LOG_MAX_BYTES;
  if (env !== undefined) {
    const trimmed = env.trim();
    // Strict: must be pure positive integer. Rejects "1024abc" (parseInt would accept),
    // "0", "-5", empty, and non-numeric. Falls back to default on any invalid value.
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_MAX_BYTES_PER_DAY;
}

function ensureDir() {
  const dir = logDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function todayFile() {
  return join(logDir(), `${dateKey()}.ndjson`);
}

// List every log artifact we manage in `dir`. Each entry: { name, date, seq } where
// seq === 0 means the active day file, seq > 0 means a rotated numbered backup.
function listLogFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const m = LOG_NAME_RE.exec(name);
    if (!m) continue;
    out.push({ name, date: m[1], seq: m[2] ? parseInt(m[2], 10) : 0 });
  }
  return out;
}

// Return same-day files in chronological order: backups (seq 1..N, oldest→newest) then current (seq=0).
function sameDayFilesOrdered(dir, dateStr) {
  const files = listLogFiles(dir).filter(f => f.date === dateStr);
  const backups = files.filter(f => f.seq > 0).sort((a, b) => a.seq - b.seq);
  const current = files.find(f => f.seq === 0);
  return current ? [...backups, current] : backups;
}

function nextBackupSeq(dir, dateStr) {
  const files = listLogFiles(dir).filter(f => f.date === dateStr && f.seq > 0);
  return files.reduce((max, f) => Math.max(max, f.seq), 0) + 1;
}

let rotatedThisProcess = false;

// Test hook: allow a fresh process-retention sweep when ESM module caching would
// otherwise keep `rotatedThisProcess` true across dynamically-imported tests.
export function __resetForTest() {
  rotatedThisProcess = false;
}

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
  const entry = { timestamp: new Date().toISOString(), ...event };
  const line = JSON.stringify(entry) + '\n';
  const dir = logDir();
  ensureDir();

  // Enforce retention once per process on first emit. Set the flag AFTER rotate so that
  // if rotate throws mid-sweep the next emit re-attempts retention instead of silently
  // skipping it for the lifetime of the process.
  if (!rotatedThisProcess) {
    try { rotate(); } catch { /* retention sweep must not block emit */ }
    rotatedThisProcess = true;
  }

  const today = dateKey();
  const file = join(dir, `${today}.ndjson`);
  const cap = maxBytesPerDay();

  // If the active file alone exceeds the cap, rotate it to the next sequential backup.
  // Reservation is race-safe across processes: O_EXCL create a zero-byte sentinel at the
  // candidate backup name. If the name exists, bump seq and retry. Then renameSync
  // overwrites our sentinel atomically. Two concurrent emitters never clobber the same
  // backup because only one can successfully create each sentinel.
  // Aggregate storage is bounded by the 7-day retention sweep (see `rotate()`).
  let curSize = 0;
  try { curSize = statSync(file).size; } catch { /* file doesn't exist yet */ }
  if (curSize >= cap) {
    let seq = nextBackupSeq(dir, today);
    let rotatedName;
    let reserved = false;
    for (let tries = 0; tries < 20; tries++) {
      rotatedName = join(dir, `${today}.ndjson.${seq}`);
      try {
        const fd = openSync(rotatedName, 'wx'); // O_EXCL | O_CREAT | O_WRONLY
        closeSync(fd);
        reserved = true;
        break;
      } catch { seq++; /* name taken by another process; try next seq */ }
    }
    if (!reserved) {
      throw new Error(`choreo observability: could not reserve backup name after 20 attempts in ${dir}`);
    }
    // Fail closed: if rename fails, let the outer emit() caller's try/catch swallow the event
    // rather than silently writing past the cap into an oversized file.
    renameSync(file, rotatedName);
  }

  appendFileSync(file, line, 'utf8');
}

/**
 * Rotate old log files. Removes files older than RETENTION_DAYS.
 * Call this periodically or on startup. Also invoked on SIGUSR1.
 */
export function rotate() {
  const dir = logDir();
  if (!existsSync(dir)) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  // Only touch files matching our managed naming scheme. Avoids wiping unrelated
  // artifacts that happen to contain ".ndjson" in their name (editor swap files, backups, etc.).
  for (const f of listLogFiles(dir)) {
    const fullPath = join(dir, f.name);
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
 * Read all events for a given date, stitched across numbered backups and the active file.
 * Order is chronological: oldest backup first, active file last.
 */
export function readEvents(dateStr) {
  const dir = logDir();
  const out = [];
  for (const f of sameDayFilesOrdered(dir, dateStr)) {
    let text;
    try { text = readFileSync(join(dir, f.name), 'utf8'); } catch { continue; }
    for (const ln of text.split('\n')) {
      if (!ln.trim()) continue;
      try { out.push(JSON.parse(ln)); } catch { /* skip malformed line */ }
    }
  }
  return out;
}
