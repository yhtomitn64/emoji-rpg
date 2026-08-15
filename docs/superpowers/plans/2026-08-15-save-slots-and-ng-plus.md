# Save Slots & New Game+ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the game's single fixed-key `localStorage` save with named, multi-slot saves behind a character-select start screen, then — reusing that slot infrastructure — add a capped, repeatable New Game+ mode that resets world progress while keeping the player's power, in exchange for tougher monsters and better rewards.

**Architecture:** Two independent, sequential phases sharing one plan. **Phase A (Tasks 1-4)** makes `js/state.js`'s save/load slot-aware, adds a pure `js/systems/saveSlots.js` registry (mirrors the existing `caches.js`/`miniDungeons.js` pure-module pattern), adds a `js/screens/startScreen.js` character-select screen, and restructures `main.js`'s module-load-time bootstrapping into an explicit `startGame(state, slotId)` called after a slot is chosen. **Phase B (Tasks 5-8)** adds a pure `js/systems/ngPlus.js` (mirrors the already-shipped `bossTiers.js`) for capped per-cycle stat/reward scaling and a world-preserving-player reset, extends the existing `bossPromptScreen.js` with a third opt-in path, and wires NG+ scaling into the same `handleEncounter`/`handleBattleEnd` chokepoints the boss-tier system already uses — so NG+ composes with boss-tier scaling automatically rather than requiring every call site to know about it.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Storage keys: `emoji-rpg-slots` (registry array), `emoji-rpg-save-<slotId>` (per-slot state), `emoji-rpg-save` (legacy single-save key, read once for migration then deleted).
- `saveState`/`loadState` in `js/state.js` require a `slotId` as their second parameter after this plan — every existing call site in `main.js` is updated in Task 4.
- `MAX_NG_PLUS_CYCLE = 2`. Cycles are `0` (base), `1`, `2` (max).
- NG+ per-cycle multipliers (compounding, `Math.round`ed where they feed integer stats): monster HP `×2`, monster attack/defense `×1.25`, monster speed unchanged, gold/XP reward `×1.5`, drop-table chance per entry `×1.5` capped at `0.9`.
- At `ngPlusCycle: 0`, every NG+-derived function is a no-op (returns the input unchanged) — a player who never touches NG+ sees zero behavior change.
- NG+ combat scaling composes with the existing boss-tier scaling multiplicatively (base → boss-tier → NG+), never stacks unboundedly, because `resetWorldForNgPlus` always resets `bossTier` to `0`.
- What NG+ resets: `flags.dungeonBossDefeated`, `visited`, `seenScreens`, `caches`, `miniDungeons`, `activeMiniDungeon`, `bossTier`, `map` (→ `'center'`), `position` (→ `null`). What it preserves: `player`, `equipment`, `upgrades`, `inventory`.
- No native `confirm()`/`prompt()` dialogs anywhere in the new UI — slot deletion and New Game naming use inline DOM state instead.
- No slot renaming after creation. No content past the dragon. No uncapped NG+.

---

### Task 1: `js/state.js` — slot-aware save/load, `ngPlusCycle` field

**Files:**
- Modify: `js/state.js`
- Modify: `tests/state.test.js`

**Interfaces:**
- Produces: `slotSaveKey(slotId)` → string; `saveState(state, slotId, storage = globalThis.localStorage)`; `loadState(slotId, storage = globalThis.localStorage)`; `createNewGame()` now includes `ngPlusCycle: 0`. `STORAGE_KEY` (unchanged export, now used only as the legacy migration key). Task 2's `saveSlots.js` imports `slotSaveKey`, `STORAGE_KEY`, `createNewGame`, `saveState`, `deserializeState` from this file (its own test file separately imports `loadState` to verify round-trips).
- **Note for whoever runs Task 4:** after this task, `main.js`'s existing `saveState(state)`/`loadState()` calls (1-arg / 0-arg) still compile but silently read/write the wrong storage key (`slotId` becomes `undefined`) until Task 4 updates every call site. This is expected — do not manually playtest the game between this task and Task 4.

- [ ] **Step 1: Write the failing tests**

In `tests/state.test.js`, replace the entire file with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, serializeState, deserializeState, saveState, loadState, slotSaveKey } from '../js/state.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('createNewGame returns a fresh default state', () => {
  const state = createNewGame();
  assert.equal(state.player.level, 1);
  assert.equal(state.player.gold, 20);
  assert.equal(state.map, 'center');
  assert.equal(state.equipment.weapon, 'starterSword');
  assert.deepEqual(state.caches, {});
  assert.deepEqual(state.miniDungeons, {});
  assert.equal(state.activeMiniDungeon, null);
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
});

