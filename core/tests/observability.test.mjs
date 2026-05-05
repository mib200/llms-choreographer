import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, utimesSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { emit, rotate, logPath, readEvents } from '../../core/observability.mjs';

const LOG_DIR = join(homedir(), '.choreo', 'logs');

test('emit writes a valid NDJSON line to today log file', () => {
  const today = new Date().toISOString().slice(0, 10);
  emit({ type: 'test_event', data: 'hello' });

  const events = readEvents(today);
  const last = events[events.length - 1];
  assert.equal(last.type, 'test_event');
  assert.equal(last.data, 'hello');
  assert.ok(last.timestamp, 'event has timestamp');
});

test('emit includes auto-generated timestamp', () => {
  const today = new Date().toISOString().slice(0, 10);
  const before = Date.now();
  emit({ type: 'timestamp_test' });
  const after = Date.now();

  const events = readEvents(today);
  const last = events[events.length - 1];
  const ts = new Date(last.timestamp).getTime();
  assert.ok(ts >= before && ts <= after, 'timestamp is within test window');
});

test('rotate removes files older than 7 days', () => {
  // Create a fake old file
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  const oldDate = '2020-01-01';
  const oldFile = join(LOG_DIR, `${oldDate}.ndjson`);
  writeFileSync(oldFile, '{"type":"old"}\n');

  // Set mtime to 30 days ago
  const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  utimesSync(oldFile, new Date(oldTime), new Date(oldTime));

  rotate();

  assert.ok(!existsSync(oldFile), 'old file was removed');

  // Cleanup: don't leave test artifacts
  if (existsSync(oldFile)) rmSync(oldFile);
});

test('logPath returns today file path', () => {
  const today = new Date().toISOString().slice(0, 10);
  const path = logPath();
  assert.ok(path.endsWith(`${today}.ndjson`), `logPath ends with ${today}.ndjson`);
});
