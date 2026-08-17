# Comeback Mechanic, Status Log & Hero Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a player on a losing streak an escalating free-potion comeback (1, then 2, then 3... capped at 5, reset on any win), make that — and every other flavor-banner message — visible in a new scrollable status log, and add a green revival pulse on the hero's battle sprite when they're defeated.

**Architecture:** Two new pure, DOM-free systems modules (`js/systems/comeback.js`, `js/systems/messageLog.js`) hold all the decidable logic and are independently unit-tested. `js/screens/flavorBanner.js` becomes the single integration point that both shows the transient banner and grows the persistent (in-memory, unsaved) message log, so every existing `showFlavorBanner` call site gets logged for free with zero changes to those call sites. A new overlay screen (`js/screens/messageLogScreen.js`, mirroring the existing `statsPanel.js`) displays that log behind a new HUD button. `js/main.js`'s `handleBattleEnd` composes the comeback-mechanic functions on the `'lost'` branch and resets the streak on `'won'`. The hero-revival visual is fully independent — it lives entirely inside `js/screens/battleScreen.js`'s existing `endBattle('lost')` path and new CSS, with no dependency on the comeback mechanic's own state.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- `state.lossStreak`: new integer field, default `0`, added to `createNewGame()` in `js/state.js`, backfilled in `js/main.js`'s `startGame` using the exact same falsy-check pattern as the existing `gateRewards` backfill.
- `COMEBACK_POTION_CAP = 5` — the maximum potions a single death can grant, even if the streak has climbed higher.
- Comeback grant applies on **every** death, unconditionally (not gated on current gold/potion count). A win resets the streak to `0`. A flee leaves the streak untouched.
- Comeback banner copy (exact strings):
  - 1 potion: `"Something takes pity on you — +1 potion to keep you going."`
  - N potions, N ≥ 2: `` `Another rough one... +${N} potions this time.` ``
- Message log cap: `MESSAGE_LOG_CAP = 50` entries, oldest dropped first, chronological order (oldest first) in storage — the log **screen** reverses it for newest-first display.
- The message log is in-memory only — never written to `state`, never persisted to `localStorage`, resets on page reload.
- Hero revival CSS: `.battle-revive-glow` class running `@keyframes battle-revive-pulse`, 1.1s ease-in-out, green glow via `filter: drop-shadow(0 0 10px #4ade80) brightness(1.25)` at the midpoint, `filter: none` at 0%/100%. Applied to the hero's zone/emoji elements on every `'lost'` outcome, no explicit removal needed (the battle overlay unmounts before the animation's natural end).

---

### Task 1: `comeback.js` — pure loss-streak and message logic

**Files:**
- Create: `js/systems/comeback.js`
- Test: `tests/comeback.test.js`

**Interfaces:**
- Produces: `COMEBACK_POTION_CAP` (const, `5`), `incrementLossStreak(lossStreak)` → `number`, `potionsForStreak(lossStreak)` → `number`, `getComebackMessage(potionsGranted)` → `string`. Task 3 imports all four into `js/main.js`.

- [ ] **Step 1: Write the failing tests**

Create `tests/comeback.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMEBACK_POTION_CAP,
  incrementLossStreak,
  potionsForStreak,
  getComebackMessage,
} from '../js/systems/comeback.js';

test('incrementLossStreak increases the streak by 1', () => {
  assert.equal(incrementLossStreak(0), 1);
  assert.equal(incrementLossStreak(4), 5);
});

test('COMEBACK_POTION_CAP is 5', () => {
  assert.equal(COMEBACK_POTION_CAP, 5);
});

test('potionsForStreak matches the streak count below the cap', () => {
  assert.equal(potionsForStreak(1), 1);
  assert.equal(potionsForStreak(2), 2);
  assert.equal(potionsForStreak(5), 5);
});

test('potionsForStreak clamps at the cap above it', () => {
  assert.equal(potionsForStreak(6), 5);
  assert.equal(potionsForStreak(100), 5);
});

test('getComebackMessage uses singular copy for 1 potion', () => {
  assert.equal(
    getComebackMessage(1),
    'Something takes pity on you — +1 potion to keep you going.'
  );
});

test('getComebackMessage uses escalating copy with the count for 2+ potions', () => {
  assert.equal(getComebackMessage(2), 'Another rough one... +2 potions this time.');
  assert.equal(getComebackMessage(5), 'Another rough one... +5 potions this time.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/comeback.js` does not exist yet (module not found).