test('serializeState and deserializeState round-trip', () => {
  const state = createNewGame();
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('slotSaveKey builds a per-slot storage key', () => {
  assert.equal(slotSaveKey('abc123'), 'emoji-rpg-save-abc123');
});

test('saveState writes to a slot-specific key and loadState reads it back', () => {
  const storage = createFakeStorage();
  const state = createNewGame();
  state.player.gold = 42;
  saveState(state, 'slot-1', storage);
  const loaded = loadState('slot-1', storage);
  assert.equal(loaded.player.gold, 42);
});

test('saveState for one slot does not affect another slot', () => {
  const storage = createFakeStorage();
  const stateA = createNewGame();
  stateA.player.gold = 10;
  const stateB = createNewGame();
  stateB.player.gold = 20;
  saveState(stateA, 'slot-a', storage);
  saveState(stateB, 'slot-b', storage);
  assert.equal(loadState('slot-a', storage).player.gold, 10);
  assert.equal(loadState('slot-b', storage).player.gold, 20);
});

test('loadState returns null when nothing saved for that slot', () => {
  const storage = createFakeStorage();
  assert.equal(loadState('slot-1', storage), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `slotSaveKey` is not exported yet, and `saveState`/`loadState`'s old 2-arg/1-arg signatures don't match the new calls.

- [ ] **Step 3: Update `js/state.js`**

Change the entire file to:

```js
export const STORAGE_KEY = 'emoji-rpg-save';

export function createNewGame() {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20 },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null },
    upgrades: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    ngPlusCycle: 0,
  };
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  return JSON.parse(json);
}

export function slotSaveKey(slotId) {
  return `emoji-rpg-save-${slotId}`;
}

export function saveState(state, slotId, storage = globalThis.localStorage) {
  storage.setItem(slotSaveKey(slotId), serializeState(state));
}

export function loadState(slotId, storage = globalThis.localStorage) {
  const raw = storage.getItem(slotSaveKey(slotId));
  if (!raw) return null;
  return deserializeState(raw);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 7 tests in `tests/state.test.js` plus the full existing suite (other suites are unaffected since nothing else imports `state.js` yet in a way that calls `saveState`/`loadState` — `main.js` isn't test-covered).

- [ ] **Step 5: Commit**

```bash
git add js/state.js tests/state.test.js
git commit -m "feat: make save/load slot-aware and add ngPlusCycle to save state"
```

---

### Task 2: `js/systems/saveSlots.js` — pure slot registry and legacy migration

**Files:**
- Create: `js/systems/saveSlots.js`
- Test: `tests/saveSlots.test.js`

**Interfaces:**
- Consumes: `createNewGame`, `saveState`, `slotSaveKey`, `STORAGE_KEY`, `deserializeState` from `js/state.js` (Task 1). (The test file also imports `loadState` directly from `js/state.js` to verify round-trips — `saveSlots.js` itself never needs to load a slot's state, only to write it.)
- Produces: `listSlots(storage)` → array of `{id, name, createdAt, lastPlayed, level, ngPlusCycle}`; `createSlot(name, storage)` → `{id, state}`; `deleteSlot(id, storage)` → void; `touchSlot(id, {level, ngPlusCycle}, storage)` → void; `migrateLegacySave(storage)` → void. All default `storage` to `globalThis.localStorage`. Task 4 imports all five.

- [ ] **Step 1: Write the failing tests**

Create `tests/saveSlots.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from '../js/systems/saveSlots.js';
import { STORAGE_KEY, serializeState, createNewGame, loadState } from '../js/state.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

test('listSlots returns an empty array when nothing has been created', () => {
  const storage = createFakeStorage();
  assert.deepEqual(listSlots(storage), []);
});

test('createSlot adds a registry entry and a fresh save', () => {
  const storage = createFakeStorage();
  const { id, state } = createSlot('Hero', storage);
  assert.equal(state.player.level, 1);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, id);
  assert.equal(slots[0].name, 'Hero');
  assert.equal(slots[0].level, 1);
  assert.equal(slots[0].ngPlusCycle, 0);
  const loaded = loadState(id, storage);
  assert.equal(loaded.player.level, 1);
});

test('createSlot generates unique ids across calls', () => {
  const storage = createFakeStorage();
  const first = createSlot('One', storage);
  const second = createSlot('Two', storage);
  assert.notEqual(first.id, second.id);
});

test('deleteSlot removes the registry entry and the save', () => {
  const storage = createFakeStorage();
  const { id } = createSlot('Hero', storage);
  deleteSlot(id, storage);
  assert.deepEqual(listSlots(storage), []);
  assert.equal(loadState(id, storage), null);
});

test('deleteSlot leaves other slots untouched', () => {
  const storage = createFakeStorage();
  const { id: keepId } = createSlot('Keep', storage);
  const { id: deleteId } = createSlot('Delete', storage);
  deleteSlot(deleteId, storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, keepId);
  assert.notEqual(loadState(keepId, storage), null);
});

test('touchSlot updates level, ngPlusCycle, and lastPlayed for the matching slot', () => {
  const storage = createFakeStorage();
  const { id } = createSlot('Hero', storage);
  const before = listSlots(storage)[0].lastPlayed;
  touchSlot(id, { level: 5, ngPlusCycle: 1 }, storage);
  const after = listSlots(storage)[0];
  assert.equal(after.level, 5);
  assert.equal(after.ngPlusCycle, 1);
  assert.ok(after.lastPlayed >= before);
});

test('touchSlot on an unknown id is a no-op', () => {
  const storage = createFakeStorage();
  createSlot('Hero', storage);
  touchSlot('nonexistent', { level: 5, ngPlusCycle: 1 }, storage);
  assert.equal(listSlots(storage).length, 1);
  assert.equal(listSlots(storage)[0].level, 1);
});

test('migrateLegacySave imports an existing legacy save into a named slot and removes the old key', () => {
  const storage = createFakeStorage();
  const legacy = createNewGame();
  legacy.player.gold = 99;
  storage.setItem(STORAGE_KEY, serializeState(legacy));
  migrateLegacySave(storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].name, 'Save');
  const loaded = loadState(slots[0].id, storage);
  assert.equal(loaded.player.gold, 99);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('migrateLegacySave is a no-op when there is no legacy save', () => {
  const storage = createFakeStorage();
  migrateLegacySave(storage);
  assert.deepEqual(listSlots(storage), []);
});

test('migrateLegacySave is a no-op when a registry already exists', () => {
  const storage = createFakeStorage();
  createSlot('Existing', storage);
  const legacy = createNewGame();
  storage.setItem(STORAGE_KEY, serializeState(legacy));
  migrateLegacySave(storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].name, 'Existing');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/saveSlots.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/saveSlots.js`**

```js
import { createNewGame, saveState, slotSaveKey, STORAGE_KEY, deserializeState } from '../state.js';

const SLOTS_KEY = 'emoji-rpg-slots';

function readRegistry(storage) {
  const raw = storage.getItem(SLOTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeRegistry(entries, storage) {
  storage.setItem(SLOTS_KEY, JSON.stringify(entries));
}

function generateSlotId() {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listSlots(storage = globalThis.localStorage) {
  return readRegistry(storage);
}

export function createSlot(name, storage = globalThis.localStorage) {
  const id = generateSlotId();
  const state = createNewGame();
  const now = Date.now();
  const entries = readRegistry(storage);
  entries.push({ id, name, createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle });
  writeRegistry(entries, storage);
  saveState(state, id, storage);
  return { id, state };
}

export function deleteSlot(id, storage = globalThis.localStorage) {
  const entries = readRegistry(storage).filter((entry) => entry.id !== id);
  writeRegistry(entries, storage);
  storage.removeItem(slotSaveKey(id));
}

export function touchSlot(id, summary, storage = globalThis.localStorage) {
  const entries = readRegistry(storage);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  entry.lastPlayed = Date.now();
  entry.level = summary.level;
  entry.ngPlusCycle = summary.ngPlusCycle;
  writeRegistry(entries, storage);
}

export function migrateLegacySave(storage = globalThis.localStorage) {
  if (storage.getItem(SLOTS_KEY)) return;
  const legacyRaw = storage.getItem(STORAGE_KEY);
  if (!legacyRaw) return;
  const state = deserializeState(legacyRaw);
  const id = generateSlotId();
  const now = Date.now();
  writeRegistry([{ id, name: 'Save', createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle || 0 }], storage);
  saveState(state, id, storage);
  storage.removeItem(STORAGE_KEY);
}
```

Note the import path is `'../state.js'` — this file lives in `js/systems/`, one directory below `js/`, matching every other file in `js/systems/` (e.g. `js/systems/inventory.js` imports `'../data/items.js'` the same way).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 10 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/saveSlots.js tests/saveSlots.test.js
git commit -m "feat: add save-slot registry and legacy-save migration"
```

---

### Task 3: `js/screens/startScreen.js` — character-select screen

**Files:**
- Create: `js/screens/startScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 directly (Task 4 supplies the slot list and callbacks at mount time).
- Produces: `mount(root, props)` where `props` is `{ slots: Array<{id, name, level, ngPlusCycle, lastPlayed}>, callbacks: { onContinue(slotId), onNewGame(name), onDelete(slotId) } }`, and `unmount()`. Follows the same shape as every other screen module in this project, so it works with the existing `mountScreen` in `js/screens/screenManager.js` with no changes there.

This module has no dedicated automated test — it's pure DOM rendering driven entirely by props and callbacks supplied from outside, matching `shopScreen.js`/`smithScreen.js`/`statsPanel.js`, none of which have test files either.

- [ ] **Step 1: Create `js/screens/startScreen.js`**

```js
let rootEl = null;
let slots = [];
let callbacks = null;
let confirmDeleteId = null;
let newGameOpen = false;

function formatLastPlayed(timestamp) {
  const diffMin = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function renderSlotRow(slot) {
  const ngBadge = slot.ngPlusCycle > 0 ? ` <span class="slot-ngplus-badge">NG+${slot.ngPlusCycle}</span>` : '';
  const deleteControls = confirmDeleteId === slot.id
    ? `<button data-confirm-delete="${slot.id}">Confirm delete?</button><button data-cancel-delete="${slot.id}">Cancel</button>`
    : `<button data-delete="${slot.id}">Delete</button>`;
  return `
    <div class="slot-row">
      <div class="slot-info">
        <div class="slot-name">${slot.name}${ngBadge}</div>
        <div class="slot-meta">Level ${slot.level} &middot; ${formatLastPlayed(slot.lastPlayed)}</div>
      </div>
      <div class="slot-actions">
        <button data-continue="${slot.id}">Continue</button>
        ${deleteControls}
      </div>
    </div>
  `;
}

function render() {
  const slotRows = slots.map(renderSlotRow).join('');
  const newGameSection = newGameOpen
    ? `<div class="new-game-row">
        <input type="text" id="new-game-name" placeholder="Character name" />
        <button id="btn-create-slot">Create</button>
      </div>`
    : `<button id="btn-open-new-game">+ New Game</button>`;

  rootEl.innerHTML = `
    <div class="start-screen">
      <h1>Emoji RPG</h1>
      ${slotRows || '<div class="no-slots">No saves yet.</div>'}
      ${newGameSection}
    </div>
  `;

  slots.forEach((slot) => {
    rootEl.querySelector(`[data-continue="${slot.id}"]`).onclick = () => callbacks.onContinue(slot.id);
    if (confirmDeleteId === slot.id) {
      rootEl.querySelector(`[data-confirm-delete="${slot.id}"]`).onclick = () => callbacks.onDelete(slot.id);
      rootEl.querySelector(`[data-cancel-delete="${slot.id}"]`).onclick = () => {
        confirmDeleteId = null;
        render();
      };
    } else {
      rootEl.querySelector(`[data-delete="${slot.id}"]`).onclick = () => {
        confirmDeleteId = slot.id;
        render();
      };
    }
  });

  if (newGameOpen) {
    const input = document.getElementById('new-game-name');
    input.focus();
    document.getElementById('btn-create-slot').onclick = () => {
      const name = input.value.trim() || 'New Game';
      callbacks.onNewGame(name);
    };
  } else {
    document.getElementById('btn-open-new-game').onclick = () => {
      newGameOpen = true;
      render();
    };
  }
}

export function mount(root, props) {
  rootEl = root;
  slots = props.slots;
  callbacks = props.callbacks;
  confirmDeleteId = null;
  newGameOpen = false;
  render();
}

export function unmount() {}
```

- [ ] **Step 2: Add start-screen CSS to `css/styles.css`**

Change:

```css
.shop-screen, .smith-screen {
  max-width: 480px;
  margin: 0 auto;
}
```

to:

```css
.shop-screen, .smith-screen, .start-screen {
  max-width: 480px;
  margin: 0 auto;
}
```

Change:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

to:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave, .start-screen button {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

Then add these new rules anywhere after the `.shop-row, .smith-row` block:

```css
.slot-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid #444;
}
.slot-name { font-weight: 600; }
.slot-meta { font-size: 0.8rem; color: #aaa; }
.slot-ngplus-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #6c3fa1;
  font-size: 0.7rem;
}
.no-slots { color: #888; padding: 12px 0; }
.new-game-row { display: flex; gap: 8px; margin-top: 12px; }
.new-game-row input { flex: 1; padding: 6px; font-size: 1rem; }
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this file adds no new tests and isn't imported by anything yet — it's inert until Task 4 wires it in).

- [ ] **Step 4: Commit**

```bash
git add js/screens/startScreen.js css/styles.css
git commit -m "feat: add character-select start screen"
```

---

### Task 4: Wire multi-slot save/load and the start screen into `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `listSlots`, `createSlot`, `deleteSlot`, `touchSlot`, `migrateLegacySave` from `js/systems/saveSlots.js` (Task 2); `startScreen` module (Task 3); `saveState`/`loadState`'s new slot-aware signatures (Task 1).
- Produces: module-level `state` (now `let`, initialized `null` until a slot is chosen) and `activeSlotId` (`let`, initialized `null`); `startGame(loadedState, slotId)` — runs today's load-time backfill/position logic then starts the game; `mountStartScreen()` — mounts the character-select screen with fresh slot data; `persist()` — the single place that both saves the active slot's state and updates its registry summary, replacing every direct `saveState(state)` call in this file.

This task has no dedicated automated test — matches every other `main.js`/DOM-orchestration task in this project's history (no test harness exists for this file). Correctness rests on Tasks 1-3's own tests plus the manual verification in Step 6.

- [ ] **Step 1: Update imports**

Change:

```js
import { createNewGame, loadState, saveState } from './state.js';
```

to:

```js
import { loadState, saveState } from './state.js';
```

Change:

```js
import * as statsPanel from './screens/statsPanel.js';
```

to:

```js
import * as statsPanel from './screens/statsPanel.js';
import * as startScreen from './screens/startScreen.js';
```

Change:

```js
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
```

to:

```js
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
```

- [ ] **Step 2: Replace the module-load-time bootstrap block**

Change (this is everything from the `const state = ...` line through the last backfill `if`, i.e. the original lines 51-79):

```js
const state = loadState() || createNewGame();
if (state.map === 'overworld') {
  state.map = 'center';
  state.position = null;
}
if (!state.position) {
  state.position = { ...MAPS[state.map].startPosition };
}
if (!isWalkableAt(MAPS[state.map], state.position.x, state.position.y)) {
  state.position = { ...MAPS[state.map].startPosition };
}
if (!state.visited) {
  state.visited = {};
}
if (!state.seenScreens) {
  state.seenScreens = {};
}
if (!state.caches) {
  state.caches = {};
}
if (!state.miniDungeons) {
  state.miniDungeons = {};
}
if (!state.activeMiniDungeon) {
  state.activeMiniDungeon = null;
}
if (!state.bossTier) {
  state.bossTier = 0;
}
```

to:

```js
let state = null;
let activeSlotId = null;

function startGame(loadedState, slotId) {
  state = loadedState;
  activeSlotId = slotId;
  if (state.map === 'overworld') {
    state.map = 'center';
    state.position = null;
  }
  if (!state.position) {
    state.position = { ...MAPS[state.map].startPosition };
  }
  if (!isWalkableAt(MAPS[state.map], state.position.x, state.position.y)) {
    state.position = { ...MAPS[state.map].startPosition };
  }
  if (!state.visited) {
    state.visited = {};
  }
  if (!state.seenScreens) {
    state.seenScreens = {};
  }
  if (!state.caches) {
    state.caches = {};
  }
  if (!state.miniDungeons) {
    state.miniDungeons = {};
  }
  if (!state.activeMiniDungeon) {
    state.activeMiniDungeon = null;
  }
  if (!state.bossTier) {
    state.bossTier = 0;
  }
  if (!state.ngPlusCycle) {
    state.ngPlusCycle = 0;
  }
  renderHud();
  goToMap(state.map);
}

function mountStartScreen() {
  mountScreen(startScreen, {
    slots: listSlots(),
    callbacks: {
      onContinue: (slotId) => startGame(loadState(slotId), slotId),
      onNewGame: (name) => {
        const created = createSlot(name);
        startGame(created.state, created.id);
      },
      onDelete: (slotId) => {
        deleteSlot(slotId);
        mountStartScreen();
      },
    },
  });
}

function persist() {
  saveState(state, activeSlotId);
  touchSlot(activeSlotId, { level: state.player.level, ngPlusCycle: state.ngPlusCycle });
}
```

- [ ] **Step 3: Replace every `saveState(state)` call with `persist()`**

In `js/main.js`, there are 14 occurrences of the exact substring `saveState(state)` below the block just replaced (inside `goToMap`, `enterMap`, `handleEdgeTransition`, `handleFirstVisit`, `handleCacheFound`, `handleEnterMiniDungeon`, `handleExitMiniDungeon`, `handleTreasureFound`, `handleBossBattle`'s `onAccept`, `goToShop`'s `onPurchase`, `goToSmith`'s `onUpgrade`, and three places in `handleBattleEnd`). Replace each occurrence of the substring `saveState(state)` with `persist()` — leave everything else on each line (semicolons, surrounding braces, `renderHud()` calls) exactly as-is.

Verify you got all of them:

Run: `grep -c "saveState(state)" js/main.js`
Expected: `0` (no remaining bare calls — note `persist()`'s own body calls `saveState(state, activeSlotId)`, which does NOT match this exact substring since a comma follows `state`, so this check correctly stays at zero).

Run: `grep -c "persist()" js/main.js`
Expected: `15` — the 14 replaced call sites plus the one `function persist() {` definition line from Step 2.

- [ ] **Step 4: Replace the bottom-of-file game start with the start-screen boot**

Change the final two lines of the file:

```js
renderHud();
goToMap(state.map);
```

to:

```js
migrateLegacySave();
mountStartScreen();
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 6: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser. If you have an existing save from before this change, it's sitting under the old `emoji-rpg-save` key — keep it, this step exercises migrating it.

- Confirm the start screen appears first (not the map) — if you had an old save, confirm it now shows as one slot named "Save" with your correct level. Confirm `localStorage.getItem('emoji-rpg-save')` is now `null` in the browser devtools console, and `localStorage.getItem('emoji-rpg-slots')` has one entry.
- Click **+ New Game**, type a name, click **Create**. Confirm you land in the game world at a fresh level 1.
- Play a few moves, open Stats to confirm gold/level are what you expect, then reload the page. Confirm the start screen shows both slots now, with the new one's level/last-played reflecting your progress.
- Click **Continue** on the new slot. Confirm you resume exactly where you left off (position, gold, inventory).
- Go back to the start screen (reload the page), click **Delete** on the new slot, confirm the button becomes "Confirm delete?"/"Cancel", click **Cancel** and confirm the slot is still there, then click **Delete** again and **Confirm delete?** — confirm the slot disappears and the original migrated slot is untouched.
- Reload the page one more time and confirm the deleted slot does not reappear (i.e. deletion persisted, not just a UI-only removal).

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: wire multi-slot save/load and the start screen into the game boot flow"
```

---

### Task 5: `js/systems/ngPlus.js` — pure NG+ scaling and world-reset logic

**Files:**
- Create: `js/systems/ngPlus.js`
- Test: `tests/ngPlus.test.js`

**Interfaces:**
- Produces: `MAX_NG_PLUS_CYCLE` (number, `2`); `canStartNgPlus(state)` → boolean; `getNgPlusCombatOverrides(baseMonster, cycle)` → `{hp, attack, defense, speed}`; `getNgPlusRewardMultiplier(cycle)` → `{gold, xp}`; `scaleDropTable(dropTable, cycle)` → new array of `{itemId, chance}`; `resetWorldForNgPlus(state)` → new full state object. Task 6 and Task 8 import from this file.

- [ ] **Step 1: Write the failing tests**

Create `tests/ngPlus.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NG_PLUS_CYCLE,
  canStartNgPlus,
  getNgPlusCombatOverrides,
  getNgPlusRewardMultiplier,
  scaleDropTable,
  resetWorldForNgPlus,
} from '../js/systems/ngPlus.js';
import { MONSTERS } from '../js/data/monsters.js';
import { createNewGame } from '../js/state.js';

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test('MAX_NG_PLUS_CYCLE is 2', () => {
  assert.equal(MAX_NG_PLUS_CYCLE, 2);
});

test('getNgPlusCombatOverrides at cycle 0 matches the base monster exactly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 110, attack: 34, defense: 12, speed: 11 });
});

test('getNgPlusCombatOverrides at cycle 1 doubles hp and raises attack/defense ~25%', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 220, attack: 43, defense: 15, speed: 11 });
});

test('getNgPlusCombatOverrides at cycle 2 (max) compounds correctly', () => {
  const stats = getNgPlusCombatOverrides(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 440, attack: 53, defense: 19, speed: 11 });
});

test('getNgPlusRewardMultiplier compounds 1.5x per cycle', () => {
  assert.deepEqual(getNgPlusRewardMultiplier(0), { gold: 1, xp: 1 });
  const cycle1 = getNgPlusRewardMultiplier(1);
  assertClose(cycle1.gold, 1.5);
  assertClose(cycle1.xp, 1.5);
  const cycle2 = getNgPlusRewardMultiplier(2);
  assertClose(cycle2.gold, 2.25);
  assertClose(cycle2.xp, 2.25);
});

test('scaleDropTable at cycle 0 leaves chances unchanged', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 0);
  assert.deepEqual(scaled.map((e) => e.chance), [0.6, 0.4]);
});

test('scaleDropTable at cycle 1 scales chances up without hitting the cap', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 1);
  assertClose(scaled[0].chance, 0.9);
  assertClose(scaled[1].chance, 0.6);
});

test('scaleDropTable at cycle 2 caps every entry at 0.9', () => {
  const scaled = scaleDropTable(MONSTERS.dragon.dropTable, 2);
  assert.equal(scaled[0].chance, 0.9);
  assert.equal(scaled[1].chance, 0.9);
});

test('canStartNgPlus requires the boss defeated at least once and below the cap', () => {
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: false }, ngPlusCycle: 0 }), false);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 0 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 1 }), true);
  assert.equal(canStartNgPlus({ flags: { dungeonBossDefeated: true }, ngPlusCycle: 2 }), false);
});

test('resetWorldForNgPlus preserves player power and resets world state', () => {
  const state = createNewGame();
  state.player.level = 12;
  state.player.gold = 500;
  state.equipment.weapon = 'ironSword';
  state.upgrades.ironSword = 2;
  state.inventory = [{ itemId: 'potion', quantity: 5 }];
  state.flags.dungeonBossDefeated = true;
  state.visited = { center: { '1,1': true } };
  state.seenScreens = { center: true };
  state.caches = { center: { '2,2': true } };
  state.miniDungeons = { center: { '3,3': { variantId: 'miniDungeonA', treasureTaken: false } } };
  state.activeMiniDungeon = { screenId: 'center', x: 3, y: 3 };
  state.bossTier = 2;
  state.map = 'northeast';
  state.position = { x: 5, y: 5 };
  state.ngPlusCycle = 0;

  const reset = resetWorldForNgPlus(state);

  assert.equal(reset.player.level, 12);
  assert.equal(reset.player.gold, 500);
  assert.equal(reset.equipment.weapon, 'ironSword');
  assert.equal(reset.upgrades.ironSword, 2);
  assert.deepEqual(reset.inventory, [{ itemId: 'potion', quantity: 5 }]);

  assert.equal(reset.flags.dungeonBossDefeated, false);
  assert.deepEqual(reset.visited, {});
  assert.deepEqual(reset.seenScreens, {});
  assert.deepEqual(reset.caches, {});
  assert.deepEqual(reset.miniDungeons, {});
  assert.equal(reset.activeMiniDungeon, null);
  assert.equal(reset.bossTier, 0);
  assert.equal(reset.map, 'center');
  assert.equal(reset.position, null);
  assert.equal(reset.ngPlusCycle, 1);
});

test('resetWorldForNgPlus caps ngPlusCycle at MAX_NG_PLUS_CYCLE', () => {
  const state = createNewGame();
  state.flags.dungeonBossDefeated = true;
  state.ngPlusCycle = 2;
  const reset = resetWorldForNgPlus(state);
  assert.equal(reset.ngPlusCycle, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/ngPlus.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/ngPlus.js`**

```js
export const MAX_NG_PLUS_CYCLE = 2;
export const NG_PLUS_HP_MULTIPLIER = 2;
export const NG_PLUS_COMBAT_MULTIPLIER = 1.25;
export const NG_PLUS_REWARD_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_CAP = 0.9;

export function canStartNgPlus(state) {
  return Boolean(state.flags.dungeonBossDefeated) && state.ngPlusCycle < MAX_NG_PLUS_CYCLE;
}

export function getNgPlusCombatOverrides(baseMonster, cycle) {
  const hpMultiplier = NG_PLUS_HP_MULTIPLIER ** cycle;
  const combatMultiplier = NG_PLUS_COMBAT_MULTIPLIER ** cycle;
  return {
    hp: Math.round(baseMonster.hp * hpMultiplier),
    attack: Math.round(baseMonster.attack * combatMultiplier),
    defense: Math.round(baseMonster.defense * combatMultiplier),
    speed: baseMonster.speed,
  };
}

export function getNgPlusRewardMultiplier(cycle) {
  const multiplier = NG_PLUS_REWARD_MULTIPLIER ** cycle;
  return { gold: multiplier, xp: multiplier };
}

export function scaleDropTable(dropTable, cycle) {
  const multiplier = NG_PLUS_DROP_CHANCE_MULTIPLIER ** cycle;
  return dropTable.map((entry) => ({
    ...entry,
    chance: Math.min(NG_PLUS_DROP_CHANCE_CAP, entry.chance * multiplier),
  }));
}

export function resetWorldForNgPlus(state) {
  return {
    ...state,
    flags: { ...state.flags, dungeonBossDefeated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    map: 'center',
    position: null,
    ngPlusCycle: Math.min(state.ngPlusCycle + 1, MAX_NG_PLUS_CYCLE),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 11 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/ngPlus.js tests/ngPlus.test.js
git commit -m "feat: add pure New Game+ scaling and world-reset logic"
```

---

### Task 6: New Game+ option on the boss rematch prompt

**Files:**
- Modify: `js/screens/bossPromptScreen.js`

**Interfaces:**
- Consumes: nothing directly from Task 5 (Task 8 computes `canStartNgPlus`/eligibility and passes plain booleans as props — this screen stays logic-free, matching its existing design).
- Produces: `mount(root, props)` now expects `{ text, showTierEscalation: boolean, showNgPlus: boolean, callbacks: { onAccept, onDecline, onStartNgPlus } }`. When `showTierEscalation` is `true`, behavior is unchanged from today. When `showNgPlus` is `true`, a "Start New Game+" button appears; clicking it swaps the panel into a confirmation state before calling `callbacks.onStartNgPlus()`. `unmount()` is unchanged (no-op).

This module has no dedicated automated test — matches its existing shipped state (pure DOM rendering, no logic of its own).

- [ ] **Step 1: Replace the entire contents of `js/screens/bossPromptScreen.js`**

```js
let rootEl = null;
let callbacks = null;
let text = null;
let showTierEscalation = false;
let showNgPlus = false;

function renderMain() {
  const fightButton = showTierEscalation ? '<button id="btn-boss-fight">Fight!</button>' : '';
  const ngPlusButton = showNgPlus ? '<button id="btn-boss-ngplus">Start New Game+</button>' : '';

  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>The Dragon Returns</h2>
      <p>${text}</p>
      ${fightButton}
      <button id="btn-boss-not-yet">Not yet</button>
      ${ngPlusButton}
    </div>
  `;

  if (showTierEscalation) {
    document.getElementById('btn-boss-fight').onclick = () => callbacks.onAccept();
  }
  document.getElementById('btn-boss-not-yet').onclick = () => callbacks.onDecline();
  if (showNgPlus) {
    document.getElementById('btn-boss-ngplus').onclick = renderConfirm;
  }

  const focusTarget = showTierEscalation ? 'btn-boss-fight' : 'btn-boss-not-yet';
  document.getElementById(focusTarget).focus();
}

function renderConfirm() {
  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>Start New Game+?</h2>
      <p>This resets your map progress. Your level, gear, and gold carry over.</p>
      <button id="btn-ngplus-confirm">Continue</button>
      <button id="btn-ngplus-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('btn-ngplus-confirm').onclick = () => callbacks.onStartNgPlus();
  document.getElementById('btn-ngplus-cancel').onclick = renderMain;
  document.getElementById('btn-ngplus-confirm').focus();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  text = props.text;
  showTierEscalation = props.showTierEscalation;
  showNgPlus = props.showNgPlus;
  renderMain();
}

export function unmount() {}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this file adds no tests, and its new `showTierEscalation`/`showNgPlus`/`onStartNgPlus` props aren't supplied by anything yet — `main.js`'s existing call still passes only `{text, callbacks: {onAccept, onDecline}}` until Task 8, so `showTierEscalation`/`showNgPlus` will be `undefined` — falsy, so both new buttons stay hidden and the "Not yet" button gets focus. Existing behavior is otherwise preserved: the "Fight!" button no longer renders until Task 8 passes `showTierEscalation: true`, so between this task and Task 8, rematches will show only "Not yet" — expected and resolved by Task 8, not a regression worth chasing down manually).

- [ ] **Step 3: Commit**

```bash
git add js/screens/bossPromptScreen.js
git commit -m "feat: add New Game+ option to the boss rematch prompt"
```

---

### Task 7: New Game+ cycle badge in the stats panel

**Files:**
- Modify: `js/screens/statsPanel.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `state.ngPlusCycle` (added in Task 1, already present on every state object by this point).
- Produces: no interface change — `mount`/`unmount` signatures are unchanged, this only adds a conditional line of markup.

- [ ] **Step 1: Add the badge to `js/screens/statsPanel.js`**

Change:

```js
  rootEl.innerHTML = `
    <div class="overlay-panel stats-panel">
      <h2>Stats</h2>
      <div>Level ${state.player.level} (XP ${state.player.xp}/${xpNeeded})</div>
```

to:

```js
  const ngPlusBadge = state.ngPlusCycle > 0 ? `<div class="ngplus-badge">New Game+${state.ngPlusCycle}</div>` : '';

  rootEl.innerHTML = `
    <div class="overlay-panel stats-panel">
      <h2>Stats</h2>
      ${ngPlusBadge}
      <div>Level ${state.player.level} (XP ${state.player.xp}/${xpNeeded})</div>
```

- [ ] **Step 2: Add badge CSS to `css/styles.css`**

Add this rule anywhere after `.stats-slot`:

```css
.ngplus-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #6c3fa1;
  font-size: 0.8rem;
  margin-bottom: 8px;
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
git add js/screens/statsPanel.js css/styles.css
git commit -m "feat: show New Game+ cycle badge in the stats panel"
```

---

### Task 8: Wire New Game+ scaling and trigger into `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `MAX_NG_PLUS_CYCLE`-gated `canStartNgPlus`, `getNgPlusCombatOverrides`, `getNgPlusRewardMultiplier`, `scaleDropTable`, `resetWorldForNgPlus` from `js/systems/ngPlus.js` (Task 5); `bossPromptScreen`'s `showTierEscalation`/`showNgPlus`/`onStartNgPlus` support (Task 6); `startGame`/`persist`/`activeSlotId` from Task 4.
- Produces: `handleBossBattle()` now offers NG+ whenever eligible even after boss-tier escalation is maxed out; `handleEncounter` applies NG+ combat scaling to every fight (boss and non-boss alike); `handleBattleEnd` applies NG+ reward scaling to XP, gold, and drop chance.

This task has no dedicated automated test (no test harness exists for `main.js`). Correctness rests on Task 5's own tests plus the manual verification in Step 5.

- [ ] **Step 1: Add the import**

Change:

```js
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
```

to:

```js
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus } from './systems/ngPlus.js';
```

- [ ] **Step 2: Update `handleBossBattle`**

Change:

```js
function handleBossBattle() {
  if (!shouldPromptForRematch(state)) {
    startBossFight(state.bossTier);
    return;
  }
  setStatsButtonEnabled(false);
  mountOverlay(bossPromptScreen, {
    text: pickBossReturnFlavor(),
    callbacks: {
      onAccept: () => {
        state.bossTier += 1;
        persist();
        startBossFight(state.bossTier);
      },
      onDecline: () => {
        startBossFight(state.bossTier);
      },
    },
  });
}
```

to:

```js
function handleBossBattle() {
  const offerTierEscalation = shouldPromptForRematch(state);
  const offerNgPlus = canStartNgPlus(state);
  if (!offerTierEscalation && !offerNgPlus) {
    startBossFight(state.bossTier);
    return;
  }
  setStatsButtonEnabled(false);
  mountOverlay(bossPromptScreen, {
    text: pickBossReturnFlavor(),
    showTierEscalation: offerTierEscalation,
    showNgPlus: offerNgPlus,
    callbacks: {
      onAccept: () => {
        state.bossTier += 1;
        persist();
        startBossFight(state.bossTier);
      },
      onDecline: () => {
        startBossFight(state.bossTier);
      },
      onStartNgPlus: () => {
        Object.assign(state, resetWorldForNgPlus(state));
        persist();
        startGame(state, activeSlotId);
      },
    },
  });
}
```

- [ ] **Step 3: Update `handleEncounter` to apply NG+ combat scaling**

Change:

```js
function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setStatsButtonEnabled(false);
  mountOverlay(battleScreen, {
    state,
    monsterId,
    monsterOverrides,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}
```

to:

```js
function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setStatsButtonEnabled(false);
  const preScaled = { ...MONSTERS[monsterId], ...(monsterOverrides || {}) };
  const ngPlusOverrides = getNgPlusCombatOverrides(preScaled, state.ngPlusCycle);
  mountOverlay(battleScreen, {
    state,
    monsterId,
    monsterOverrides: ngPlusOverrides,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}
```

`ngPlusOverrides` at `state.ngPlusCycle === 0` equals `preScaled`'s own `{hp, attack, defense, speed}` fields exactly (multiplier is `1`), so every existing fight (boss or not) is byte-identical to today until a player actually starts NG+.

- [ ] **Step 4: Update `handleBattleEnd` to apply NG+ reward scaling**

Change:

```js
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const xp = resolveBattleXp(bossTierXp, monster);
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) {
      state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    }

    const drop = rollDrop(monster);
    Object.assign(state, addGold(state, drop.gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
      const droppedItemDef = ITEMS[drop.item];
      if (droppedItemDef.slot) {
        Object.assign(state, equipItem(state, drop.item, droppedItemDef.slot));
      }
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

to:

```js
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const baseXp = resolveBattleXp(bossTierXp, monster);
    const xp = Math.round(baseXp * rewardMultiplier.xp);
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) {
      state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    }

    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
      const droppedItemDef = ITEMS[drop.item];
      if (droppedItemDef.slot) {
        Object.assign(state, equipItem(state, drop.item, droppedItemDef.slot));
      }
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

At `state.ngPlusCycle === 0`, `rewardMultiplier.xp`/`rewardMultiplier.gold` are both `1` and `scaleDropTable` returns the drop table unchanged, so this is byte-identical to today's behavior until NG+ is active.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 6: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser, continue an existing slot (or create one and fight your way to the dragon).

- Beat the dragon for the first time on this save. Confirm no prompt (matches existing shipped behavior).
- Walk back onto the boss tile. Confirm the prompt now shows **Fight!**, **Not yet**, and **Start New Game+**.
- Click **Start New Game+**. Confirm the panel swaps to the confirmation copy ("This resets your map progress..."). Click **Cancel** — confirm you're back at the three-button prompt, still on the boss tile, nothing has changed.
- Click **Start New Game+** again, then **Continue**. Confirm: you land back on the `center` map at its start position; opening Stats shows the same level/gear/gold you had, plus a "New Game+1" badge; `state.flags.dungeonBossDefeated` behavior resets (walking straight back to the dungeon's boss tile fights immediately with no prompt, same as a first-ever encounter).
- Fight a regular wandering monster. Confirm its HP bar shows roughly double the pre-NG+ value (check against the numbers in `js/data/monsters.js`) and that gold/XP awarded on a win look scaled up (~1.5x) versus a pre-NG+ fight.
- Fight your way back to the dragon and beat it again at NG+1. Confirm the boss-tier rematch prompt still works independently (tier resets to 0 after the NG+ transition, so escalating tiers again is available from scratch).
- Repeat the full NG+ cycle once more to reach NG+2. Confirm the "Start New Game+" option disappears from the prompt once capped (only "Fight!"/"Not yet" remain, until boss tier also maxes, at which point only "Not yet" remains — matches the pre-NG+ shipped behavior at max tier).
- Reload the page between several of the above steps to confirm `ngPlusCycle` and the reset world state persist correctly across save/load.

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: wire New Game+ scaling and trigger into the dragon fight"
```

---

## Self-Review Notes

- **Spec coverage:** slot registry + per-slot keys (Tasks 1-2), start screen with Continue/click-to-confirm Delete/inline New Game (Task 3), no native `confirm()`/`prompt()` (Task 3's inline DOM state), one-time legacy migration (Task 2's `migrateLegacySave`, invoked once at boot in Task 4), `main.js` bootstrap restructuring into `startGame`/`mountStartScreen`/`persist` (Task 4), capped repeatable NG+ with the exact multiplier table from the design (Task 5, verified against real dragon numbers that happen to match the already-shipped boss-tier numbers since both reuse the same 2x/1.25x schedule), NG+ resets exactly the fields listed in the design and preserves exactly the fields listed (Task 5's `resetWorldForNgPlus` test), NG+ trigger point and interaction with the existing tier-escalation gating (`shouldPromptForRematch(state) || canStartNgPlus(state)`, Task 8), destructive-action confirmation for NG+ (Task 6's `renderConfirm` sub-state), composition of boss-tier and NG+ scaling without stacking across a reset (Task 8's `handleEncounter` merges `monsterOverrides` — which for boss fights is already boss-tier-scaled — before applying NG+ scaling on top, and `resetWorldForNgPlus` always zeroes `bossTier`), reward scaling (XP/gold/drop-chance, Task 8's `handleBattleEnd`), NG+ badge in stats (Task 7) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code.
- **Type consistency:** `createSlot(name, storage)` → `{id, state}` (Task 2) matches exactly how Task 4's `mountStartScreen`'s `onNewGame` destructures `created.state`/`created.id`. `saveState(state, slotId, storage)`/`loadState(slotId, storage)` (Task 1) match every call site introduced in Tasks 2 and 4. `touchSlot(id, {level, ngPlusCycle}, storage)` (Task 2) matches exactly how Task 4's `persist()` calls it. `getNgPlusCombatOverrides(baseMonster, cycle)` → `{hp, attack, defense, speed}` (Task 5) is passed directly as `battleScreen`'s existing `monsterOverrides` prop (Task 8), which already expects exactly that shape (established by the already-shipped boss-tier system). `getNgPlusRewardMultiplier(cycle)` → `{gold, xp}` (Task 5) matches Task 8's `rewardMultiplier.xp`/`rewardMultiplier.gold` usage. `resetWorldForNgPlus(state)` → full state object (Task 5) matches Task 8's `Object.assign(state, resetWorldForNgPlus(state))` usage, consistent with every other state-transform function in this codebase (`addGold`, `addItem`, `equipItem`, etc.). `bossPromptScreen.mount(root, {text, showTierEscalation, showNgPlus, callbacks: {onAccept, onDecline, onStartNgPlus}})` (Task 6) matches exactly how Task 8's `handleBossBattle` calls `mountOverlay(bossPromptScreen, {...})`.
