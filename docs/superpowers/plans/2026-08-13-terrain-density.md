# Terrain & Density Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quadruple each wilderness screen's tile count (15x11 → 30x22), give each of the 9 screens a genuinely distinct terrain layout, and show a short once-per-screen fading flavor-text banner on first entry — without touching difficulty, monster tables, or Town/Dungeon.

**Architecture:** A new pure `js/systems/screenSeen.js` (mirroring the existing `exploration.js` pattern) tracks which screens the player has already seen. `mapScreen.js` checks/marks this on `mount()` and reports a first-visit via a new `onFirstVisit` callback — same "renders and reports, doesn't decide" pattern used for edge transitions and encounters. `main.js` owns the flavor-text *content* (a new small data file) and triggers a lightweight, non-blocking banner (a new tiny DOM utility, NOT routed through `mountOverlay` — it must never pause movement). The 9 wilderness map files get their `rows`/`startPosition` replaced with larger, hand-authored-and-verified layouts; `legend`, `encounterChance`, `monsterTable`, and `neighbors` are untouched.

**Tech Stack:** Same as the rest of the project — plain HTML/CSS/JS (ES modules), no build tooling, no npm dependencies, `node:test` for pure-logic tests.

## Global Constraints

- No build tooling: no bundler, no transpiler, no npm dependencies.
- Node.js 18+ required to run tests (`npm test` runs `node --test tests/*.js`).
- Pure game-logic modules (`js/systems/*.js`) must have no `document`/`window`/DOM references.
- The flavor banner must never block movement, input, or the ATB/battle flow — it's purely decorative and must not go through `mountOverlay` (which pauses the base screen).
- Every wilderness screen's open border (where a neighbor exists) must stay fully walkable end-to-end, and every walkable tile in a screen must be reachable from its `startPosition` — both already-established invariants, now re-verified against the new 30x22 layouts.
- Town and Dungeon maps are not touched by this plan. Monster tables, encounter chances, and all combat/balance values are not touched by this plan.

---

## File Structure

```
js/
  state.js                       # MODIFY: add `seenScreens: {}` to createNewGame()
  systems/
    screenSeen.js                # NEW: markScreenSeen, hasSeenScreen
  data/
    flavorText.js                 # NEW: FLAVOR_TEXT map, one line per wilderness screen
  screens/
    flavorBanner.js                # NEW: showFlavorBanner(text) — lightweight, non-blocking
    mapScreen.js                    # MODIFY: check/mark seenScreens, report onFirstVisit
  maps/
    wilderness/
      center.js, north.js, south.js, east.js, west.js,
      northeast.js, northwest.js, southeast.js, southwest.js
                                      # MODIFY: rows/startPosition only, 15x11 -> 30x22
  main.js                          # MODIFY: wire onFirstVisit, import flavor data/banner
index.html                         # MODIFY: add #flavor-banner container
css/styles.css                     # MODIFY: #flavor-banner styling
tests/
  screenSeen.test.js               # NEW
  state.test.js                    # unchanged (no assertion touches seenScreens)
  maps.test.js                     # unchanged — its helpers are already dimension-agnostic
                                      # and will automatically validate the new 30x22 data
```

---

### Task 1: Screen-Seen Tracking System

**Files:**
- Modify: `js/state.js`
- Create: `js/systems/screenSeen.js`
- Test: `tests/screenSeen.test.js`

**Interfaces:**
- Produces: `markScreenSeen(seenScreens, screenId): seenScreens`, `hasSeenScreen(seenScreens, screenId): boolean`
- `GameState` gains `seenScreens: { [screenId]: true }`

- [ ] **Step 1: Write the failing tests**

Create `tests/screenSeen.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { markScreenSeen, hasSeenScreen } from '../js/systems/screenSeen.js';

test('markScreenSeen records a screen as seen, immutably', () => {
  const seenScreens = {};
  const next = markScreenSeen(seenScreens, 'north');
  assert.equal(hasSeenScreen(next, 'north'), true);
  assert.deepEqual(seenScreens, {});
});

test('hasSeenScreen returns false for an unseen screen', () => {
  const seenScreens = { north: true };
  assert.equal(hasSeenScreen(seenScreens, 'south'), false);
});

test('markScreenSeen preserves previously seen screens', () => {
  let seenScreens = markScreenSeen({}, 'north');
  seenScreens = markScreenSeen(seenScreens, 'south');
  assert.equal(hasSeenScreen(seenScreens, 'north'), true);
  assert.equal(hasSeenScreen(seenScreens, 'south'), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/screenSeen.js` does not exist yet.

