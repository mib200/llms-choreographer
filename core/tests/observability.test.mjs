import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, utimesSync, mkdirSync, existsSync, rmSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpLogDir;
let originalLogDir;
let originalMaxBytes;

beforeEach(() => {
  tmpLogDir = mkdtempSync(join(tmpdir(), 'choreo-obs-'));
  originalLogDir = process.env.CHOREO_LOG_DIR;
  originalMaxBytes = process.env.CHOREO_LOG_MAX_BYTES;
  process.env.CHOREO_LOG_DIR = tmpLogDir;
  delete process.env.CHOREO_LOG_MAX_BYTES;
});

afterEach(() => {
  if (originalLogDir === undefined) delete process.env.CHOREO_LOG_DIR;
  else process.env.CHOREO_LOG_DIR = originalLogDir;
  if (originalMaxBytes === undefined) delete process.env.CHOREO_LOG_MAX_BYTES;
  else process.env.CHOREO_LOG_MAX_BYTES = originalMaxBytes;
  if (tmpLogDir && existsSync(tmpLogDir)) {
    rmSync(tmpLogDir, { recursive: true, force: true });
  }
});

// Reset the module's `rotatedThisProcess` flag between tests. Node ESM caches modules
// by resolved URL, so the flag would otherwise persist across tests and the rotate-on-first-emit
// behavior would only be exercised in the first test of the suite.
async function loadObs() {
  const mod = await import('../../core/observability.mjs');
  mod.__resetForTest();
  return mod;
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

  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  utimesSync(oldFile, new Date(oldTime), new Date(oldTime));

  rotate();

  assert.ok(!existsSync(oldFile), 'old file was removed');
});

test('rotate also removes numbered backup files older than 7 days', async () => {
  const { rotate } = await loadObs();
  if (!existsSync(tmpLogDir)) mkdirSync(tmpLogDir, { recursive: true });

  const oldDate = '2020-01-01';
  const oldBackup = join(tmpLogDir, `${oldDate}.ndjson.1`);
  writeFileSync(oldBackup, '{"type":"old-backup"}\n');

  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  utimesSync(oldBackup, new Date(oldTime), new Date(oldTime));

  rotate();

  assert.ok(!existsSync(oldBackup), 'old backup file was removed');
});

test('rotate does NOT delete unrelated files that merely contain ".ndjson" in their name', async () => {
  const { rotate } = await loadObs();
  if (!existsSync(tmpLogDir)) mkdirSync(tmpLogDir, { recursive: true });

  // Shapes that should be preserved — only the managed "YYYY-MM-DD.ndjson[.N]" scheme is managed.
  const unrelated = [
    join(tmpLogDir, 'archive.ndjson.bak'),     // editor/system backup
    join(tmpLogDir, '2020-01-01.ndjson.swp'),  // vim swap
    join(tmpLogDir, 'notes-about-ndjson.txt'), // unrelated doc
  ];
  for (const p of unrelated) writeFileSync(p, 'x');
  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const p of unrelated) utimesSync(p, new Date(oldTime), new Date(oldTime));

  rotate();

  for (const p of unrelated) assert.ok(existsSync(p), `unrelated file preserved: ${p}`);
});

test('logPath returns today file path', async () => {
  const { logPath } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const path = logPath();
  assert.ok(path.endsWith(`${today}.ndjson`), `logPath ends with ${today}.ndjson`);
  assert.ok(path.startsWith(tmpLogDir), 'logPath respects CHOREO_LOG_DIR');
});

test('emit rotates today file to sequential numbered backup when exceeding size cap', async () => {
  // Use a small cap so the test runs in milliseconds.
  process.env.CHOREO_LOG_MAX_BYTES = String(4 * 1024); // 4KB
  const { emit } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);

  // First event creates the file under cap.
  emit({ type: 'first', payload: 'a'.repeat(100) });
  assert.ok(statSync(file).size < 4 * 1024, 'first file is under cap');

  // Pre-fill past the cap so the next emit triggers rotation.
  writeFileSync(file, 'x'.repeat(5 * 1024));
  assert.ok(statSync(file).size >= 4 * 1024, 'pre-fill exceeded cap');

  emit({ type: 'after_rotate' });

  // Active file now holds only the new event.
  const afterSize = statSync(file).size;
  assert.ok(afterSize < 4 * 1024, 'new active file is under cap after rotation');

  // A numbered backup ".1" was created (sequential — NOT Date.now-based).
  const backups = readdirSync(tmpLogDir).filter(f => f.startsWith(`${today}.ndjson.`));
  assert.ok(backups.length >= 1, 'numbered backup file created');
  assert.ok(backups.some(f => /\.ndjson\.\d+$/.test(f)), 'backup uses sequential suffix');
});

test('readEvents stitches events across numbered backups in chronological order', async () => {
  process.env.CHOREO_LOG_MAX_BYTES = String(512); // tiny cap to force rotation
  const { emit, readEvents } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);

  // Emit enough events to force at least one rotation. Each event is ~250 bytes, so
  // the 3rd or 4th emit will trip the 512-byte cap and rotate the active file to .1.
  emit({ type: 'ev', seq: 1, pad: 'x'.repeat(200) });
  emit({ type: 'ev', seq: 2, pad: 'x'.repeat(200) });
  emit({ type: 'ev', seq: 3, pad: 'x'.repeat(200) });
  emit({ type: 'ev', seq: 4, pad: 'x'.repeat(200) });

  // At least one backup must exist — proves rotation happened.
  const backups = readdirSync(tmpLogDir).filter(f => /^\d{4}-\d{2}-\d{2}\.ndjson\.\d+$/.test(f));
  assert.ok(backups.length >= 1, 'rotation produced a numbered backup');

  // readEvents must return ALL 4 events stitched across backup + active, in order.
  const events = readEvents(today).filter(e => e.type === 'ev');
  assert.equal(events.length, 4, 'all 4 events recovered across backups + active file');
  assert.deepEqual(events.map(e => e.seq), [1, 2, 3, 4], 'events returned in chronological order');
});

