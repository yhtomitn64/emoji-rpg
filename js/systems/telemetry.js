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
    storage.setItem(STORAGE_KEY, JSON.stringify({ buffer: sessionBuffer, pending: pendingFlushQueue }));
  } catch {
    // localStorage can throw (quota exceeded, private browsing, or - in
    // tests - simply be undefined). The in-memory buffer still works for
    // this session either way, so a failed mirror isn't fatal.
  }
}

// Reads back whatever the previous page-load's session mirrored to storage,
// so a tab closed (or crashed) before it ever flushed doesn't lose that
// session's data outright - it resurfaces in the next session's buffer
// (for Copy Play Log) and pending queue (for the next auto-flush). Also
// accepts the older plain-array format this key used before recovery
// existed, so a leftover live-site mirror from an earlier version doesn't
// just vanish behind a JSON shape it no longer recognizes.
function loadPersisted(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { buffer: [], pending: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { buffer: parsed, pending: [] };
    return {
      buffer: Array.isArray(parsed?.buffer) ? parsed.buffer : [],
      pending: Array.isArray(parsed?.pending) ? parsed.pending : [],
    };
  } catch {
    return { buffer: [], pending: [] };
  }
}

export function startSession({ storage = globalThis.localStorage } = {}) {
  const recovered = loadPersisted(storage);
  sessionId = randomSessionId();
  sessionStartMs = Date.now();
  sessionBuffer = recovered.buffer.slice(-MAX_BUFFERED_EVENTS);
  pendingFlushQueue = recovered.pending.slice();
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
