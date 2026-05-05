import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, utimesSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpLogDir;
let originalEnv;

beforeEach(() => {
  tmpLogDir = mkdtempSync(join(tmpdir(), 'choreo-obs-'));
  originalEnv = process.env.CHOREO_LOG_DIR;
  process.env.CHOREO_LOG_DIR = tmpLogDir;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.CHOREO_LOG_DIR;
  else process.env.CHOREO_LOG_DIR = originalEnv;
  if (tmpLogDir && existsSync(tmpLogDir)) {
    rmSync(tmpLogDir, { recursive: true, force: true });
  }
});

// Import the module AFTER env is set so it picks up the test dir. We use a dynamic
// import inside each test to bypass Node's ESM module caching — the module reads
// CHOREO_LOG_DIR lazily via logDir() on every call, so a single top-level import
// would also work. We keep dynamic import for clarity.
async function loadObs() {
  return await import('../../core/observability.mjs');
}

test('emit writes a valid NDJSON line to today log file', async () => {
  const { emit, readEvents } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  emit({ type: 'test_event', data: 'hello' });

  const events = readEvents(today);
  const last = events[events.length - 1];
  assert.equal(last.type, 'test_event');
  assert.equal(last.data, 'hello');
  assert.ok(last.timestamp, 'event has timestamp');
});

test('emit includes auto-generated timestamp', async () => {
  const { emit, readEvents } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const before = Date.now();
  emit({ type: 'timestamp_test' });
  const after = Date.now();

  const events = readEvents(today);
  const last = events[events.length - 1];
  const ts = new Date(last.timestamp).getTime();
  assert.ok(ts >= before && ts <= after, 'timestamp is within test window');
});

test('rotate removes files older than 7 days', async () => {
  const { rotate } = await loadObs();
  if (!existsSync(tmpLogDir)) mkdirSync(tmpLogDir, { recursive: true });

  const oldDate = '2020-01-01';
  const oldFile = join(tmpLogDir, `${oldDate}.ndjson`);
  writeFileSync(oldFile, '{"type":"old"}\n');

  // Set mtime to 30 days ago
  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  utimesSync(oldFile, new Date(oldTime), new Date(oldTime));

  rotate();

  assert.ok(!existsSync(oldFile), 'old file was removed');
});

test('rotate also removes numbered backup files older than 7 days', async () => {
  const { rotate } = await loadObs();
  if (!existsSync(tmpLogDir)) mkdirSync(tmpLogDir, { recursive: true });

  const oldDate = '2020-01-01';
  const oldBackup = join(tmpLogDir, `${oldDate}.ndjson.1577836800000`);
  writeFileSync(oldBackup, '{"type":"old-backup"}\n');

  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  utimesSync(oldBackup, new Date(oldTime), new Date(oldTime));

  rotate();

  assert.ok(!existsSync(oldBackup), 'old backup file was removed');
});

test('logPath returns today file path', async () => {
  const { logPath } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const path = logPath();
  assert.ok(path.endsWith(`${today}.ndjson`), `logPath ends with ${today}.ndjson`);
  assert.ok(path.startsWith(tmpLogDir), 'logPath respects CHOREO_LOG_DIR');
});

test('emit rotates today file to numbered backup when exceeding size cap', async () => {
  const { emit } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);

  // Pre-fill with >100MB of padding (use a buffer of 1MB repeated 101 times to avoid a huge string literal).
  const oneMB = Buffer.alloc(1024 * 1024, 'a');
  mkdirSync(tmpLogDir, { recursive: true });
  // Use writeFileSync(file, buf) + appendFileSync for the rest
  const { writeFileSync: wf, appendFileSync: af } = await import('node:fs');
  wf(file, oneMB);
  for (let i = 0; i < 100; i++) af(file, oneMB);

  const sizeBefore = statSync(file).size;
  assert.ok(sizeBefore >= 100 * 1024 * 1024, 'pre-filled file exceeds cap');

  emit({ type: 'after_rotate' });

  // Original file must now be small (contains only the new event line) and a backup must exist.
  const sizeAfter = statSync(file).size;
  assert.ok(sizeAfter < 10 * 1024, 'new today.ndjson contains only the new event');

  const backups = (await import('node:fs')).readdirSync(tmpLogDir)
    .filter(f => f.startsWith(`${today}.ndjson.`));
  assert.ok(backups.length >= 1, 'numbered backup file created');
  const backupSize = statSync(join(tmpLogDir, backups[0])).size;
  assert.ok(backupSize >= 100 * 1024 * 1024, 'backup preserves the pre-cap data');
});