- [ ] **Step 3: Implement `comeback.js`**

Create `js/systems/comeback.js`:

```js
export const COMEBACK_POTION_CAP = 5;

export function incrementLossStreak(lossStreak) {
  return lossStreak + 1;
}

export function potionsForStreak(lossStreak) {
  return Math.min(lossStreak, COMEBACK_POTION_CAP);
}

export function getComebackMessage(potionsGranted) {
  if (potionsGranted === 1) {
    return 'Something takes pity on you — +1 potion to keep you going.';
  }
  return `Another rough one... +${potionsGranted} potions this time.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `tests/comeback.test.js` cases green, no other test file affected.

- [ ] **Step 5: Commit**

```bash
git add js/systems/comeback.js tests/comeback.test.js
git commit -m "feat: add pure comeback-mechanic loss-streak logic"
```

---

### Task 2: `messageLog.js` — pure capped-history logic, and wire it into `flavorBanner.js`

**Files:**
- Create: `js/systems/messageLog.js`
- Test: `tests/messageLog.test.js`
- Modify: `js/screens/flavorBanner.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MESSAGE_LOG_CAP` (const, `50`), `appendMessage(log, text)` → `string[]` (new array, pure). `js/screens/flavorBanner.js` gains a new export `getMessageLog()` → `string[]`, consumed by Task 4's `messageLogScreen.js`. `showFlavorBanner`'s existing signature and DOM-facing behavior are unchanged — it now also grows the log as a side effect, but every existing caller (cache finds, gate rewards, quest turn-ins, first-visit text) needs zero changes.

- [ ] **Step 1: Write the failing test for `messageLog.js`**

Create `tests/messageLog.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `js/systems/messageLog.js` does not exist yet.

- [ ] **Step 3: Implement `messageLog.js`**

Create `js/systems/messageLog.js`:

```js
export const MESSAGE_LOG_CAP = 50;