test('CHOREO_LOG_MAX_BYTES parse is strict — garbage/zero/negative all fall back to default', async () => {
  // Fresh import each case via the reset helper so every probe reads the env var anew.
  const cases = [
    ['1024abc', false],  // trailing garbage → reject
    ['0',       false],  // zero → reject
    ['-5',      false],  // negative → reject (rejected by /^\d+$/)
    ['',        false],  // empty → reject
    ['abc',     false],  // non-numeric → reject
    ['1024',    true],   // valid → accept
    ['  1024 ', true],   // whitespace stripped → accept
  ];

  // Import once, then flip env var per case. maxBytesPerDay reads lazily.
  const { emit } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);

  for (const [value, shouldHonour] of cases) {
    process.env.CHOREO_LOG_MAX_BYTES = value;
    // Pre-fill active file to just above 1024 bytes.
    writeFileSync(file, 'x'.repeat(1100));
    emit({ type: 'probe' });

    const backups = readdirSync(tmpLogDir).filter(f => /^\d{4}-\d{2}-\d{2}\.ndjson\.\d+$/.test(f));
    if (shouldHonour) {
      assert.ok(backups.length > 0, `value="${value}" honoured — rotation should have fired`);
    } else {
      // With default cap of 100MB, 1100 bytes never triggers rotation.
      assert.equal(backups.length, 0, `value="${value}" rejected — no rotation expected`);
    }
    // Clean backups between cases.
    for (const b of backups) rmSync(join(tmpLogDir, b), { force: true });
    rmSync(file, { force: true });
  }
});

test('rotation chooses a fresh backup name when lower sequence already taken (O_EXCL reservation)', async () => {
  process.env.CHOREO_LOG_MAX_BYTES = String(1024);
  const { emit } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);

  // Pre-seed a backup at .1 (simulates a concurrent process that reserved seq=1 first).
  writeFileSync(join(tmpLogDir, `${today}.ndjson.1`), 'pre-existing');
  // Pre-fill active past cap.
  writeFileSync(file, 'x'.repeat(2 * 1024));

  emit({ type: 'after_rotate' });

  // Original .1 backup must be preserved (we did NOT overwrite it).
  assert.equal(
    readFileSync(join(tmpLogDir, `${today}.ndjson.1`), 'utf8'),
    'pre-existing',
    '.1 backup preserved — O_EXCL prevented clobber'
  );
  // Our rotation went to .2 or higher.
  const ours = readdirSync(tmpLogDir).filter(f => /^\d{4}-\d{2}-\d{2}\.ndjson\.\d+$/.test(f) && !f.endsWith('.1'));
  assert.ok(ours.length >= 1, 'rotation produced a fresh backup distinct from the pre-existing one');
});

test('concurrent emits across workers do not lose events to rotation race (FF1)', async () => {
  // Regression guard for the ENOENT-tolerance branch: N workers all see the
  // active file above cap, reserve N distinct backup names via O_EXCL, and race
  // renameSync. Exactly one winner renames; the rest get ENOENT. The tolerance
  // branch must clean up each loser's zero-byte sentinel and fall through to
  // append the event to the freshly-empty active file. Total: every event
  // persists — zero loss. Pre-Phase-D, loser renames threw and the outer emit()
  // caller swallowed the exception, silently dropping events.
  process.env.CHOREO_LOG_MAX_BYTES = String(1024);
  const { writeFileSync } = await import('node:fs');
  const { Worker } = await import('node:worker_threads');
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);
  writeFileSync(file, 'x'.repeat(2 * 1024));

  const workerUrl = new URL('./helpers/concurrent-emit-worker.mjs', import.meta.url);
  const N = 4;
  await Promise.all(Array.from({ length: N }, (_, id) => new Promise((resolve, reject) => {
    const w = new Worker(workerUrl, { workerData: { logDir: tmpLogDir, cap: 1024, id } });
    w.on('exit', code => code === 0 ? resolve() : reject(new Error(`worker ${id} exited ${code}`)));
    w.on('error', reject);
  })));

  const { readEvents } = await loadObs();
  const ids = readEvents(today).filter(e => e.type === 'concurrent').map(e => e.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [0, 1, 2, 3], `all ${N} concurrent events persisted across the rotation race`);
});

test('emit fails closed when renameSync fails (does not corrupt oversized file)', async () => {
  // Simulate by making the dir read-only AFTER the active file exceeds cap.
  // renameSync will reject; emit must surface the error via its outer try/catch
  // instead of silently appending past the cap.
  process.env.CHOREO_LOG_MAX_BYTES = String(1024);
  const { emit } = await loadObs();
  const today = new Date().toISOString().slice(0, 10);
  const file = join(tmpLogDir, `${today}.ndjson`);

  writeFileSync(file, 'x'.repeat(2 * 1024)); // pre-fill over cap

  // Remove write bit so renameSync fails.
  const { chmodSync } = await import('node:fs');
  chmodSync(tmpLogDir, 0o500);

  let threw = false;
  try { emit({ type: 'should_fail' }); }
  catch { threw = true; }
  finally { chmodSync(tmpLogDir, 0o700); }

  assert.ok(threw, 'emit throws rather than silently writing past the cap');
  // Active file still at original size — no append occurred past the cap.
  assert.equal(statSync(file).size, 2 * 1024, 'oversized file unchanged');
});
