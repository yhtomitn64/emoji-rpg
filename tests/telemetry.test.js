// tests/telemetry.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startSession, logEvent, flushNow, getBufferAsJsonl, isServerAvailable,
  STORAGE_KEY, MAX_BUFFERED_EVENTS, FLUSH_EVENT_THRESHOLD,
} from '../js/systems/telemetry.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

function fakeFetch(responses) {
  let call = 0;
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (response === 'reject') throw new Error('network error');
    return response;
  };
  fn.calls = calls;
  return fn;
}

test('logEvent attaches ts/elapsedMs/sessionId/type envelope fields', () => {
  const storage = createFakeStorage();
  const sessionId = startSession({ storage });
  const event = logEvent('battle_end', { outcome: 'won' }, { storage });
  assert.equal(event.type, 'battle_end');
  assert.equal(event.outcome, 'won');
  assert.equal(event.sessionId, sessionId);
  assert.equal(typeof event.ts, 'string');
  assert.equal(typeof event.elapsedMs, 'number');
});

test('sessionBuffer caps at MAX_BUFFERED_EVENTS, trimming oldest first', () => {
  const storage = createFakeStorage();
  startSession({ storage });
  for (let i = 0; i < MAX_BUFFERED_EVENTS + 10; i += 1) {
    logEvent('level_up', { level: i }, { storage, fetchImpl: fakeFetch([{ ok: true }]) });
  }
  const lines = getBufferAsJsonl().split('\n');
  assert.equal(lines.length, MAX_BUFFERED_EVENTS);
  assert.equal(JSON.parse(lines[0]).level, 10); // the oldest 10 were trimmed
});

test('getBufferAsJsonl returns one JSON object per line matching logged events', () => {
  const storage = createFakeStorage();
  startSession({ storage });
  logEvent('tool_acquired', { toolId: 'axe' }, { storage, fetchImpl: fakeFetch([{ ok: true }]) });
  logEvent('tool_acquired', { toolId: 'pick' }, { storage, fetchImpl: fakeFetch([{ ok: true }]) });
  const lines = getBufferAsJsonl().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).toolId, 'axe');
  assert.equal(JSON.parse(lines[1]).toolId, 'pick');
});

test('flushNow posts pending events and marks the server available on success', async () => {
  const storage = createFakeStorage();
  startSession({ storage });
  const neverResolves = () => new Promise(() => {});
  logEvent('ng_plus_started', { newCycle: 1 }, { storage, fetchImpl: neverResolves });
  const fetchImpl = fakeFetch([{ ok: true }]);
  await flushNow({ fetchImpl, storage });
  assert.equal(isServerAvailable(), true);
  assert.equal(fetchImpl.calls.length, 1);
  const body = JSON.parse(fetchImpl.calls[0].options.body);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].newCycle, 1);
});

test('flushNow drops events on a failed post without throwing, and does not mark the server available', async () => {
  const storage = createFakeStorage();
  startSession({ storage });
  const neverResolves = () => new Promise(() => {});
  logEvent('ng_plus_started', { newCycle: 1 }, { storage, fetchImpl: neverResolves });
  await assert.doesNotReject(() => flushNow({ fetchImpl: fakeFetch(['reject']), storage }));
  assert.equal(isServerAvailable(), false);
});

test('logEvent auto-flushes once pending events reach FLUSH_EVENT_THRESHOLD', async () => {
  const storage = createFakeStorage();
  startSession({ storage });
  const fetchImpl = fakeFetch([{ ok: true }]);
  for (let i = 0; i < FLUSH_EVENT_THRESHOLD - 1; i += 1) {
    logEvent('ability_used', { abilityId: 'stab' }, { storage, fetchImpl });
  }
  assert.equal(fetchImpl.calls.length, 0);
  logEvent('ability_used', { abilityId: 'stab' }, { storage, fetchImpl });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(JSON.parse(fetchImpl.calls[0].options.body).events.length, FLUSH_EVENT_THRESHOLD);
});

test('persistBuffer mirrors the buffer to the injected storage', () => {
  const storage = createFakeStorage();
  startSession({ storage });
  const neverResolves = () => new Promise(() => {});
  logEvent('gear_equipped', { itemId: 'ironSword' }, { storage, fetchImpl: neverResolves });
  const stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].itemId, 'ironSword');
});
