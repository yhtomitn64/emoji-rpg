import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_LOG_CAP, appendMessage } from '../js/systems/messageLog.js';

test('MESSAGE_LOG_CAP is 50', () => {
  assert.equal(MESSAGE_LOG_CAP, 50);
});

test('appendMessage adds to the end of the log, preserving order', () => {
  const log = appendMessage(['first'], 'second');
  assert.deepEqual(log, ['first', 'second']);
});

test('appendMessage does not mutate the input array', () => {
  const original = ['first'];
  appendMessage(original, 'second');
  assert.deepEqual(original, ['first']);
});

test('appendMessage drops the oldest entry once the cap is exceeded', () => {
  const full = Array.from({ length: MESSAGE_LOG_CAP }, (_, i) => `msg${i}`);
  const next = appendMessage(full, 'newest');
  assert.equal(next.length, MESSAGE_LOG_CAP);
  assert.equal(next[0], 'msg1');
  assert.equal(next[next.length - 1], 'newest');
});

test('appendMessage keeps growing up to exactly the cap without dropping', () => {
  const almostFull = Array.from({ length: MESSAGE_LOG_CAP - 1 }, (_, i) => `msg${i}`);
  const next = appendMessage(almostFull, 'last-room');
  assert.equal(next.length, MESSAGE_LOG_CAP);
  assert.equal(next[0], 'msg0');
  assert.equal(next[next.length - 1], 'last-room');
});
