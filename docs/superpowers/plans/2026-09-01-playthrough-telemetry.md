# Playthrough Telemetry Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record real playthrough events (levels, fights, drops, gear choices, upgrades, NG+ transitions) to a local file during local dev, and make the same data copyable from the Settings screen everywhere else, so balance decisions can be based on actual play data instead of hunches.

**Architecture:** A single browser-side module (`js/systems/telemetry.js`) buffers structured JSON events and tries to `POST` them to a new zero-dependency local dev server (`tools/dev-server.mjs`, which replaces `python3 -m http.server` and appends to a gitignored `analytics/events.jsonl`). Whether or not that server is present, the Settings screen always offers a "Copy Play Log" button that copies the same buffered events to the clipboard (with a textarea fallback) — the only delivery path on the live, backend-less site. Game code across `main.js` and three screen modules calls one function, `logEvent(type, payload)`, at each point of interest.

**Tech Stack:** Vanilla JS (ES modules), Node built-ins only (`node:http`/`fs`/`path`/`url` — no npm dependency added), `node:test` + jsdom (already in devDependencies) for tests.

**Spec:** `docs/superpowers/specs/2026-09-01-playthrough-telemetry-design.md`

## Global Constraints

- Zero new npm dependencies — `tools/dev-server.mjs` and `js/systems/telemetry.js` use only Node/browser built-ins.
- `analytics/` (the local event log directory) is gitignored — never commit real play data.
- Every event carries the shared envelope: `ts` (ISO string), `elapsedMs` (ms since session start), `sessionId`, `type`.
- A failed `POST /__telemetry` is dropped, never retried — no retry storms if the dev server isn't running.
- This repo's own versioning checklist applies to the final task: `CHANGELOG.md` and `js/data/playerChangelog.js` both need an entry, versions must match (enforced by `tests/versionSync.test.js`), and `npm run test` must pass before this ships.

---

## Task 1: `telemetry.js` core module

**Files:**
- Create: `js/systems/telemetry.js`
- Test: `tests/telemetry.test.js`

**Interfaces:**
- Produces (used by every later task): `startSession({ storage } = {})`, `logEvent(type, payload = {}, { storage, fetchImpl } = {})`, `flushNow({ fetchImpl, storage } = {})`, `getBufferAsJsonl()`, `isServerAvailable()`, `getElapsedMs()`, plus exported constants `STORAGE_KEY`, `MAX_BUFFERED_EVENTS`, `FLUSH_EVENT_THRESHOLD`, `FLUSH_INTERVAL_MS`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/telemetry.test.js`
Expected: FAIL — `Cannot find module '../js/systems/telemetry.js'`

- [ ] **Step 3: Write the implementation**

```js
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
    ts: new Date().toISOString(),
    elapsedMs: getElapsedMs(),
    sessionId,
    type,
    ...payload,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/telemetry.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/telemetry.js tests/telemetry.test.js
git commit -m "feat: add telemetry.js event buffer with local/server flush"
```

---

## Task 2: local dev server with a telemetry endpoint

**Files:**
- Create: `tools/dev-server.mjs`
- Test: `tests/devServer.test.js`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing from Task 1 (this is the server-side counterpart; the browser-side `telemetry.js` POSTs to it over HTTP, no shared code).
- Produces: `appendTelemetryEvents(body, { analyticsFile, analyticsDir } = {})` and `resolveStaticFilePath(requestUrl, rootDir)` (exported for tests), `createDevServer({ rootDir, analyticsFile, analyticsDir } = {})` (used only when run directly, not imported elsewhere in this plan).

- [ ] **Step 1: Write the failing tests**

```js
// tests/devServer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendTelemetryEvents, resolveStaticFilePath } from '../tools/dev-server.mjs';

function tempAnalyticsPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-rpg-telemetry-'));
  return { analyticsDir: dir, analyticsFile: path.join(dir, 'events.jsonl') };
}

test('appendTelemetryEvents writes one JSON line per event, creating the directory if missing', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  fs.rmSync(analyticsDir, { recursive: true, force: true }); // exercise the mkdirSync path
  const body = JSON.stringify({ events: [{ type: 'level_up', level: 2 }, { type: 'level_up', level: 3 }] });
  const result = appendTelemetryEvents(body, { analyticsFile, analyticsDir });
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  const lines = fs.readFileSync(analyticsFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).level, 2);
  assert.equal(JSON.parse(lines[1]).level, 3);
});