- [ ] **Step 3: Create `js/systems/screenSeen.js`**

```js
export function markScreenSeen(seenScreens, screenId) {
  return { ...seenScreens, [screenId]: true };
}

export function hasSeenScreen(seenScreens, screenId) {
  return Boolean(seenScreens[screenId]);
}
```

- [ ] **Step 4: Add `seenScreens` to `js/state.js`'s `createNewGame()`**

Modify `js/state.js` — add one field to the returned object:

```js
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
  };
}
```

No existing test asserts the exact shape of `createNewGame()`'s return value beyond individual fields, so no test file needs updating for this addition.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all previous tests + 3 new tests)

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/systems/screenSeen.js tests/screenSeen.test.js
git commit -m "feat: add per-screen seen tracking"
```

---

### Task 2: Flavor Text Data

**Files:**
- Create: `js/data/flavorText.js`

**Interfaces:**
- Produces: `FLAVOR_TEXT: { [screenId]: string }` — one entry per wilderness screen id (`center`, `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`). No entry for `town`/`dungeon` — intentional, those don't get flavor text in this pass.

- [ ] **Step 1: Create `js/data/flavorText.js`**

```js
export const FLAVOR_TEXT = {
  center: "The town's outer fields stretch quiet and safe in every direction.",
  north: 'Tall grass sways under an open sky — the road north feels calm enough.',
  south: 'A well-worn path winds south, birdsong drifting from the treeline.',
  east: 'The ground rises gently to the east, wind picking up off the open field.',
  west: 'Old stone markers dot the western field, remnants of some earlier traveler.',
  northeast: 'The trees grow thick here, and the woods hum with a far-off, unfamiliar howl.',
  northwest: 'Something skitters in the underbrush to the northwest. Best stay alert.',
  southeast: "A cold draft rolls out from somewhere ahead — the dungeon can't be far.",
  southwest: 'The ground grows uneven and the shadows deepen. Little travels through here undisturbed.',
};
```

- [ ] **Step 2: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count — this file has no logic to test, it's a data map consumed by DOM code in a later task)

- [ ] **Step 3: Commit**

```bash
git add js/data/flavorText.js
git commit -m "feat: add first-visit flavor text for wilderness screens"
```

---

### Task 3: Flavor Banner Display

**Files:**
- Create: `js/screens/flavorBanner.js`
- Modify: `index.html`
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `showFlavorBanner(text: string): void`

- [ ] **Step 1: Create `js/screens/flavorBanner.js`**

```js
const VISIBLE_DURATION_MS = 3500;

let hideTimeoutId = null;

export function showFlavorBanner(text) {
  const banner = document.getElementById('flavor-banner');
  if (!banner) return;
  clearTimeout(hideTimeoutId);
  banner.textContent = text;
  banner.classList.add('visible');
  hideTimeoutId = setTimeout(() => {
    banner.classList.remove('visible');
  }, VISIBLE_DURATION_MS);
}
```

- [ ] **Step 2: Add the banner container to `index.html`**

Modify `index.html` — replace:
```html
  <div id="hud"></div>
  <div id="app"></div>
```
with:
```html
  <div id="hud"></div>
  <div id="flavor-banner"></div>
  <div id="app"></div>
```

- [ ] **Step 3: Append banner styling to `css/styles.css`**

```css
#flavor-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 17, 17, 0.92);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 0.9rem;
  color: #ddd;
  max-width: 90%;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s;
  z-index: 20;
}
#flavor-banner.visible {
  opacity: 1;
}
```

- [ ] **Step 4: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/flavorBanner.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 6: Commit**

```bash
git add js/screens/flavorBanner.js index.html css/styles.css
git commit -m "feat: add a non-blocking flavor-text banner display"
```

---

### Task 4: Wire First-Visit Detection Into Map Screen and Main

**Files:**
- Modify: `js/screens/mapScreen.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `markScreenSeen`/`hasSeenScreen` (Task 1), `FLAVOR_TEXT` (Task 2), `showFlavorBanner` (Task 3)
- `mapScreen.mount`'s `props.callbacks` gains a new required entry: `onFirstVisit(screenId)`, called once per screen id the very first time it's entered (works uniformly across all map types — town/dungeon included — same as visited-tile tracking; `FLAVOR_TEXT` simply has no entry for `town`/`dungeon`, so the caller no-ops for those).

- [ ] **Step 1: Update `js/screens/mapScreen.js`'s imports and `mount()`**