export function appendMessage(log, text) {
  const next = [...log, text];
  if (next.length > MESSAGE_LOG_CAP) {
    return next.slice(next.length - MESSAGE_LOG_CAP);
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `tests/messageLog.test.js` cases green.

- [ ] **Step 5: Wire `flavorBanner.js` to grow the log, and add `getMessageLog()`**

Replace the full contents of `js/screens/flavorBanner.js` (currently just the `VISIBLE_DURATION_MS` constant, `hideTimeoutId`, and `showFlavorBanner`) with:

```js
import { appendMessage } from '../systems/messageLog.js';

const VISIBLE_DURATION_MS = 3500;

let hideTimeoutId = null;
let messageLog = [];

export function showFlavorBanner(text) {
  messageLog = appendMessage(messageLog, text);
  const banner = document.getElementById('flavor-banner');
  if (!banner) return;
  clearTimeout(hideTimeoutId);
  banner.textContent = text;
  banner.classList.add('visible');
  hideTimeoutId = setTimeout(() => {
    banner.classList.remove('visible');
  }, VISIBLE_DURATION_MS);
}

export function getMessageLog() {
  return messageLog;
}
```

Note the log grows even if the `#flavor-banner` DOM element is missing (the early `return` only skips the visual banner, not the log append) — this keeps the log usable in any test harness that doesn't mount the full DOM.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — full suite green, including any existing test that calls `showFlavorBanner` (if none exists, this step just confirms no regression).

- [ ] **Step 7: Commit**

```bash
git add js/systems/messageLog.js tests/messageLog.test.js js/screens/flavorBanner.js
git commit -m "feat: add capped message-history log, fed by every flavor banner call"
```

---

### Task 3: Wire the comeback mechanic into `handleBattleEnd`, and add `lossStreak` to state

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `COMEBACK_POTION_CAP`, `incrementLossStreak`, `potionsForStreak`, `getComebackMessage` from `js/systems/comeback.js` (Task 1). `showFlavorBanner` from `js/screens/flavorBanner.js` — already imported in `js/main.js` (see current import list, line 27: `import { showFlavorBanner } from './screens/flavorBanner.js';` — no new import needed for it).
- Produces: `state.lossStreak` (integer), read by nothing outside this task, but must exist on every game state from this point on (backfilled for old saves).

- [ ] **Step 1: Add `lossStreak` to `createNewGame()`**

In `js/state.js`, find the `createNewGame()` function's returned object (currently ends with `gateRewards: {},` right before the closing `};`). Add a new line immediately after `gateRewards: {},`:

```js
    gateRewards: {},
    lossStreak: 0,
```

- [ ] **Step 2: Add the backfill in `startGame`**

In `js/main.js`, find `startGame` (currently around line 60). It ends with this backfill block, in order:

```js
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  renderHud();
  goToMap(state.map);
}
```

Add a matching backfill for `lossStreak` right after the `gateRewards` block, before `renderHud()`:

```js
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
  renderHud();
  goToMap(state.map);
}
```

- [ ] **Step 3: Add the import for the comeback module**

In `js/main.js`, find the existing import of `incrementQuestProgress` (currently: `import { incrementQuestProgress } from './systems/quests.js';`). Add a new import line right after it:

```js
import { incrementQuestProgress } from './systems/quests.js';
import { incrementLossStreak, potionsForStreak, getComebackMessage } from './systems/comeback.js';
```

- [ ] **Step 4: Reset the streak on a win, and grant the comeback potions on a loss**

In `js/main.js`, find `handleBattleEnd` (currently starting around line 406). It currently reads:

```js
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const baseXp = resolveBattleXp(bossTierXp, monster);
    const xp = Math.round(baseXp * rewardMultiplier.xp);
    const preLevelHp = state.player.hp;
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) {
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      state.player.hp = state.player.level >= LATE_GAME_LEVEL_THRESHOLD
        ? Math.round(preLevelHp + (effectiveMaxHp - preLevelHp) * LEVEL_UP_PARTIAL_HEAL_FRACTION)
        : effectiveMaxHp;
    }

    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }
    Object.assign(state, incrementQuestProgress(state, monsterId));

    persist();
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    state.position = { ...townMap.startPosition };
    state.map = 'town';
    state.activeMiniDungeon = null;
    persist();
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
```

Change it to (two additions: `state.lossStreak = 0;` right after `Object.assign(state, incrementQuestProgress(state, monsterId));` in the `'won'` branch, and the comeback-grant block inside the `'lost'` branch):

```js
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const baseXp = resolveBattleXp(bossTierXp, monster);
    const xp = Math.round(baseXp * rewardMultiplier.xp);
    const preLevelHp = state.player.hp;
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) {
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      state.player.hp = state.player.level >= LATE_GAME_LEVEL_THRESHOLD
        ? Math.round(preLevelHp + (effectiveMaxHp - preLevelHp) * LEVEL_UP_PARTIAL_HEAL_FRACTION)
        : effectiveMaxHp;
    }

    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }
    Object.assign(state, incrementQuestProgress(state, monsterId));
    state.lossStreak = 0;

    persist();
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    state.position = { ...townMap.startPosition };
    state.map = 'town';
    state.activeMiniDungeon = null;
    state.lossStreak = incrementLossStreak(state.lossStreak);
    const potionsGranted = potionsForStreak(state.lossStreak);
    Object.assign(state, addItem(state, 'potion', potionsGranted));
    showFlavorBanner(getComebackMessage(potionsGranted));
    persist();
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
```

The `'fled'` branch is left completely unchanged — no code change needed there, per the design (fleeing neither wins nor dies, so the streak is untouched).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — full suite green. There is no existing automated test for `handleBattleEnd` itself (it's DOM/state-integration code, not a pure module), so this step is confirming no regression elsewhere, not new coverage — Task 1's unit tests already cover the comeback math in isolation.

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/main.js
git commit -m "feat: wire escalating comeback potions into battle-loss handling"
```

---

### Task 4: Status log screen and HUD button

**Files:**
- Create: `js/screens/messageLogScreen.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `getMessageLog()` from `js/screens/flavorBanner.js` (Task 2). `mount(root, { state, callbacks: { onClose } })` / `unmount()` contract, matching `js/screens/statsPanel.js` exactly (read that file for the pattern — it is the template for this screen's shape, though this screen does not need `state` for anything other than matching the shared `mount(root, props)` calling convention used by `mountOverlay`).
- Produces: nothing consumed by a later task — this is the last task in the log/comeback line.

- [ ] **Step 1: Create the message log screen**

Create `js/screens/messageLogScreen.js`:

```js
import { getMessageLog } from './flavorBanner.js';

let rootEl = null;
let callbacks = null;

function render() {
  const log = getMessageLog();
  const rows = [...log].reverse()
    .map((text) => `<div class="message-log-entry">${text}</div>`)
    .join('');

  rootEl.innerHTML = `
    <div class="overlay-panel message-log-panel">
      <h2>Status Log</h2>
      <div class="message-log-list">
        ${rows || '<div class="message-log-entry">Nothing has happened yet.</div>'}
      </div>
      <button id="btn-close-message-log">Close</button>
    </div>
  `;

  document.getElementById('btn-close-message-log').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
```

Note this screen ignores `props.state` — it only needs `getMessageLog()`, which reads from `flavorBanner.js`'s own module-level array, not from game state. `mount` still accepts `props.state` implicitly (it's just unused) so the calling convention in `openMessageLog` (Step 3 below) matches `openStats`/`openInventory` exactly, keeping every `mountOverlay` call site in `main.js` uniform.

- [ ] **Step 2: Add the Log import and HUD button**

In `js/main.js`, find the screen imports (currently includes `import * as statsPanel from './screens/statsPanel.js';` and `import * as inventoryScreen from './screens/inventoryScreen.js';`). Add a new import line right after `inventoryScreen`'s:

```js
import * as inventoryScreen from './screens/inventoryScreen.js';
import * as messageLogScreen from './screens/messageLogScreen.js';
```

Find `setHudButtonsEnabled` (currently):

```js
function setHudButtonsEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
  const inventoryButton = document.getElementById('btn-open-inventory');
  if (inventoryButton) {
    inventoryButton.disabled = !enabled;
  }
}
```

Change it to:

```js
function setHudButtonsEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
  const inventoryButton = document.getElementById('btn-open-inventory');
  if (inventoryButton) {
    inventoryButton.disabled = !enabled;
  }
  const logButton = document.getElementById('btn-open-log');
  if (logButton) {
    logButton.disabled = !enabled;
  }
}
```

Find `renderHud` (currently):

```js
function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.disabled = battleActive;
  statsButton.onclick = openStats;

  const inventoryButton = document.createElement('button');
  inventoryButton.id = 'btn-open-inventory';
  inventoryButton.textContent = '🎒 Inventory';
  inventoryButton.disabled = battleActive;
  inventoryButton.onclick = openInventory;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
}
```

Change it to:

```js
function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.disabled = battleActive;
  statsButton.onclick = openStats;

  const inventoryButton = document.createElement('button');
  inventoryButton.id = 'btn-open-inventory';
  inventoryButton.textContent = '🎒 Inventory';
  inventoryButton.disabled = battleActive;
  inventoryButton.onclick = openInventory;

  const logButton = document.createElement('button');
  logButton.id = 'btn-open-log';
  logButton.textContent = '📜 Log';
  logButton.disabled = battleActive;
  logButton.onclick = openMessageLog;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
  hud.appendChild(logButton);
}
```

- [ ] **Step 3: Add `openMessageLog`**

In `js/main.js`, find `openInventory` (currently ends with its closing `}` right before `function goToMap(mapId) {`). Add a new function right after `openInventory`'s closing brace, before `goToMap`:

```js
function openMessageLog() {
  if (battleActive) return;
  mountOverlay(messageLogScreen, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — full suite green (this task is DOM/UI wiring with no new pure-module tests of its own; Task 2's `messageLog.test.js` already covers the underlying log logic).

- [ ] **Step 5: Manual verification**

Start the game locally (check `README.md` or `package.json`'s `scripts` for how this project serves `index.html` — likely a static file server, since there's no build step). Confirm:
- A "📜 Log" button appears in the HUD next to Stats and Inventory.
- Clicking it opens an overlay showing "Nothing has happened yet." on a brand new game (before any flavor banner has fired).
- After triggering any existing flavor-banner event (e.g. finding a loot cache, or a first-visit screen banner), reopening the Log shows that message, newest entry at the top.
- The Log button disables during battle, same as Stats/Inventory.

- [ ] **Step 6: Commit**

```bash
git add js/screens/messageLogScreen.js js/main.js
git commit -m "feat: add scrollable status log screen and HUD button"
```

---

### Task 5: Hero revival animation on defeat

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: nothing from Tasks 1-4 — fully independent.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Add the revive-effect function**

In `js/screens/battleScreen.js`, find `playHitEffect` (currently):

```js
function playHitEffect(zoneEl, emojiEl, amount, isCrit) {
  emojiEl.classList.add('battle-hit-flash');
  zoneEl.classList.add('battle-hit-shake');
  showDamageNumber(zoneEl, amount, isCrit);
  setTimeout(() => {
    emojiEl.classList.remove('battle-hit-flash');
    zoneEl.classList.remove('battle-hit-shake');
  }, 220);
}
```

Add a new function immediately after it:

```js
function playReviveEffect(zoneEl, emojiEl) {
  emojiEl.classList.add('battle-revive-glow');
  zoneEl.classList.add('battle-revive-glow');
}
```

Both the zone and emoji elements get the class — the emoji element carries the `filter` glow, and applying it to the zone too keeps the effect visible even if the emoji element's own box is small. No removal call is needed: the whole battle overlay unmounts (see `handleBattleEnd` in `main.js`, called via the `setTimeout` in `endBattle` below) before the 1.1s animation would naturally finish, tearing down this DOM along with the class.

- [ ] **Step 2: Call it from `endBattle` on a loss**

Find `endBattle` (currently):

```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, monsterId);
  }, VICTORY_PAUSE_MS);
}
```

Change it to:

```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  if (outcome === 'lost') {
    playReviveEffect(elements.heroZone, elements.heroEmoji);
  }
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, monsterId);
  }, VICTORY_PAUSE_MS);
}
```

- [ ] **Step 3: Add the CSS**

In `css/styles.css`, find the existing hit-flash/shake block:

```css
.battle-hit-flash {
  filter: brightness(1.4) sepia(1) saturate(6) hue-rotate(-40deg);
}
@keyframes battle-shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}
.battle-hit-shake {
  animation: battle-shake 0.2s ease-in-out;
}
```

Add a new block immediately after it (before `.battle-damage-number`):

```css
.battle-revive-glow {
  animation: battle-revive-pulse 1.1s ease-in-out;
}
@keyframes battle-revive-pulse {
  0% { filter: none; }
  40% { filter: drop-shadow(0 0 10px #4ade80) brightness(1.25); }
  100% { filter: none; }
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — full suite green. This task has no pure-logic surface to unit test (it's a DOM class toggle plus a CSS animation), matching this project's existing convention that visual/animation effects like `playHitEffect` aren't covered by `node:test`.

- [ ] **Step 5: Manual verification**

Start the game locally, fight a monster deliberately to a loss (e.g. flee is available but choose to just take hits, or pick a fight you can't win). Confirm:
- Right as HP hits 0, the hero's emoji shows a green glow pulse (distinct from the existing red hit-flash) during the pause before the screen returns to town.
- The flavor banner then shows the comeback-mechanic message (from Task 3) as the screen transitions to town.

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: add green revival pulse on hero defeat"
```

---

## Self-Review Notes

- **Spec coverage:** all four design-doc pieces have a task — comeback potions (Task 3, backed by Task 1's pure logic), status log (Task 2 + Task 4), comeback explanation text (Task 1's `getComebackMessage`, wired in Task 3), hero revival (Task 5).
- **Ordering:** Task 2 (message log + `flavorBanner.js`) precedes Task 3 and Task 4, since both depend on `getMessageLog()`/the log-growing behavior existing first. Task 1 has no dependencies and could run before or after Task 2; it's ordered first since Task 3 needs it. Task 5 has no dependency on any other task and could run at any point — placed last only because it's independent, not because it must be.
- **Type/name consistency check:** `incrementLossStreak`, `potionsForStreak`, `getComebackMessage`, `COMEBACK_POTION_CAP` (Task 1) are imported with those exact names in Task 3. `appendMessage`, `MESSAGE_LOG_CAP` (Task 2) match between the module and its test. `getMessageLog` (Task 2, exported from `flavorBanner.js`) matches the import in Task 4's `messageLogScreen.js`. `state.lossStreak` is the same field name in `state.js` (Task 3, Step 1), the backfill (Task 3, Step 2), and the read/write in `handleBattleEnd` (Task 3, Step 4).
