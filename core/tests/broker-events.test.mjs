import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BufferedEventEmitter } from '../runtime/broker.mjs';

test('BufferedEventEmitter: emit before listener buffers events', () => {
  const ee = new BufferedEventEmitter({ bufferedEvents: new Set(['test_event']) });
  ee.emit('test_event', 'a');
  ee.emit('test_event', 'b');

  const received = [];
  ee.addListener('test_event', (val) => received.push(val));
  assert.deepEqual(received, ['a', 'b']);
});

test('BufferedEventEmitter: addListener drains buffered events', () => {
  const ee = new BufferedEventEmitter({ bufferedEvents: new Set(['x']) });
  ee.emit('x', 1);
  ee.emit('x', 2);

  const vals = [];
  ee.addListener('x', (v) => vals.push(v));
  assert.deepEqual(vals, [1, 2]);

  // Subsequent emits go directly
  ee.emit('x', 3);
  assert.deepEqual(vals, [1, 2, 3]);
});

test('BufferedEventEmitter: once() consumes single buffered event', () => {
  const ee = new BufferedEventEmitter({ bufferedEvents: new Set(['ev']) });
  ee.emit('ev', 'first');
  ee.emit('ev', 'second');

  let received;
  ee.once('ev', (v) => { received = v; });
  // once drains only the first buffered event
  assert.equal(received, 'first');
});

test('BufferedEventEmitter: non-buffered events pass through immediately', () => {
  const ee = new BufferedEventEmitter({ bufferedEvents: new Set(['buffered']) });
  const vals = [];
  ee.addListener('regular', (v) => vals.push(v));
  ee.emit('regular', 'immediate');
  assert.deepEqual(vals, ['immediate']);
});

test('BufferedEventEmitter: buffer cleared after drain (drained set)', () => {
  const ee = new BufferedEventEmitter({ bufferedEvents: new Set(['ev']) });
  ee.emit('ev', 'buffered');

  const first = [];
  ee.addListener('ev', (v) => first.push(v));
  assert.deepEqual(first, ['buffered']);

  // Second listener does NOT get the old buffered events (already drained)
  const second = [];
  ee.addListener('ev', (v) => second.push(v));
  assert.deepEqual(second, []);
});