Add to the top of the file, alongside the existing imports:
```js
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
```

Replace `mount`:
```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  callbacks = props.callbacks;
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  if (!hasSeenScreen(state.seenScreens, mapConfig.id)) {
    Object.assign(state, { seenScreens: markScreenSeen(state.seenScreens, mapConfig.id) });
    callbacks.onFirstVisit(mapConfig.id);
  }
  render();
  window.addEventListener('keydown', handleKeydown);
}
```

- [ ] **Step 2: Wire it up in `js/main.js`**

Add two imports near the existing data/screens imports:
```js
import { FLAVOR_TEXT } from './data/flavorText.js';
import { showFlavorBanner } from './screens/flavorBanner.js';
```

Add a bootstrap line alongside the existing `visited` bootstrap (so a pre-existing save without `seenScreens` doesn't crash on `hasSeenScreen`):
```js
if (!state.seenScreens) {
  state.seenScreens = {};
}
```

Add `onFirstVisit: handleFirstVisit,` to `goToMap`'s callbacks object:
```js
function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
    },
  });
}
```

Add the new handler function (e.g. right after `handleEdgeTransition`):
```js
function handleFirstVisit(screenId) {
  const text = FLAVOR_TEXT[screenId];
  if (text) {
    showFlavorBanner(text);
  }
  saveState(state);
}
```

- [ ] **Step 3: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/mapScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 5: Commit**

```bash
git add js/screens/mapScreen.js js/main.js
git commit -m "feat: show flavor-text banner on first visit to each wilderness screen"
```

---

### Task 5: 30x22 Terrain for All 9 Wilderness Screens

**Files:**
- Modify: `js/maps/wilderness/center.js`
- Modify: `js/maps/wilderness/north.js`
- Modify: `js/maps/wilderness/south.js`
- Modify: `js/maps/wilderness/east.js`
- Modify: `js/maps/wilderness/west.js`
- Modify: `js/maps/wilderness/northeast.js`
- Modify: `js/maps/wilderness/northwest.js`
- Modify: `js/maps/wilderness/southeast.js`
- Modify: `js/maps/wilderness/southwest.js`

**Interfaces:** no shape change — each map's `id`, `legend`, `encounterChance`, `monsterTable`, and `neighbors` stay exactly as they are. Only `rows` (now 30 wide x 22 tall instead of 15x11) and `startPosition` change.

Every layout below has already been generated and verified (dimensions, every open border fully walkable end-to-end excluding the two corner cells per side, and full interior reachability from the given `startPosition` via flood fill) — transcribe them exactly, character-for-character.

- [ ] **Step 1: Update `js/maps/wilderness/center.js`**

Replace `ROWS` and `startPosition` (everything else in the file — `LEGEND`, `id`, `encounterChance`, `monsterTable`, `neighbors` — stays unchanged):

```js
const ROWS = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '............~~~~~.............',
  '............~~~~~.....###.....',
  '............~~~~~.....###.....',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............T...............',
  '..............................',
  '..............................',
  '.....###......................',
  '.....###......................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 2: Update `js/maps/wilderness/north.js`**

```js
const ROWS = [
  '##############################',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..........~~~~~~~~~...........',
  '..........~~~~~~~~~...........',
  '..........~~~~~~~~~...........',
  '..........~~~~~~~~~...........',
  '..........~~~~~~~~~...........',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '...###..................###...',
  '...###..................###...',
  '...###..................###...',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 3: Update `js/maps/wilderness/south.js`**

```js
const ROWS = [
  '..............................',
  '..............................',
  '..............................',
  '............####..............',
  '............####......~~~.....',
  '......................~~~.....',
  '......................~~~.....',
  '......................~~~.....',
  '....~~~...............~~~.....',
  '....~~~...............~~~.....',
  '....~~~...............~~~.....',
  '....~~~...............~~~.....',
  '....~~~.......................',
  '....~~~.......................',
  '....~~~.......................',
  '....~~~.......................',
  '....~~~.......................',
  '....~~~.......................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 4: Update `js/maps/wilderness/east.js`**

```js
const ROWS = [
  '.............................#',
  '.............................#',
  '.............................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##.....~~~~~~........#',
  '...##...##.....~~~~~~........#',
  '...##...##.....~~~~~~........#',
  '...##...##.....~~~~~~........#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '...##...##...................#',
  '.............................#',
  '.............................#',
  '.............................#',
];
```
```js
  startPosition: { x: 14, y: 10 },
```

- [ ] **Step 5: Update `js/maps/wilderness/west.js`**

```js
const ROWS = [
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............~~~~............',
  '#...##........~~~~............',
  '#...##........~~~~............',
  '#...................##........',
  '#...................##........',
  '#.............................',
  '#.........##..................',
  '#.........##..................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.....................##......',
  '#.....##..............##......',
  '#.....##......................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 6: Update `js/maps/wilderness/northeast.js`**

```js
const ROWS = [
  '##############################',
  '.............................#',
  '.............................#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '....########....######.......#',
  '................######.......#',
  '................######.......#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '................######.......#',
  '................######.......#',
  '....########....######.......#',
  '....########.................#',
  '....########.................#',
  '....########.................#',
  '.............................#',
  '.............................#',
  '.............................#',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 7: Update `js/maps/wilderness/northwest.js`**

```js
const ROWS = [
  '##############################',
  '#.............................',
  '#.............................',
  '#.............##########......',
  '#.............##########......',
  '#.............##########......',
  '#.............................',
  '#.............................',
  '#...~~~~~.....................',
  '#...~~~~~.....####..####......',
  '#...~~~~~.....####..####......',
  '#...~~~~~.....####..####......',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............##########......',
  '#.............##########......',
  '#.............##########......',
  '#.............................',
  '#.............................',
  '#.............................',
  '#.............................',
];
```
```js
  startPosition: { x: 14, y: 12 },
```

- [ ] **Step 8: Update `js/maps/wilderness/southeast.js`**

```js
const ROWS = [
  '.............................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '........................D....#',
  '.............................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~.................#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~....####.........#',
  '....~~~~~~~~.................#',
  '.............................#',
  '.............................#',
  '.............................#',
  '##############################',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 9: Update `js/maps/wilderness/southwest.js`**

```js
const ROWS = [
  '#.............................',
  '#.............................',
  '#.............................',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#...#####...~~~...#####.......',
  '#.............................',
  '#.............................',
  '##############################',
];
```
```js
  startPosition: { x: 15, y: 11 },
```

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS — `tests/maps.test.js`'s helpers (`assertValidMap`, `assertBorderWalkable`) read each map's actual `rows` dimensions at runtime rather than assuming a fixed size, so they automatically validate the new 30x22 layouts (well-formedness, legend completeness, walkable `startPosition`, border-open-exactly-where-a-neighbor-exists, symmetric neighbor links) without any test-file changes. If any of these fail, the transcription above has an error — re-check character-for-character against this task rather than editing the test.

- [ ] **Step 11: Commit**

```bash
git add js/maps/wilderness
git commit -m "feat: quadruple wilderness screen size with distinct terrain per screen"
```

---

### Task 6: Manual Playtest

**Files:** none expected — this task verifies Tasks 1-5 together and fixes anything the playtest turns up in the files already touched by this plan.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS (all tests from Task 1, unchanged count otherwise)

- [ ] **Step 2: Manual playtest**

Run `python3 -m http.server` (or reuse an already-running instance) and play through the world, checking:

- Every wilderness screen is visibly bigger and takes noticeably longer to cross than before
- Each of the 9 screens looks distinctly different from its neighbors (different water shapes/placement, different tree clustering, different amounts of open space) rather than the old copy-pasted look
- Walking off any open edge still transitions to the correct neighboring screen and lands on a walkable tile, including corner screens and the town/dungeon entrances (`T` on `center`, `D` on `southeast`)
- No terrain feature blocks a path that should exist — you can walk from `center` all the way out to `southeast` and into the dungeon
- The first time you enter each screen, a small banner fades in with that screen's flavor line and fades back out on its own after a few seconds — movement and input are never blocked by it
- Re-entering a screen you've already visited (including reloading the page and walking back) shows no banner the second time
- Entering Town or Dungeon shows no banner (no flavor text defined for those) and doesn't error
- Reloading mid-session restores `visited`/`seenScreens` state correctly — a screen you've already seen doesn't re-show its banner after a reload

- [ ] **Step 3: Fix anything the playtest surfaces**

If the playtest finds a real bug in the files this plan touches, fix it directly and re-verify. If it's a duplicate/variant of a previously-known, already-deferred issue unrelated to this plan's scope, note it instead of expanding scope here.

- [ ] **Step 4: Commit** (only if Step 3 made a change)

```bash
git add -A
git commit -m "fix: address terrain & density playtest findings"
```

If no changes were needed, skip the commit and say so.
