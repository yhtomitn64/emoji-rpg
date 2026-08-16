# Quest Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable bounty board in town — one quest per non-boss monster, tracked by real kills anywhere in the game, turned in for a guaranteed copy of that monster's upgrade material (no gold, no XP).

**Architecture:** A new pure `js/systems/quests.js` (mirrors the existing `bossTiers.js`/`ngPlus.js` pure-module shape) holds the kill requirements, derives each quest's reward directly from the real `MONSTERS[monsterId].dropTable` data (no second hardcoded reward table to drift out of sync), and provides increment/check/turn-in functions. A new `js/screens/questBoardScreen.js` (mirrors `smithScreen.js`'s per-row template pattern) is the only new UI surface, reached via a new town tile the same way Shop/Smith already are. `main.js` increments quest progress once, inside the existing `handleBattleEnd` win branch, alongside its other post-battle bookkeeping.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Quest-eligible monsters and their exact kill requirements: `boar: 3, bat: 3, snake: 3, goblin: 3, direWolf: 2, spider: 2, orc: 2, wraith: 2`. The dragon has no quest.
- Reward is always exactly 1x the quest monster's material drop, derived from its real `dropTable` (the entry whose item has `type: 'material'`) — never hardcoded a second time. For `goblin` specifically, this must skip its non-material `goblinClub` weapon-drop entry and resolve to `ironScrap`.
- No gold or XP reward from any quest, ever.
- Kill tracking persists across NG+ transitions — `state.questProgress` is player-side progress, not world state, and must NOT be touched by `resetWorldForNgPlus` (out of scope for this plan; just don't add it to that reset).
- Turning in a quest immediately resets that monster's counter to `0` — the bounty is live again right away, no waiting.
- No confirmation dialogs — turning in a completed quest has no downside.

---

### Task 1: `js/systems/quests.js` — pure quest tracking and rewards

**Files:**
- Create: `js/systems/quests.js`
- Test: `tests/quests.test.js`

**Interfaces:**
- Produces: `QUEST_REQUIREMENTS` (object, the 8 monster→count pairs above); `getQuestRewardItemId(monsterId)` → itemId string; `incrementQuestProgress(state, monsterId)` → new state (or the same `state` reference, unchanged, if `monsterId` isn't quest-eligible); `canTurnInQuest(state, monsterId)` → boolean; `turnInQuest(state, monsterId)` → new state (throws if not yet complete). Tasks 4 and 5 import all five.

- [ ] **Step 1: Write the failing tests**

Create `tests/quests.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_REQUIREMENTS, getQuestRewardItemId, incrementQuestProgress, canTurnInQuest, turnInQuest } from '../js/systems/quests.js';
import { createNewGame } from '../js/state.js';

function freshQuestState() {
  const state = createNewGame();
  state.questProgress = {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  };
  return state;
}

test('QUEST_REQUIREMENTS has exactly the 8 expected monsters with the expected kill counts', () => {
  assert.deepEqual(QUEST_REQUIREMENTS, {
    boar: 3, bat: 3, snake: 3, goblin: 3,
    direWolf: 2, spider: 2, orc: 2, wraith: 2,
  });
});

test('getQuestRewardItemId returns the material drop for each quest monster', () => {
  assert.equal(getQuestRewardItemId('boar'), 'leatherScrap');
  assert.equal(getQuestRewardItemId('bat'), 'batWing');
  assert.equal(getQuestRewardItemId('snake'), 'snakeFang');
  assert.equal(getQuestRewardItemId('direWolf'), 'wolfPelt');
  assert.equal(getQuestRewardItemId('spider'), 'spiderSilk');
  assert.equal(getQuestRewardItemId('orc'), 'orcTusk');
  assert.equal(getQuestRewardItemId('wraith'), 'wraithEssence');
});

test("getQuestRewardItemId skips goblin's non-material weapon drop and returns the material", () => {
  assert.equal(getQuestRewardItemId('goblin'), 'ironScrap');
});

test('incrementQuestProgress increments the matching monster counter only', () => {
  let state = freshQuestState();
  state = incrementQuestProgress(state, 'boar');
  assert.equal(state.questProgress.boar, 1);
  assert.equal(state.questProgress.bat, 0);
});

test('incrementQuestProgress is a no-op for a non-quest monster', () => {
  const state = freshQuestState();
  const next = incrementQuestProgress(state, 'dragon');
  assert.equal(next, state);
});

test('canTurnInQuest is false one kill below the requirement and true exactly at it', () => {
  let state = freshQuestState();
  state.questProgress.direWolf = 1;
  assert.equal(canTurnInQuest(state, 'direWolf'), false);
  state.questProgress.direWolf = 2;
  assert.equal(canTurnInQuest(state, 'direWolf'), true);
});

test('turnInQuest resets the counter and grants exactly one reward material', () => {
  let state = freshQuestState();
  state.questProgress.boar = 3;
  state = turnInQuest(state, 'boar');
  assert.equal(state.questProgress.boar, 0);
  const entry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(entry.quantity, 1);
});

test('turnInQuest throws if the requirement is not yet met', () => {
  const state = freshQuestState();
  assert.throws(() => turnInQuest(state, 'boar'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/quests.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/quests.js`**

```js
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { addItem } from './inventory.js';

export const QUEST_REQUIREMENTS = {
  boar: 3,
  bat: 3,
  snake: 3,
  goblin: 3,
  direWolf: 2,
  spider: 2,
  orc: 2,
  wraith: 2,
};

export function getQuestRewardItemId(monsterId) {
  const entry = MONSTERS[monsterId].dropTable.find((e) => ITEMS[e.itemId].type === 'material');
  return entry.itemId;
}

export function incrementQuestProgress(state, monsterId) {
  if (!(monsterId in QUEST_REQUIREMENTS)) return state;
  const current = state.questProgress[monsterId] || 0;
  return { ...state, questProgress: { ...state.questProgress, [monsterId]: current + 1 } };
}

export function canTurnInQuest(state, monsterId) {
  return (state.questProgress[monsterId] || 0) >= QUEST_REQUIREMENTS[monsterId];
}

export function turnInQuest(state, monsterId) {
  if (!canTurnInQuest(state, monsterId)) throw new Error(`Quest for ${monsterId} is not complete`);
  const rewardItemId = getQuestRewardItemId(monsterId);
  let next = { ...state, questProgress: { ...state.questProgress, [monsterId]: 0 } };
  next = addItem(next, rewardItemId, 1);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 8 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/quests.js tests/quests.test.js
git commit -m "feat: add pure quest tracking and reward system"
```

---

### Task 2: `state.questProgress` in the save schema

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js:88-91` (the `ngPlusCycle` backfill block in `startGame`)
- Modify: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (this task hardcodes the same 8 keys directly — `js/state.js` currently has zero imports and this plan doesn't introduce one just to avoid duplicating an 8-key object literal a second time).
- Produces: every state object (fresh or loaded) has `questProgress: { boar: 0, bat: 0, snake: 0, goblin: 0, direWolf: 0, spider: 0, orc: 0, wraith: 0 }` by default. Task 5 reads and mutates `state.questProgress` (indirectly, via Task 1's functions).

- [ ] **Step 1: Write the failing test**

In `tests/state.test.js`, change:

```js
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
});
```

to:

```js
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
  assert.deepEqual(state.questProgress, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `state.questProgress` is `undefined`.

- [ ] **Step 3: Add `questProgress` to `createNewGame()` in `js/state.js`**

Change:

```js
    bossTier: 0,
    ngPlusCycle: 0,
  };
}
```

to:

```js
    bossTier: 0,
    ngPlusCycle: 0,
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Backfill `state.questProgress` for existing saves in `js/main.js`**

In `js/main.js`'s `startGame` function, change:

```js
  if (!state.ngPlusCycle) {
    state.ngPlusCycle = 0;
  }
  renderHud();
```

to:

```js
  if (!state.ngPlusCycle) {
    state.ngPlusCycle = 0;
  }
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  renderHud();
```

No automated test for this block (matches every backfill line above it, none of which have one either) — verify by inspection that it matches their exact shape.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add questProgress to save state"
```

---

### Task 3: Quest Board town tile

**Files:**
- Modify: `js/tiles.js`
- Modify: `js/maps/townMap.js`
- Modify: `tests/maps.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: a new `questBoard` entry in `TILES` (`js/tiles.js`) with `action: 'enterQuestBoard'`; a `Q` legend character in `townMap`'s legend and layout. Task 5 handles the `'enterQuestBoard'` action.

- [ ] **Step 1: Write the failing test**

In `tests/maps.test.js`, change:

```js
test('town map is well-formed and includes shop, smith, and exit tiles', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('exit'));
});
```

to:

```js
test('town map is well-formed and includes shop, smith, quest board, and exit tiles', () => {
  assertValidMap(townMap);
  const chars = townMap.rows.join('');
  const tileKeys = [...chars].map((c) => townMap.legend[c]);
  assert.ok(tileKeys.includes('shop'));
  assert.ok(tileKeys.includes('smith'));
  assert.ok(tileKeys.includes('questBoard'));
  assert.ok(tileKeys.includes('exit'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the town map has no `questBoard` tile yet.

- [ ] **Step 3: Add the `questBoard` tile type to `js/tiles.js`**

Change:

```js
  miniDungeonTreasure: { emoji: '💰', walkable: true, encounter: false, action: 'collectTreasure' },
};
```

to:

```js
  miniDungeonTreasure: { emoji: '💰', walkable: true, encounter: false, action: 'collectTreasure' },
  questBoard: { emoji: '📋', walkable: true, encounter: false, action: 'enterQuestBoard' },
};
```

- [ ] **Step 4: Add the `Q` tile to `js/maps/townMap.js`**

Change:

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  E: 'exit',
};

const ROWS = [
  '########',
  '#......#',
  '#.S..M.#',
  '#......#',
  '#..E...#',
  '########',
];
```

to:

```js
const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  Q: 'questBoard',
  E: 'exit',
};

const ROWS = [
  '########',
  '#..Q...#',
  '#.S..M.#',
  '#......#',
  '#..E...#',
  '########',
];
```

The new `Q` at (3,1) sits directly above the open floor at (3,2) (between the `S` and `M` tiles on the row below), so it's reachable — this map is small enough that a manual check suffices, and this project's automated per-screen flood-fill reachability check (`assertFullyReachable` in `tests/maps.test.js`) only runs over the 9 wilderness screens, not town, matching existing convention (town only gets the `assertValidMap` well-formedness check exercised by this task's test).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add js/tiles.js js/maps/townMap.js tests/maps.test.js
git commit -m "feat: add quest board tile to town map"
```

---

### Task 4: `js/screens/questBoardScreen.js` — the quest board screen

**Files:**
- Create: `js/screens/questBoardScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `QUEST_REQUIREMENTS`, `getQuestRewardItemId`, `canTurnInQuest`, `turnInQuest` from `js/systems/quests.js` (Task 1); `MONSTERS` from `js/data/monsters.js`; `ITEMS` from `js/data/items.js`.
- Produces: `mount(root, props)` where `props` is `{ state, callbacks: { onTurnIn: () => void, onLeave: () => void } }`, and `unmount()`. `onTurnIn` fires after a successful turn-in (the screen re-renders itself immediately after) — purely for the caller to persist/refresh the HUD. Follows the same shape as `shopScreen.js`/`smithScreen.js` (a full screen, not an overlay), so it works with the existing `mountScreen` in `js/screens/screenManager.js` with no changes there. Task 5 supplies `state` and the callbacks at mount time.

This module has no dedicated automated test — pure DOM rendering driven by props/callbacks and the already-tested pure functions from Task 1, matching `shopScreen.js`/`smithScreen.js`, neither of which have test files either.

- [ ] **Step 1: Create `js/screens/questBoardScreen.js`**

```js
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { QUEST_REQUIREMENTS, getQuestRewardItemId, canTurnInQuest, turnInQuest } from '../systems/quests.js';

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const rows = Object.keys(QUEST_REQUIREMENTS).map((monsterId) => {
    const monster = MONSTERS[monsterId];
    const required = QUEST_REQUIREMENTS[monsterId];
    const progress = state.questProgress[monsterId] || 0;
    const rewardItem = ITEMS[getQuestRewardItemId(monsterId)];
    const complete = canTurnInQuest(state, monsterId);

    return `<div class="quest-row">
      <span>${monster.emoji} ${monster.name}: ${progress}/${required} killed — reward: ${rewardItem.emoji} ${rewardItem.name}</span>
      <button data-monster="${monsterId}" ${complete ? '' : 'disabled'}>Turn In</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="quest-board-screen">
      <h2>Quest Board</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-monster]').forEach((btn) => {
    btn.onclick = () => turnIn(btn.dataset.monster);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function turnIn(monsterId) {
  if (!canTurnInQuest(state, monsterId)) return;
  Object.assign(state, turnInQuest(state, monsterId));
  callbacks.onTurnIn();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

- [ ] **Step 2: Add quest-board CSS to `css/styles.css`**

Change:

```css
.shop-screen, .smith-screen, .start-screen {
  max-width: 480px;
  margin: 0 auto;
}
```

to:

```css
.shop-screen, .smith-screen, .start-screen, .quest-board-screen {
  max-width: 480px;
  margin: 0 auto;
}
```

Change:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave, .start-screen button, .inventory-panel button {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

to:

```css
.battle-menu button, .shop-row button, .smith-row button, #btn-leave, .start-screen button, .inventory-panel button, .quest-board-screen button {
  margin: 4px; padding: 8px 12px; font-size: 1rem;
}
```

Then add this new rule anywhere after the `.inventory-empty` block:

```css
.quest-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid #444;
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this file adds no new tests and isn't imported by anything yet — it's inert until Task 5 wires it in).

- [ ] **Step 4: Commit**

```bash
git add js/screens/questBoardScreen.js css/styles.css
git commit -m "feat: add quest board screen"
```

---

### Task 5: Wire the quest board into `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `incrementQuestProgress` from `js/systems/quests.js` (Task 1); `questBoardScreen` module (Task 4, `mount(root, {state, callbacks: {onTurnIn, onLeave}})`).
- Produces: `goToQuestBoard()` — new function, mirrors `goToShop`/`goToSmith` exactly; `handleTileAction` gains an `'enterQuestBoard'` branch; `handleBattleEnd`'s `'won'` branch now increments quest progress on every win.

This task has no dedicated automated test — matches every other `main.js`/DOM-orchestration task in this project's history. Correctness rests on Task 1's own tests plus the manual verification in Step 5.

- [ ] **Step 1: Add imports**

Change:

```js
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus } from './systems/ngPlus.js';
```

to:

```js
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus } from './systems/ngPlus.js';
import { incrementQuestProgress } from './systems/quests.js';
import * as questBoardScreen from './screens/questBoardScreen.js';
```

- [ ] **Step 2: Add the `'enterQuestBoard'` branch and `goToQuestBoard`**

Change:

```js
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
```

to:

```js
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'enterQuestBoard') return goToQuestBoard();
```

Then add a new function directly after `goToSmith` (after its closing brace, before `function handleEncounter`):

```js
function goToQuestBoard() {
  mountScreen(questBoardScreen, {
    state,
    callbacks: {
      onTurnIn: () => { persist(); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}
```

- [ ] **Step 3: Increment quest progress on every monster win**

Change:

```js
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

to:

```js
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }
    Object.assign(state, incrementQuestProgress(state, monsterId));

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 5: Manual verification**

If a browser is available, run `python3 -m http.server` from the repo root, open `http://localhost:8000`, and:

- Confirm a `📋` tile appears in town near the shop/smith, and walking onto it opens the Quest Board.
- Confirm all 8 monsters are listed with `0/N killed` and disabled Turn In buttons, and the reward line matches each monster's real material (spot-check goblin shows `ironScrap`, not `goblinClub`).
- Win a fight against a near-town monster (e.g. a boar). Return to the board and confirm its count went up by 1, and nothing else moved.
- Grind that monster's count up to its requirement, confirm the Turn In button becomes enabled, click it, and confirm: the reward material appears in Inventory, the counter resets to `0/N`, and the button is disabled again immediately.
- Leave and re-enter the board (or reload the page) and confirm progress persisted correctly.
- If you have an NG+-eligible save, start a New Game+ cycle and confirm quest progress is untouched by the world reset (still shows whatever counts you had before).

If no browser is available (common in this environment), substitute with: (a) a hand-trace of the diff confirming `handleTileAction`'s new branch and `goToQuestBoard`'s wiring are correctly connected, and that `incrementQuestProgress`'s call site sits inside the `'won'` branch after `monster.isBoss` handling, and (b) a Node `--input-type=module` script that imports the real `js/systems/quests.js` functions against a fake state object to replay the same sequence (increment a monster's count to just below requirement, confirm `canTurnInQuest` is false; increment once more, confirm true; turn in, confirm the reward lands and the counter resets). Write what you did and found into your report either way.

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "feat: wire quest board into the game"
```

---

## Self-Review Notes

- **Spec coverage:** exact 8-monster requirement table (Task 1's `QUEST_REQUIREMENTS`, tested), reward derived from real `dropTable` data including the goblin non-material-skip case (Task 1's `getQuestRewardItemId`, tested), no gold/XP reward (Task 1's `turnInQuest` only calls `addItem`, never `addGold`/XP logic — verified no such calls exist), progress persists across NG+ (Task 2 adds `questProgress` outside anything `resetWorldForNgPlus` touches — confirmed by inspection that `js/systems/ngPlus.js`'s reset list, unmodified by this plan, has no `questProgress` entry), immediate counter reset on turn-in (Task 1's `turnInQuest`), no confirmation dialogs (Task 4's `questBoardScreen.js` has no `confirm()`/`prompt()`), new town tile (Task 3), new screen (Task 4), wiring (Task 5) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code.
- **Type consistency:** `QUEST_REQUIREMENTS`/`getQuestRewardItemId`/`canTurnInQuest`/`turnInQuest` (Task 1) are consumed with identical signatures in both `questBoardScreen.js` (Task 4) and `main.js` (Task 5, via `incrementQuestProgress`). `incrementQuestProgress(state, monsterId)` (Task 1) matches exactly how Task 5's `handleBattleEnd` calls it (`incrementQuestProgress(state, monsterId)`, where `monsterId` is the same parameter `handleBattleEnd` already receives). `questBoardScreen.mount(root, {state, callbacks: {onTurnIn, onLeave}})` (Task 4) matches exactly how Task 5's `goToQuestBoard` calls `mountScreen(questBoardScreen, {...})`. The `'enterQuestBoard'` action string is identical in `js/tiles.js` (Task 3), `handleTileAction` (Task 5), and nowhere else needs to reference it.
