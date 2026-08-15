# Boss Rematch & Escalating Difficulty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players opt into a harder dragon rematch (capped at 2 escalation steps, HP/XP doubling per step, attack/defense rising gently) via a narratively-framed yes/no prompt shown on rematch, instead of the dragon always being the exact same fight forever.

**Architecture:** A new pure `js/systems/bossTiers.js` computes tier-scaled stats and picks flavor text — no DOM dependency, fully unit-tested. A new lightweight overlay `js/screens/bossPromptScreen.js` (mirrors the existing `statsPanel.js`'s template+button pattern) shows the escalate-or-not choice. `battleScreen.js` gains an optional `monsterOverrides` prop merged onto the base monster lookup, so the battle UI itself needs zero boss-specific logic. `main.js` computes the current tier's stats once per boss encounter and threads the tier's XP back to the post-battle reward step via a small piece of module-scoped state, mirroring the existing `battleActive` flag pattern already in that file.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- `MAX_BOSS_TIER = 2`. Tiers are `0` (base), `1`, `2` (max) — exactly 2 escalation steps.
- Tier stats, computed from the dragon's base (`hp: 110, attack: 34, defense: 12, speed: 11, xp: 150`):
  | Tier | HP | Attack | Defense | Speed | XP |
  |---|---|---|---|---|---|
  | 0 | 110 | 34 | 12 | 11 | 150 |
  | 1 | 220 | 43 | 15 | 11 | 300 |
  | 2 | 440 | 53 | 19 | 11 | 600 |
  HP and XP double per tier (`2^tier`); attack and defense rise `1.25^tier` (compounding ~25%/tier); speed is unchanged at every tier. All values rounded with `Math.round`.
- Gold range and the dragon's drop table (`dragonScaleMail`/`dragonFang` chances) are unaffected by tier at every level — only combat stats and XP scale.
- The prompt shows only when: the dragon has been defeated at least once (`state.flags.dungeonBossDefeated` is `true`) AND `state.bossTier < MAX_BOSS_TIER`. Otherwise the fight starts immediately with no prompt (first-ever encounter, or already at the cap).
- Declining the prompt still starts a fight, at the current (unescalated) `state.bossTier` — there is no way to visit the boss tile without fighting.
- `state.bossTier` persists forever once escalated; there is no reset mechanism.
- 5 exact flavor lines (see Task 1) — no more, no fewer.

---

### Task 1: `js/systems/bossTiers.js` — pure tier stats and flavor text

**Files:**
- Create: `js/systems/bossTiers.js`
- Test: `tests/bossTiers.test.js`

**Interfaces:**
- Produces: `MAX_BOSS_TIER` (number, `2`), `BOSS_TIER_FLAVOR_LINES` (5-element string array), `getBossTierStats(baseMonster, tier)` → `{ hp, attack, defense, speed, xp }`, `pickBossReturnFlavor(rng = Math.random)` → one of `BOSS_TIER_FLAVOR_LINES`. Task 5 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `tests/bossTiers.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BOSS_TIER, BOSS_TIER_FLAVOR_LINES, getBossTierStats, pickBossReturnFlavor } from '../js/systems/bossTiers.js';
import { MONSTERS } from '../js/data/monsters.js';

test('constants match the design', () => {
  assert.equal(MAX_BOSS_TIER, 2);
  assert.equal(BOSS_TIER_FLAVOR_LINES.length, 5);
});

test('getBossTierStats at tier 0 matches the base dragon stats exactly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 0);
  assert.deepEqual(stats, { hp: 110, attack: 34, defense: 12, speed: 11, xp: 150 });
});

test('getBossTierStats at tier 1 doubles hp/xp and raises attack/defense by ~25%', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 1);
  assert.deepEqual(stats, { hp: 220, attack: 43, defense: 15, speed: 11, xp: 300 });
});

test('getBossTierStats at tier 2 (max) compounds correctly', () => {
  const stats = getBossTierStats(MONSTERS.dragon, 2);
  assert.deepEqual(stats, { hp: 440, attack: 53, defense: 19, speed: 11, xp: 600 });
});

test('pickBossReturnFlavor returns one of the known flavor lines by index', () => {
  assert.equal(pickBossReturnFlavor(() => 0), BOSS_TIER_FLAVOR_LINES[0]);
  assert.equal(pickBossReturnFlavor(() => 0.9999), BOSS_TIER_FLAVOR_LINES[4]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/systems/bossTiers.js` does not exist yet, so the import throws.

- [ ] **Step 3: Implement `js/systems/bossTiers.js`**

```js
export const MAX_BOSS_TIER = 2;
export const BOSS_TIER_HP_MULTIPLIER = 2;
export const BOSS_TIER_ATTACK_MULTIPLIER = 1.25;
export const BOSS_TIER_DEFENSE_MULTIPLIER = 1.25;

export const BOSS_TIER_FLAVOR_LINES = [
  "The dragon's scales gleam differently now — it's been sparring with things you haven't met yet.",
  'You catch its eye. It almost looks... pleased to see you again.',
  "Word is the dragon's been picking fights all over the mountain since your last visit.",
  'It stretches its wings, sizing you up. Ready for round two?',
  'The dragon rumbles low — something between a growl and a laugh. It remembers you.',
];

export function getBossTierStats(baseMonster, tier) {
  const hpMultiplier = BOSS_TIER_HP_MULTIPLIER ** tier;
  const attackMultiplier = BOSS_TIER_ATTACK_MULTIPLIER ** tier;
  const defenseMultiplier = BOSS_TIER_DEFENSE_MULTIPLIER ** tier;
  return {
    hp: Math.round(baseMonster.hp * hpMultiplier),
    attack: Math.round(baseMonster.attack * attackMultiplier),
    defense: Math.round(baseMonster.defense * defenseMultiplier),
    speed: baseMonster.speed,
    xp: Math.round(baseMonster.xp * hpMultiplier),
  };
}

export function pickBossReturnFlavor(rng = Math.random) {
  return BOSS_TIER_FLAVOR_LINES[Math.floor(rng() * BOSS_TIER_FLAVOR_LINES.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 new tests plus the full existing suite.

- [ ] **Step 5: Commit**

```bash
git add js/systems/bossTiers.js tests/bossTiers.test.js
git commit -m "feat: add pure boss-tier stat scaling and return flavor text"
```

---

### Task 2: `state.bossTier` in the save schema

**Files:**
- Modify: `js/state.js`
- Modify: `js/main.js:72-74`
- Modify: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: every state object (fresh or loaded) has a numeric `bossTier` field, `0` by default. Task 5 reads and increments `state.bossTier`.

- [ ] **Step 1: Write the failing test**

In `tests/state.test.js`, extend the existing `'createNewGame returns a fresh default state'` test by adding this line after the existing `assert.equal(state.activeMiniDungeon, null);` line:

```js
  assert.equal(state.bossTier, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `state.bossTier` is `undefined`.

- [ ] **Step 3: Add `bossTier` to `createNewGame()` in `js/state.js`**

Change:

```js
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
  };
}
```

to:

```js
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Backfill `state.bossTier` for existing saves in `js/main.js`**

In `js/main.js`, the load-time backward-compatibility block currently ends with (lines 72-74):

```js
if (!state.activeMiniDungeon) {
  state.activeMiniDungeon = null;
}
```

Change it to:

```js
if (!state.activeMiniDungeon) {
  state.activeMiniDungeon = null;
}
if (!state.bossTier) {
  state.bossTier = 0;
}
```

No automated test for this block (matches the four blocks above it, none of which have one either) — verify by inspection that it matches their exact shape.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/main.js tests/state.test.js
git commit -m "feat: add bossTier field to save state"
```

---

### Task 3: `js/screens/bossPromptScreen.js` — the rematch prompt overlay

**Files:**
- Create: `js/screens/bossPromptScreen.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 directly (Task 5 supplies the flavor text and callbacks at mount time).
- Produces: `mount(root, props)` where `props` is `{ text: string, callbacks: { onAccept: () => void, onDecline: () => void } }`, and `unmount()`. Follows the exact same shape as every other screen module in this project (`mapScreen.js`, `statsPanel.js`, `battleScreen.js`), so it works with the existing generic `mountOverlay`/`unmountOverlay` in `js/screens/screenManager.js` with no changes there.

This module has no dedicated automated test — it's pure DOM rendering with no logic of its own (the flavor text and the accept/decline decision both come from outside), matching `statsPanel.js`, which also has no test file.

- [ ] **Step 1: Create `js/screens/bossPromptScreen.js`**

```js
let rootEl = null;
let callbacks = null;

function render(text) {
  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>The Dragon Returns</h2>
      <p>${text}</p>
      <button id="btn-boss-fight">Fight!</button>
      <button id="btn-boss-not-yet">Not yet</button>
    </div>
  `;

  document.getElementById('btn-boss-fight').onclick = () => callbacks.onAccept();
  document.getElementById('btn-boss-not-yet').onclick = () => callbacks.onDecline();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render(props.text);
}

export function unmount() {}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this file adds no new tests and isn't imported by anything yet — it's inert until Task 5 wires it in).

- [ ] **Step 3: Commit**

```bash
git add js/screens/bossPromptScreen.js
git commit -m "feat: add boss rematch prompt overlay screen"
```

---

### Task 4: `monsterOverrides` support in `battleScreen.js`

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 directly.
- Produces: `mount(root, props)` now accepts an optional `props.monsterOverrides` (a partial `{ hp, attack, defense, speed }` object) merged onto the base `MONSTERS[monsterId]` lookup when building the monster combatant. When `monsterOverrides` is omitted or `null`, behavior is byte-identical to today. Task 5's `startBossFight` supplies this prop; every other caller of `handleEncounter`/`mountOverlay(battleScreen, ...)` (regular wandering encounters) does not, and is unaffected.

This module has no dedicated automated test (no DOM harness in this project) — verify by manual inspection that the merge is correct, and rely on Task 5's manual verification to exercise it end-to-end.

- [ ] **Step 1: Update `buildMonsterCombatant()` in `js/screens/battleScreen.js`**

Change:

```js
function buildMonsterCombatant() {
  const monster = MONSTERS[monsterId];
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed: monster.speed,
    atb: 0,
  };
}
```

to:

```js
function buildMonsterCombatant() {
  const monster = { ...MONSTERS[monsterId], ...(monsterOverrides || {}) };
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed: monster.speed,
    atb: 0,
  };
}
```

- [ ] **Step 2: Add the `monsterOverrides` module-level variable and populate it in `mount()`**

Change the module-level variable declarations at the top of the file from:

```js
let rootEl = null;
let state = null;
let monsterId = null;
let callbacks = null;
```

to:

```js
let rootEl = null;
let state = null;
let monsterId = null;
let monsterOverrides = null;
let callbacks = null;
```

Then in `mount(root, props)`, change:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  callbacks = props.callbacks;
```

to:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  monsterOverrides = props.monsterOverrides || null;
  callbacks = props.callbacks;
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (no test file exercises `battleScreen.js`, so this step is a smoke check that nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: support stat overrides for scaled monster encounters"
```

---

### Task 5: Wire the rematch prompt and tier scaling into `main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `MAX_BOSS_TIER`, `getBossTierStats`, `pickBossReturnFlavor` from `js/systems/bossTiers.js` (Task 1); `state.bossTier` (Task 2); `bossPromptScreen` module (Task 3); `battleScreen`'s `monsterOverrides` support (Task 4).
- Produces: `handleBossBattle()` and `startBossFight(tier)` — new functions replacing the direct `handleEncounter(dungeonMap.bossMonsterId)` call in `handleTileAction`'s `'bossBattle'` branch. `handleEncounter` gains a second, optional `monsterOverrides` parameter (default `null`) — its existing single-argument call sites (from `mapScreen.js`'s `onEncounter` callback) are unaffected.

This task has no dedicated automated test — matches every other `main.js`/DOM-orchestration task in this project's history (no test harness exists for this file). Correctness rests on Tasks 1-4's own tests plus the manual verification in Step 5.

- [ ] **Step 1: Add imports**

In `js/main.js`, change:

```js
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';
```

to:

```js
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';
import { MAX_BOSS_TIER, getBossTierStats, pickBossReturnFlavor } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
```

- [ ] **Step 2: Add the module-scoped tier-XP variable**

Change:

```js
// True while a battle overlay is mounted. The Stats button sits behind the
// full-viewport #overlay, so it is pointer-blocked but still keyboard-reachable;
// opening stats mid-battle would tear down the live battle overlay.
let battleActive = false;
```

to:

```js
// True while a battle overlay is mounted. The Stats button sits behind the
// full-viewport #overlay, so it is pointer-blocked but still keyboard-reachable;
// opening stats mid-battle would tear down the live battle overlay.
let battleActive = false;

// Set just before a boss fight starts, holding that fight's tier-scaled XP
// reward. handleBattleEnd reads and clears it (regardless of outcome) so it
// can never leak into a subsequent non-boss encounter's XP calculation.
let activeBossTierXp = null;
```

- [ ] **Step 3: Replace `handleTileAction`'s `'bossBattle'` branch and add the two new functions**

Change:

```js
  if (action === 'bossBattle') {
    handleEncounter(dungeonMap.bossMonsterId);
    return;
  }
```

to:

```js
  if (action === 'bossBattle') {
    handleBossBattle();
    return;
  }
```

Then add two new functions directly after `handleTreasureFound` (after its closing brace, before `function goToShop()`):

```js
function handleBossBattle() {
  if (!state.flags.dungeonBossDefeated || state.bossTier >= MAX_BOSS_TIER) {
    startBossFight(state.bossTier);
    return;
  }
  mountOverlay(bossPromptScreen, {
    text: pickBossReturnFlavor(),
    callbacks: {
      onAccept: () => {
        state.bossTier += 1;
        saveState(state);
        unmountOverlay();
        startBossFight(state.bossTier);
      },
      onDecline: () => {
        unmountOverlay();
        startBossFight(state.bossTier);
      },
    },
  });
}

function startBossFight(tier) {
  const monsterId = dungeonMap.bossMonsterId;
  const tierStats = getBossTierStats(MONSTERS[monsterId], tier);
  activeBossTierXp = tierStats.xp;
  handleEncounter(monsterId, {
    hp: tierStats.hp,
    attack: tierStats.attack,
    defense: tierStats.defense,
    speed: tierStats.speed,
  });
}
```

- [ ] **Step 4: Update `handleEncounter` and `handleBattleEnd`**

Change:

```js
function handleEncounter(monsterId) {
  battleActive = true;
  setStatsButtonEnabled(false);
  mountOverlay(battleScreen, {
    state,
    monsterId,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setStatsButtonEnabled(true);

  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const { player, leveledUp } = applyXp(state.player, monster.xp);
```

to:

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

function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setStatsButtonEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;

  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const xp = bossTierXp !== null ? bossTierXp : monster.xp;
    const { player, leveledUp } = applyXp(state.player, xp);
```

The rest of `handleBattleEnd` (drop rolling, `dungeonBossDefeated` flag, the `'lost'`/`'fled'` branches) is unchanged — only the XP source for the `'won'` branch changes, and only for boss fights (`bossTierXp` is `null` for every non-boss encounter, since `activeBossTierXp` is only ever set by `startBossFight`).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites, no regressions.

- [ ] **Step 6: Manual verification**

Run: `python3 -m http.server` from the repo root, open `http://localhost:8000` in a browser.

- If you don't already have a save with the dragon defeated, fight your way to the boss tile and win once. Confirm no prompt appeared (first-ever encounter) and the fight felt exactly as it does today.
- Walk back onto the boss tile. Confirm the prompt overlay appears with one of the 5 flavor lines and two buttons.
- Click **Not yet**. Confirm a fight starts immediately at the base stats (110 HP shown on the monster's HP bar) and, on winning, you're awarded 150 XP.
- Walk back onto the boss tile again, this time click **Fight!**. Confirm the fight starts at 220 HP, and winning awards 300 XP.
- Repeat once more (prompt should still appear, since tier 1 < max tier 2) and accept again — confirm 440 HP and 600 XP on win.
- Walk back onto the boss tile a final time — confirm NO prompt appears this time (already at tier 2, the max) and the fight starts immediately at 440 HP.
- Confirm losing a rematch still behaves as expected (returned to town, HP restored) and that gold/item drops on any of these wins look the same as a normal dragon kill (unaffected by tier).
- Reload the page between steps at least once to confirm `state.bossTier` persists correctly across a save/load cycle.

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: wire boss rematch prompt and escalating difficulty into the dragon fight"
```

---

## Self-Review Notes

- **Spec coverage:** prompt trigger conditions (Task 5's `handleBossBattle`), tier stat table (Task 1's `getBossTierStats`, verified against the exact numbers via tests), 5 flavor lines (Task 1), decline-still-fights behavior (Task 5's `onDecline` handler calling `startBossFight(state.bossTier)` unchanged), permanent no-reset `state.bossTier` (Task 2, Task 5's `onAccept` handler), gold/drop-table unaffected by tier (Task 5's `handleBattleEnd` changes only touch XP, nothing else in the `'won'` branch), `monsterOverrides` not affecting non-boss encounters (Task 4's default `null`, Task 5's `handleEncounter`'s default parameter) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code.
- **Type consistency:** `getBossTierStats(baseMonster, tier)` returns `{ hp, attack, defense, speed, xp }` — Task 5's `startBossFight` destructures exactly those 4 non-xp fields into `monsterOverrides` and reads `.xp` separately; `battleScreen.js`'s `monsterOverrides` (Task 4) expects exactly that same `{ hp, attack, defense, speed }` shape via its spread-merge. `pickBossReturnFlavor(rng = Math.random)` (Task 1) matches its call site in Task 5's `handleBossBattle` (no `rng` argument passed, using the default). `bossPromptScreen.mount(root, { text, callbacks: { onAccept, onDecline } })` (Task 3) matches exactly how Task 5's `handleBossBattle` calls `mountOverlay(bossPromptScreen, { text, callbacks: { onAccept, onDecline } })`.