test('appendTelemetryEvents appends to an existing file rather than overwriting it', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  appendTelemetryEvents(JSON.stringify({ events: [{ type: 'a' }] }), { analyticsFile, analyticsDir });
  appendTelemetryEvents(JSON.stringify({ events: [{ type: 'b' }] }), { analyticsFile, analyticsDir });
  const lines = fs.readFileSync(analyticsFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});

test('appendTelemetryEvents rejects malformed JSON without throwing', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  const result = appendTelemetryEvents('not json', { analyticsFile, analyticsDir });
  assert.equal(result.ok, false);
});

test('appendTelemetryEvents rejects a body with no events array', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  const result = appendTelemetryEvents(JSON.stringify({ notEvents: [] }), { analyticsFile, analyticsDir });
  assert.equal(result.ok, false);
});

test('resolveStaticFilePath maps / to /index.html under the given root', () => {
  const resolved = resolveStaticFilePath('/', '/repo/root');
  assert.equal(resolved, path.normalize('/repo/root/index.html'));
});

test('resolveStaticFilePath blocks path traversal outside the root', () => {
  const resolved = resolveStaticFilePath('/../../etc/passwd', '/repo/root');
  assert.equal(resolved, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/devServer.test.js`
Expected: FAIL — `Cannot find module '../tools/dev-server.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// tools/dev-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYTICS_DIR = path.join(ROOT_DIR, 'analytics');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'events.jsonl');
const DEFAULT_PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

export function appendTelemetryEvents(body, { analyticsFile = ANALYTICS_FILE, analyticsDir = ANALYTICS_DIR } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
  if (!Array.isArray(parsed.events)) {
    return { ok: false, error: 'Missing events array' };
  }
  fs.mkdirSync(analyticsDir, { recursive: true });
  const lines = parsed.events.map((event) => JSON.stringify(event)).join('\n');
  fs.appendFileSync(analyticsFile, lines ? `${lines}\n` : '');
  return { ok: true, count: parsed.events.length };
}

export function resolveStaticFilePath(requestUrl, rootDir = ROOT_DIR) {
  const urlPath = requestUrl.split('?')[0];
  const relativePath = urlPath === '/' ? '/index.html' : decodeURIComponent(urlPath);
  const resolved = path.normalize(path.join(rootDir, relativePath));
  if (!resolved.startsWith(rootDir)) return null; // blocks path traversal (../)
  return resolved;
}

export function createDevServer({ rootDir = ROOT_DIR, analyticsFile = ANALYTICS_FILE, analyticsDir = ANALYTICS_DIR } = {}) {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__telemetry') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const result = appendTelemetryEvents(body, { analyticsFile, analyticsDir });
        res.writeHead(result.ok ? 204 : 400, { 'Content-Type': 'application/json' });
        res.end(result.ok ? '' : JSON.stringify({ error: result.error }));
      });
      return;
    }

    const filePath = resolveStaticFilePath(req.url, rootDir);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]) || DEFAULT_PORT;
  createDevServer().listen(port, () => {
    console.log(`Serving ${ROOT_DIR} at http://localhost:${port} (POST /__telemetry appends to analytics/events.jsonl)`);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/devServer.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Update `.gitignore`**

Add, after the existing `node_modules/` block:

```gitignore
# Local playthrough telemetry - never commit real play data
analytics/
```

- [ ] **Step 6: Update `README.md`'s "Run it" section**

Replace:

```markdown
## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.
```

with:

```markdown
## Run it

```bash
node tools/dev-server.mjs 8000
```

Then open http://localhost:8000 in a browser. This is a small
zero-dependency static file server (like `python3 -m http.server`,
which still works if you just want to browse) plus one addition: it
accepts playthrough telemetry from the game and appends it to a local,
gitignored `analytics/events.jsonl` — see
`docs/superpowers/specs/2026-09-01-playthrough-telemetry-design.md`.
```

- [ ] **Step 7: Run the full suite and commit**

Run: `npm run test`
Expected: PASS (all tests, including the new `devServer.test.js`)

```bash
git add tools/dev-server.mjs tests/devServer.test.js .gitignore README.md
git commit -m "feat: add local dev server with a /__telemetry endpoint"
```

---

## Task 3: wire `main.js`'s events

`main.js` has no existing test harness (it's the DOM-driving orchestrator, verified across this whole project only by manual browser playthroughs — confirmed by grepping every past plan doc's testing section). This task follows that same established pattern: implement, run the full regression suite, verify manually, commit. Do not invent a jsdom mount for `main.js` — that would be new testing infrastructure out of scope for this plan.

**Files:**
- Modify: `js/main.js:63` (import), `js/main.js:211-219` (`mountStartScreen`), `js/main.js:241-254` (module state), `js/main.js:578-588` (`grantDropItem`), `js/main.js:654-658` (NG+ start), `js/main.js:706` (`handleEncounter`'s battle-start timestamp), `js/main.js:755-771` (`handleBattleEnd`'s `battle_end` log), `js/main.js:832-850` (level-up block), `js/main.js:814`, `:873`, `:893` (the three `rollDrop` call sites)

**Interfaces:**
- Consumes: `logEvent`, `startSession`, `getElapsedMs` from Task 1's `js/systems/telemetry.js`; `getUpgradeLevel` from `js/systems/inventory.js` (already exported, not yet imported here).
- Produces: nothing new consumed by later tasks — this task's events are terminal.

- [ ] **Step 1: Add the import**

In `js/main.js:63`, change:

```js
import { addGold, addItem, spendGold, getEquipmentBonuses, migrateUpgradesToPerTier } from './systems/inventory.js';
```

to:

```js
import { addGold, addItem, spendGold, getEquipmentBonuses, migrateUpgradesToPerTier, getUpgradeLevel } from './systems/inventory.js';
```

and add a new line right after it:

```js
import { startSession, logEvent, getElapsedMs } from './systems/telemetry.js';
```

- [ ] **Step 2: Add module-level trackers**

Near the existing `let activeEncounterMonsterIds = null;` at `js/main.js:254`, add:

```js
let lastLevelUpElapsedMs = 0;
let lastToolElapsedMs = 0;
let activeBattleStartMs = null;
```

- [ ] **Step 3: Log `session_start` at both real entry points**

In `js/main.js:211-219`, change:

```js
function mountStartScreen() {
  mountScreen(startScreen, {
    slots: listSlots(),
    callbacks: {
      onContinue: (slotId) => startGame(loadState(slotId), slotId),
      onNewGame: (name, heroEmoji) => {
        const created = createSlot(name, heroEmoji);
        startGame(created.state, created.id);
      },
```

to:

```js
function mountStartScreen() {
  mountScreen(startScreen, {
    slots: listSlots(),
    callbacks: {
      onContinue: (slotId) => {
        const loaded = loadState(slotId);
        startSession();
        logEvent('session_start', { continuing: true, level: loaded.player.level, ngPlusCycle: loaded.ngPlusCycle });
        startGame(loaded, slotId);
      },
      onNewGame: (name, heroEmoji) => {
        const created = createSlot(name, heroEmoji);
        startSession();
        logEvent('session_start', { continuing: false, level: created.state.player.level, ngPlusCycle: created.state.ngPlusCycle });
        startGame(created.state, created.id);
      },
```

(This deliberately does *not* touch `startGame` itself — it's also called internally on NG+ restart at `js/main.js:657`, which should not re-fire `session_start`; that transition gets its own `ng_plus_started` event in Step 5 below.)

- [ ] **Step 4: Capture the battle start time, and log `battle_end`**

In `js/main.js:706`, change:

```js
function handleEncounter(monsterIds, monsterOverridesList = null) {
```

to:

```js
function handleEncounter(monsterIds, monsterOverridesList = null) {
  activeBattleStartMs = Date.now();
```

(This runs for every path into a fight, including the weak-mob instant-resolve branch further down this same function and boss fights via `startBossFight`'s own call into `handleEncounter` — both are real entry points into `handleBattleEnd` below, and the instant-resolve path correctly logs a ~0ms duration since no real fight happened.)

Then in `js/main.js:755-771`, change:

```js
function handleBattleEnd(outcome, killedMonsterIds) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;
  const encounterMonsterIds = activeEncounterMonsterIds;
  activeEncounterMonsterIds = null;

  // Snapshot effective stats and equipped gear as they stood at the moment combat ended
  // (state.player.hp already reflects the battle's outcome here - battleScreen.js's
  // endBattle() synced it before this callback fires), before any post-battle reward/heal
  // mutations below change them, so the log entry reflects what actually fought this
  // battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
```

to:

```js
function handleBattleEnd(outcome, killedMonsterIds) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;
  const encounterMonsterIds = activeEncounterMonsterIds;
  activeEncounterMonsterIds = null;

  // Snapshot effective stats and equipped gear as they stood at the moment combat ended
  // (state.player.hp already reflects the battle's outcome here - battleScreen.js's
  // endBattle() synced it before this callback fires), before any post-battle reward/heal
  // mutations below change them, so the log entry reflects what actually fought this
  // battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
  const battleDurationMs = activeBattleStartMs === null ? 0 : Date.now() - activeBattleStartMs;
  activeBattleStartMs = null;
  logEvent('battle_end', {
    outcome,
    monsterIds: encounterMonsterIds,
    ngPlusCycle: state.ngPlusCycle,
    playerLevel: state.player.level,
    hpPercentRemaining: Math.max(0, state.player.hp) / (state.player.maxHp + bonuses.maxHp),
    durationMs: battleDurationMs,
  });
```

(`outcome` here is one of `main.js`'s own literal strings — `'won'`, `'surrender'`, `'lost'`, `'fled-with-loot'`, or `'fled'`, confirmed by reading every caller of `handleBattleEnd` — not the plain win/loss/fled split the design doc originally assumed; the design doc has been corrected to match.)

- [ ] **Step 5: Log `tool_acquired`**

In `js/main.js:578-588`, change:

```js
function grantDropItem(itemId, tier) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1, tier));
  const displayName = `${tierLabel(tier)}${item.name}`;
  if (isNewTool) {
    playToolCelebration(item.emoji, `You found a ${displayName}! ${item.description}.`, `${item.description}!`);
  } else {
    playItemPickupToast(item.emoji, displayName);
  }
}
```

to:

```js
function grantDropItem(itemId, tier) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1, tier));
  const displayName = `${tierLabel(tier)}${item.name}`;
  if (isNewTool) {
    const nowElapsed = getElapsedMs();
    logEvent('tool_acquired', { toolId: itemId, level: state.player.level, ngPlusCycle: state.ngPlusCycle, elapsedMsSincePreviousTool: nowElapsed - lastToolElapsedMs });
    lastToolElapsedMs = nowElapsed;
    playToolCelebration(item.emoji, `You found a ${displayName}! ${item.description}.`, `${item.description}!`);
  } else {
    playItemPickupToast(item.emoji, displayName);
  }
}
```

- [ ] **Step 6: Log `ng_plus_started` and an inventory snapshot**

Add this helper function right above `function handleBossBattle()` (`js/main.js:633`):

```js
function logInventorySnapshot() {
  const unequippedGear = state.inventory
    .filter((entry) => ITEMS[entry.itemId].slot)
    .map((entry) => ({ itemId: entry.itemId, tier: entry.tier || null, upgradeLevel: getUpgradeLevel(state, entry.itemId, entry.tier) }));
  const equipment = Object.fromEntries(
    Object.keys(state.equipment).map((slot) => {
      const itemId = state.equipment[slot];
      if (!itemId) return [slot, null];
      const tier = state.equipmentTiers?.[slot];
      return [slot, { itemId, tier: tier || null, upgradeLevel: getUpgradeLevel(state, itemId, tier) }];
    })
  );
  logEvent('inventory_snapshot', { equipment, unequippedGear });
}
```

Then in `js/main.js:654-658`, change:

```js
      onStartNgPlus: () => {
        Object.assign(state, resetWorldForNgPlus(state));
        persist();
        startGame(state, activeSlotId);
      },
```

to:

```js
      onStartNgPlus: () => {
        Object.assign(state, resetWorldForNgPlus(state));
        logEvent('ng_plus_started', { newCycle: state.ngPlusCycle, playerLevel: state.player.level });
        logInventorySnapshot();
        persist();
        startGame(state, activeSlotId);
      },
```

- [ ] **Step 7: Log `item_drop`**

Add this helper next to `logInventorySnapshot` (same location, right above `handleBossBattle`):

```js
function logDropEvent(drop, monsterId) {
  if (drop.item) {
    logEvent('item_drop', { itemId: drop.item, tier: drop.tier || null, sourceMonsterId: monsterId, ngPlusCycle: state.ngPlusCycle });
  }
}
```

Then add one `logDropEvent(drop, monsterId);` call right after each of the three `const drop = rollDrop(...)` lines in `handleBattleEnd`:

- After `js/main.js:814` (`const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);` inside the win/surrender `for (const monsterId of rewardedMonsterIds)` loop): add `logDropEvent(drop, monsterId);` — `monsterId` is already in scope from the loop.
- After `js/main.js:873` (the `fled-with-loot` branch, `const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);`): add `logDropEvent(drop, encounterMonsterIds[0]);` — this branch's own comment already explains `encounterMonsterIds[0]` is the only available monster id here.
- After `js/main.js:893` (the `fled` branch's `for (const monsterId of killedMonsterIds)` loop, `const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);`): add `logDropEvent(drop, monsterId);` — `monsterId` is already in scope from the loop.

- [ ] **Step 8: Log `level_up`, once per level actually gained**

In `handleBattleEnd`'s `if (leveledUpThisBattle) { ... }` block (`js/main.js:832-850`), after the existing ability-unlock `setTimeout` block and before `state.lossStreak = 0;`, add:

```js
      for (let lvl = levelBeforeRewards + 1; lvl <= state.player.level; lvl += 1) {
        const nowElapsed = getElapsedMs();
        logEvent('level_up', { level: lvl, ngPlusCycle: state.ngPlusCycle, elapsedMsSincePreviousLevel: nowElapsed - lastLevelUpElapsedMs });
        lastLevelUpElapsedMs = nowElapsed;
      }
      logInventorySnapshot();
```

(`levelBeforeRewards` is already captured earlier in this function at `js/main.js:793`; `applyXp`'s `while` loop, per `js/systems/leveling.js:27-36`, can cross several levels in one call, which is exactly why this loop — not a single event — is correct here.)

- [ ] **Step 9: Run the full regression suite**

Run: `npm run test`
Expected: PASS (no existing test exercises `main.js` directly, so this is confirming nothing else broke)

- [ ] **Step 10: Manual verification**

Run `node tools/dev-server.mjs 8000`, open `http://localhost:8000`, and:
1. Start a new game. Confirm `analytics/events.jsonl` now exists and contains one `session_start` line.
2. Fight and win a battle that levels you up. Confirm one `battle_end` line (with the real outcome string, e.g. `"won"`) and `level_up`/`inventory_snapshot` lines appear.
3. Flee a fight and confirm its `battle_end` line shows `outcome: "fled"` (or `"fled-with-loot"` for a solo weak-mob auto-resolve) with a `durationMs` near 0 for the instant-resolve case.
4. Find/pick up a tool (or set one up via a fresh save's early game). Confirm a `tool_acquired` line appears, and a *second* pickup of a tool you already have does **not** add another one.
5. Get a monster kill with an item drop. Confirm an `item_drop` line appears with the right `itemId`/`tier`.
6. Beat the dragon and start New Game+. Confirm `ng_plus_started` and a fresh `inventory_snapshot` appear.

- [ ] **Step 11: Commit**

```bash
git add js/main.js
git commit -m "feat: log session/battle/level/tool/drop/NG+ telemetry events from main.js"
```

---

## Task 4: wire `battleScreen.js`'s events

**Files:**
- Modify: `js/screens/battleScreen.js:9` (import), `:697` (`drinkPotion`), `:1482` (`playerUseAbility`)
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `logEvent`, `startSession`, `getBufferAsJsonl` from Task 1.

- [ ] **Step 1: Write the failing tests**

Add these two `t.test` blocks inside the existing `test('battleScreen DOM', ...)` in `tests/battleScreenDom.test.js`, right after the `'drinking a one-shot potion logs a confirmation'` test:

```js
  await t.test('drinking a potion logs a potion_used telemetry event with inBattle true', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const potionEvent = events.find((e) => e.type === 'potion_used');
    assert.ok(potionEvent);
    assert.equal(potionEvent.itemId, 'potion');
    assert.equal(potionEvent.inBattle, true);
  });

  await t.test('using an ability logs an ability_used telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, level: 10 } }),
    });
    click(root.querySelector('#btn-ability-superScream'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const abilityEvent = events.find((e) => e.type === 'ability_used');
    assert.ok(abilityEvent);
    assert.equal(abilityEvent.abilityId, 'superScream');
    assert.equal(abilityEvent.inBattle, true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — both new tests fail with `assert.ok(potionEvent)`/`assert.ok(abilityEvent)` being falsy (no `logEvent` call exists yet)

- [ ] **Step 3: Add the import**

In `js/screens/battleScreen.js`, add after line 9's `buffPotions.js` import:

```js
import { logEvent } from '../systems/telemetry.js';
```

- [ ] **Step 4: Log `potion_used`**

In `js/screens/battleScreen.js:697`, change:

```js
function drinkPotion(itemId) {
  Object.assign(state, removeItem(state, itemId, 1));
```

to:

```js
function drinkPotion(itemId) {
  logEvent('potion_used', { itemId, inBattle: true });
  Object.assign(state, removeItem(state, itemId, 1));
```

- [ ] **Step 5: Log `ability_used`**

In `js/screens/battleScreen.js:1482`, change:

```js
    const ability = ABILITIES.find((a) => a.id === abilityId);
    if (ability.type === 'buff') {
```

to:

```js
    const ability = ABILITIES.find((a) => a.id === abilityId);
    logEvent('ability_used', { abilityId, inBattle: true });
    if (ability.type === 'buff') {
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "feat: log ability_used/potion_used telemetry from battleScreen"
```

---

## Task 5: wire `inventoryScreen.js`'s events

**Files:**
- Modify: `js/screens/inventoryScreen.js:7` (import), `:180-188` (equip handler), `:196-206` (use-potion handler)
- Test: `tests/inventoryScreenDom.test.js`

**Interfaces:**
- Consumes: `logEvent`, `startSession`, `getBufferAsJsonl` from Task 1.

- [ ] **Step 1: Write the failing tests**

Add these two `t.test` blocks at the end of the existing `describe`-style test block in `tests/inventoryScreenDom.test.js` (inside its outer `test(...)` callback, alongside the existing equip/use tests):

```js
  await t.test('equipping gear logs a gear_equipped telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const root = await mountInventory(buildState());
    click(root.querySelector('button[data-equip="ironSword"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const equipEvent = events.find((e) => e.type === 'gear_equipped');
    assert.ok(equipEvent);
    assert.equal(equipEvent.itemId, 'ironSword');
    assert.equal(equipEvent.slot, 'weapon');
    assert.equal(equipEvent.replacedItemId, null);
  });

  await t.test('using the heal potion outside battle logs a potion_used event with inBattle false', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const state = buildState();
    state.player.hp = 5; // below max, so the Use button isn't disabled
    const root = await mountInventory(state);
    click(root.querySelector('button[data-tab="consumable"]'));
    click(root.querySelector('button[data-use="potion"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const potionEvent = events.find((e) => e.type === 'potion_used');
    assert.ok(potionEvent);
    assert.equal(potionEvent.itemId, 'potion');
    assert.equal(potionEvent.inBattle, false);
  });
```

(This file's `buildState()` already includes an unequipped `ironSword` and 3 `potion` entries — see `tests/inventoryScreenDom.test.js:9-27`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/inventoryScreenDom.test.js`
Expected: FAIL — both new tests fail on the `assert.ok(...)` checks

- [ ] **Step 3: Add the import**

In `js/screens/inventoryScreen.js`, add after line 7's `loadout.js` import:

```js
import { logEvent } from '../systems/telemetry.js';
```

- [ ] **Step 4: Log `gear_equipped`**

In `js/screens/inventoryScreen.js:180-188`, change:

```js
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      Object.assign(state, equipItem(state, itemId, btn.dataset.slot, tier));
      callbacks.onChange();
      render();
    };
  });
```

to:

```js
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      const slot = btn.dataset.slot;
      const replacedItemId = state.equipment[slot] || null;
      Object.assign(state, equipItem(state, itemId, slot, tier));
      logEvent('gear_equipped', { itemId, slot, tier: tier || null, upgradeLevel: getUpgradeLevel(state, itemId, tier), replacedItemId });
      callbacks.onChange();
      render();
    };
  });
```

- [ ] **Step 5: Log `potion_used`**

In `js/screens/inventoryScreen.js:196-206`, change:

```js
  rootEl.querySelectorAll('button[data-use]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.use;
      const item = ITEMS[itemId];
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      Object.assign(state, removeItem(state, itemId, 1));
      state.player.hp = applyHeal(state.player.hp, effectiveMaxHp, item.heal);
      callbacks.onChange();
      render();
    };
  });
```

to:

```js
  rootEl.querySelectorAll('button[data-use]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.use;
      const item = ITEMS[itemId];
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      Object.assign(state, removeItem(state, itemId, 1));
      state.player.hp = applyHeal(state.player.hp, effectiveMaxHp, item.heal);
      logEvent('potion_used', { itemId, inBattle: false });
      callbacks.onChange();
      render();
    };
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/inventoryScreenDom.test.js`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 7: Commit**

```bash
git add js/screens/inventoryScreen.js tests/inventoryScreenDom.test.js
git commit -m "feat: log gear_equipped/potion_used telemetry from inventoryScreen"
```

---

## Task 6: wire `smithScreen.js`'s `upgrade_purchased` event

**Files:**
- Modify: `js/screens/smithScreen.js:3-6` (import), `:104-122` (`tryUpgrade`)
- Test: `tests/smithScreenDom.test.js`

**Interfaces:**
- Consumes: `logEvent`, `startSession`, `getBufferAsJsonl` from Task 1.

- [ ] **Step 1: Write the failing test**

Add this `t.test` block inside the existing `test('smithScreen reforge DOM', ...)` block in `tests/smithScreenDom.test.js`, after the existing reforge tests:

```js
  await t.test('a successful upgrade logs an upgrade_purchased telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const root = await mountSmith(buildState({ inventory: [{ itemId: 'ironScrap', quantity: 1 }] }));
    const select = root.querySelector('select[data-slot="weapon"]');
    select.value = 'ironScrap';
    click(root.querySelector('button[data-slot="weapon"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const upgradeEvent = events.find((e) => e.type === 'upgrade_purchased');
    assert.ok(upgradeEvent);
    assert.equal(upgradeEvent.itemId, 'ironSword');
    assert.equal(upgradeEvent.slot, 'weapon');
    assert.equal(upgradeEvent.newLevel, 1);
    assert.equal(upgradeEvent.goldSpent, 20);
  });
```

(This file's `buildState()` already gives 500 gold and an equipped `ironSword` at Superior tier — `tests/smithScreenDom.test.js:8-18`. `ironScrap`'s `upgradeSlot` is `weapon`, matching the existing pattern in `tests/inventory.test.js`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/smithScreenDom.test.js`
Expected: FAIL — `assert.ok(upgradeEvent)` is falsy

- [ ] **Step 3: Add the import**

In `js/screens/smithScreen.js:3-6`, change:

```js
import {
  upgradeCost, upgradeItem, describeItem, getUpgradeLevel,
  canReforgeToMythic, reforgeToMythic, REFORGE_GOLD_COST, REFORGE_ESSENCE_COST,
} from '../systems/inventory.js';
```

to:

```js
import {
  upgradeCost, upgradeItem, describeItem, getUpgradeLevel,
  canReforgeToMythic, reforgeToMythic, REFORGE_GOLD_COST, REFORGE_ESSENCE_COST,
} from '../systems/inventory.js';
import { logEvent } from '../systems/telemetry.js';
```

- [ ] **Step 4: Log `upgrade_purchased`**

In `js/screens/smithScreen.js:104-122` (`tryUpgrade`), change:

```js
  try {
    const next = upgradeItem(state, slot, materialId, cost);
    Object.assign(state, next);
    callbacks.onUpgrade();
  } catch {
```

to:

```js
  try {
    const next = upgradeItem(state, slot, materialId, cost);
    Object.assign(state, next);
    logEvent('upgrade_purchased', { itemId, slot, tier: tier || null, newLevel: level + 1, goldSpent: cost });
    callbacks.onUpgrade();
  } catch {
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/smithScreenDom.test.js`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 6: Commit**

```bash
git add js/screens/smithScreen.js tests/smithScreenDom.test.js
git commit -m "feat: log upgrade_purchased telemetry from smithScreen"
```

---

## Task 7: "Copy Play Log" button in Settings

**Files:**
- Modify: `js/screens/settingsScreen.js` (whole file — it's 54 lines, small enough to show in full below)
- Test: `tests/settingsScreenDom.test.js`

**Interfaces:**
- Consumes: `getBufferAsJsonl` from Task 1.

- [ ] **Step 1: Write the failing tests**

Add these two `t.test` blocks inside the existing `test('settingsScreen DOM', ...)` block in `tests/settingsScreenDom.test.js`, after the existing tests:

```js
  await t.test('Copy Play Log copies buffered events via the Clipboard API when available', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('level_up', { level: 2 });
    let copiedText = null;
    window.navigator.clipboard = { writeText: async (text) => { copiedText = text; } };
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(copiedText.includes('"level":2'));
    assert.equal(root.querySelector('#play-log-fallback').hidden, true);
  });

  await t.test('Copy Play Log falls back to a visible textarea when the Clipboard API is unavailable', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('tool_acquired', { toolId: 'axe' });
    // jsdom has no navigator.clipboard by default - exercises the fallback path.
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fallback = root.querySelector('#play-log-fallback');
    assert.equal(fallback.hidden, false);
    assert.ok(fallback.value.includes('"toolId":"axe"'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/settingsScreenDom.test.js`
Expected: FAIL — `root.querySelector('#btn-copy-play-log')` is `null`, so `click(null)` throws

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `js/screens/settingsScreen.js` with:

```js
import { DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { getBufferAsJsonl } from '../systems/telemetry.js';

const ITEM_MENU_AUTO_CLOSE_MIN_MS = 250;
const ITEM_MENU_AUTO_CLOSE_MAX_MS = 5000;

let rootEl = null;
let state = null;
let callbacks = null;

async function copyPlayLog() {
  const jsonl = getBufferAsJsonl();
  const statusEl = document.getElementById('play-log-status');
  const fallbackEl = document.getElementById('play-log-fallback');
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(jsonl);
      fallbackEl.hidden = true;
      statusEl.hidden = false;
      statusEl.textContent = 'Copied!';
      return;
    } catch {
      // Fall through to the textarea fallback below - denied permission
      // behaves the same as no Clipboard API at all.
    }
  }
  fallbackEl.value = jsonl;
  fallbackEl.hidden = false;
  fallbackEl.select();
  statusEl.hidden = true;
}

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel settings-panel">
      <h2>Settings</h2>
      <div class="settings-row">
        <label for="settings-item-menu-auto-close">
          Battle item menu auto-close (ms)
        </label>
        <input
          type="number"
          id="settings-item-menu-auto-close"
          min="${ITEM_MENU_AUTO_CLOSE_MIN_MS}"
          max="${ITEM_MENU_AUTO_CLOSE_MAX_MS}"
          step="50"
          value="${state.settings.itemMenuAutoCloseMs}"
        />
      </div>
      <div class="settings-row settings-play-log">
        <span>Play Log</span>
        <button id="btn-copy-play-log">Copy Play Log</button>
        <span id="play-log-status" hidden></span>
      </div>
      <textarea id="play-log-fallback" readonly hidden></textarea>
      <button id="btn-close-settings">Close</button>
    </div>
  `;

  const input = document.getElementById('settings-item-menu-auto-close');
  input.onchange = () => {
    // `Number(input.value) || DEFAULT` would be wrong here - 0 is a valid
    // (if useless) numeric value and is falsy, so that pattern would
    // silently reset it to the default instead of clamping it to the min.
    const raw = Number(input.value);
    const numeric = Number.isNaN(raw) ? DEFAULT_ITEM_MENU_AUTO_CLOSE_MS : raw;
    const clamped = Math.min(ITEM_MENU_AUTO_CLOSE_MAX_MS, Math.max(ITEM_MENU_AUTO_CLOSE_MIN_MS, numeric));
    input.value = clamped;
    state.settings = { ...state.settings, itemMenuAutoCloseMs: clamped };
    callbacks.onChange();
  };
  document.getElementById('btn-copy-play-log').onclick = () => copyPlayLog();
  document.getElementById('btn-close-settings').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/settingsScreenDom.test.js`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add js/screens/settingsScreen.js tests/settingsScreenDom.test.js
git commit -m "feat: add Copy Play Log button to Settings screen"
```

---

## Task 8: changelog, version bump, final regression pass

This is a new system (telemetry logging + a new Settings UI element), which per `CHANGELOG.md`'s own header rules is a **MINOR** bump, not a PATCH.

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

**Interfaces:** none — this task only touches docs/version metadata.

- [ ] **Step 1: Update `CHANGELOG.md`**

Change:

```markdown
## [Unreleased]

## [0.16.3] - 2026-09-01
```

to:

```markdown
## [Unreleased]

## [0.17.0] - 2026-09-01

### Added
- Playthrough telemetry logging (`js/systems/telemetry.js`): the game now
  records level-ups, tool pickups, battle outcomes, ability/potion use,
  gear-equip choices, item drops, smith upgrades, and NG+ transitions to
  an in-memory/localStorage-backed session buffer. `tools/dev-server.mjs`
  (a new zero-dependency Node static server, replacing `python3 -m
  http.server` for local dev - see README) accepts `POST /__telemetry`
  and appends events as newline-delimited JSON to a gitignored
  `analytics/events.jsonl`. The Settings screen's new "Copy Play Log"
  button copies the current session's buffered events (via the
  Clipboard API, falling back to a selectable textarea) regardless of
  whether the dev server is running - the only delivery path on the
  live site, which has no backend. See
  `docs/superpowers/specs/2026-09-01-playthrough-telemetry-design.md`.

## [0.16.3] - 2026-09-01
```

- [ ] **Step 2: Update `js/data/playerChangelog.js`**

Change:

```js
export const PLAYER_CHANGELOG = [
  {
    version: '0.16.3',
```

to:

```js
export const PLAYER_CHANGELOG = [
  {
    version: '0.17.0',
    date: '2026-09-01',
    highlights: [
      'New: a "Copy Play Log" button in Settings - copies a record of your current session (levels, fights, drops, gear equipped, upgrades) to your clipboard so it can be shared for balance feedback.',
    ],
  },
  {
    version: '0.16.3',
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS (every test, including `tests/versionSync.test.js` confirming `CHANGELOG.md`'s newest version and `PLAYER_CHANGELOG[0].version` both read `0.17.0`)

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js
git commit -m "docs: changelog + version bump for playthrough telemetry (0.17.0)"
```
