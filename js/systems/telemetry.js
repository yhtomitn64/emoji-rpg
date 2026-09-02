// js/systems/telemetry.js
export const STORAGE_KEY = 'emoji-rpg-telemetry-buffer';
const TELEMETRY_ENDPOINT = '/__telemetry';
export const MAX_BUFFERED_EVENTS = 2000;
export const FLUSH_EVENT_THRESHOLD = 20;
export const FLUSH_INTERVAL_MS = 10000;

let sessionId = null;
let sessionStartMs = null;
let sessionBuffer = [];
let pendingFlushQueue = [];
let serverAvailable = false;
let flushTimerId = null;

function randomSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

function persistBuffer(storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sessionBuffer));
  } catch {
    // localStorage can throw (quota exceeded, private browsing, or - in
    // tests - simply be undefined). The in-memory buffer still works for
    // this session either way, so a failed mirror isn't fatal.
  }
}

export function startSession({ storage = globalThis.localStorage } = {}) {
  sessionId = randomSessionId();
  sessionStartMs = Date.now();
  sessionBuffer = [];
  pendingFlushQueue = [];
  serverAvailable = false;
  if (flushTimerId) clearInterval(flushTimerId);
  if (typeof setInterval === 'function') {
    flushTimerId = setInterval(() => { flushNow(); }, FLUSH_INTERVAL_MS);
    // Node's Timeout object supports unref() (don't keep the process alive
    // just for this); a browser's numeric timer id doesn't have it, and
    // this no-ops safely there.
    if (typeof flushTimerId?.unref === 'function') flushTimerId.unref();
  }
  persistBuffer(storage);
  return sessionId;
}

export function getElapsedMs() {
  if (sessionStartMs === null) return 0;
  return Date.now() - sessionStartMs;
}

export function logEvent(type, payload = {}, { storage = globalThis.localStorage, fetchImpl = globalThis.fetch } = {}) {
  if (sessionId === null) startSession({ storage });
  const event = {
    ...payload,
    ts: new Date().toISOString(),
    elapsedMs: getElapsedMs(),
    sessionId,
    type,
  };
  sessionBuffer.push(event);
  if (sessionBuffer.length > MAX_BUFFERED_EVENTS) {
    sessionBuffer.splice(0, sessionBuffer.length - MAX_BUFFERED_EVENTS);
  }
  pendingFlushQueue.push(event);
  persistBuffer(storage);
  if (pendingFlushQueue.length >= FLUSH_EVENT_THRESHOLD) {
    flushNow({ fetchImpl, storage });
  }
  return event;
}

export async function flushNow({ fetchImpl = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  if (pendingFlushQueue.length === 0) return;
  const eventsToSend = pendingFlushQueue;
  pendingFlushQueue = [];
  if (!fetchImpl) return;
  try {
    const response = await fetchImpl(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: eventsToSend }),
    });
    if (response && response.ok) serverAvailable = true;
  } catch {
    // Dropped, not retried - a vanished dev server (or the live site,
    // which has none) shouldn't create a retry storm. The events are
    // still safe in sessionBuffer/localStorage for the copy-box fallback.
  }
  persistBuffer(storage);
}

export function getBufferAsJsonl() {
  return sessionBuffer.map((event) => JSON.stringify(event)).join('\n');
}

export function isServerAvailable() {
  return serverAvailable;
}
