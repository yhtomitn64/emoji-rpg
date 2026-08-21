# Multi-Mob Encounters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a player has killed a monster type 10 times, give that type a chance to spawn as a group of 2-3 instead of solo, with independent per-monster combat, click/arrow/Tab targeting, a global parry sweep, and full per-monster rewards on a partial-kill-then-flee.

**Architecture:** `battleScreen.js`'s entire monster data model moves from one `monsterCombatant` to an array `monsterCombatants`, each entry carrying its own ATB/wind-up/debuff/delayed-hit state — solo encounters are just a 1-element array, not a separate code path. A new pure module handles the lifetime kill counter and the group-spawn roll. `main.js`'s reward computation loops over whichever monsters were actually killed instead of assuming exactly one.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, no build step.

**Spec:** `docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md`

## Global Constraints

- `GROUP_SPAWN_KILL_THRESHOLD = 10`, `GROUP_SPAWN_CHANCE = 0.3`, `GROUP_SIZE_MIN = 2`, `GROUP_SIZE_MAX = 3` — exact values, all named exported constants.
- `state.monsterKillCounts` is a lifetime, never-reset counter, same 8 keys as `questProgress` (`boar, bat, snake, goblin, direWolf, spider, orc, wraith`) — independent of quest-turn-in tallies.
- Every encounter, including solo ones, is represented as an array of monster ids (`monsterIds`) from `mapScreen.js` through `battleScreen.mount()` — no scalar/array branching anywhere in this codebase.
- The parry key (`s`) is a **global sweep**: it resolves every monster currently inside its own parry zone at the moment of the press, independent of which monster is targeted. Clicking a specific monster's own ATB bar stays scoped to just that monster.
- Attack and all 5 abilities act only on the currently-selected monster — no ability targets multiple monsters in this build.
- A killed group member grants **full** XP/gold/drop/quest-progress credit on a flee, exactly as if beaten solo; untouched survivors grant nothing.
- Group encounters (`monsterIds.length > 1`) are never eligible for the existing weak-mob-surrender pre-fight roll.
- No redesign of the 5 abilities' own targeting/timing mechanics, no AOE abilities, no "monster flees on its own" mechanic — all explicitly out of scope.

---

### Task 1: `groupEncounters.js` pure module

**Files:**
- Create: `js/systems/groupEncounters.js`
- Test: `tests/groupEncounters.test.js`

**Interfaces:**
- Produces: `GROUP_SPAWN_KILL_THRESHOLD`, `GROUP_SPAWN_CHANCE`, `GROUP_SIZE_MIN`, `GROUP_SIZE_MAX` (constants); `incrementKillCount(killCounts, monsterId)` → new object with `killCounts[monsterId]` incremented by 1; `rollEncounterGroup(monsterId, killCounts, rng = Math.random)` → array of 1 or more copies of `monsterId`.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_SPAWN_KILL_THRESHOLD, GROUP_SPAWN_CHANCE, GROUP_SIZE_MIN, GROUP_SIZE_MAX,
  incrementKillCount, rollEncounterGroup,
} from '../js/systems/groupEncounters.js';

test('incrementKillCount increments the given key from 0', () => {
  const result = incrementKillCount({ boar: 0, bat: 0 }, 'boar');
  assert.equal(result.boar, 1);
  assert.equal(result.bat, 0);
});

test('incrementKillCount increments an existing non-zero count', () => {
  const result = incrementKillCount({ boar: 5 }, 'boar');
  assert.equal(result.boar, 6);
});

test('incrementKillCount treats a missing key as 0', () => {
  const result = incrementKillCount({}, 'boar');
  assert.equal(result.boar, 1);
});

test('incrementKillCount does not mutate the input object', () => {
  const input = { boar: 0 };
  incrementKillCount(input, 'boar');
  assert.equal(input.boar, 0);
});

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('rollEncounterGroup returns a 1-element array below the kill threshold, regardless of rng', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD - 1 };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a 1-element array at threshold when the chance roll misses', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([GROUP_SPAWN_CHANCE, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup returns a group at threshold when the chance roll hits', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.ok(result.length >= GROUP_SIZE_MIN && result.length <= GROUP_SIZE_MAX);
  assert.ok(result.every((id) => id === 'boar'));
});

test('rollEncounterGroup can produce the minimum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0]));
  assert.equal(result.length, GROUP_SIZE_MIN);
});

test('rollEncounterGroup can produce the maximum group size', () => {
  const killCounts = { boar: GROUP_SPAWN_KILL_THRESHOLD };
  const result = rollEncounterGroup('boar', killCounts, fixedRng([0, 0.999]));
  assert.equal(result.length, GROUP_SIZE_MAX);
});

test('rollEncounterGroup treats an unseen monster id as 0 kills (never groups)', () => {
  const result = rollEncounterGroup('boar', {}, fixedRng([0, 0]));
  assert.deepEqual(result, ['boar']);
});

test('rollEncounterGroup defaults to Math.random when no rng is passed', () => {
  const result = rollEncounterGroup('boar', { boar: 0 });
  assert.deepEqual(result, ['boar']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/groupEncounters.test.js`
Expected: FAIL — `js/systems/groupEncounters.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE = 0.3;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX = 3;

export function incrementKillCount(killCounts, monsterId) {
  return { ...killCounts, [monsterId]: (killCounts[monsterId] || 0) + 1 };
}

export function rollEncounterGroup(monsterId, killCounts, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= GROUP_SPAWN_CHANCE) {
    return [monsterId];
  }
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (GROUP_SIZE_MAX - GROUP_SIZE_MIN + 1));
  return Array(size).fill(monsterId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/groupEncounters.test.js`
Expected: PASS, all 10 tests green.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 265 prior tests still green plus the 10 new ones (275 total).

- [ ] **Step 6: Commit**

```bash
git add js/systems/groupEncounters.js tests/groupEncounters.test.js
git commit -m "feat: add group-encounter kill-tracking and spawn-roll pure module"
```

---

### Task 2: `state.js` — `monsterKillCounts` field

**Files:**
- Modify: `js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createNewGame()`'s returned object gains `monsterKillCounts: { boar: 0, bat: 0, snake: 0, goblin: 0, direWolf: 0, spider: 0, orc: 0, wraith: 0 }`.

- [ ] **Step 1: Write the failing test**

Add to `tests/state.test.js`:

```js
test('createNewGame includes a zero-initialized monsterKillCounts, independent of questProgress', () => {
  const state = createNewGame();
  assert.deepEqual(state.monsterKillCounts, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/state.test.js`
Expected: FAIL — `state.monsterKillCounts` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `js/state.js`, `createNewGame`'s returned object currently has (around line 24-27):

```js
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
```

Add a new field right after it:

```js
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
    monsterKillCounts: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/state.test.js`
Expected: PASS, all tests green including the new one. The existing `serializeState`/`deserializeState` round-trip test exercises the new field automatically since it does a `deepEqual` on the whole state object.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/state.js tests/state.test.js
git commit -m "feat: add monsterKillCounts to createNewGame"
```

---

### Task 3: `battleScreen.js` — array-shaped monster data model, tick loop, win/loss, rewards reporting

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `createWindupState, startWindup, tickWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess` from `../systems/parry.js` (already imported, unchanged). `MONSTERS` from `../data/monsters.js` (unchanged).
- Produces: `mount(root, props)` now takes `props.monsterIds` (array) and `props.monsterOverrides` (array, same length, entries may be `null`) instead of scalar `monsterId`/`monsterOverrides`. `callbacks.onBattleEnd(outcome, killedMonsterIds)` — second argument is now always an array (possibly empty), not a single id. Later tasks (4 and 5) consume the module-level `monsterCombatants` array and the per-monster `resolveMonsterWindup(monster, parried)` signature this task establishes.

**Scoping note for this task:** Attack and abilities continue to always act on `monsterCombatants[0]` (the first monster) in this task — real click/arrow/Tab target selection is Task 4's job, layered on top of the array-shaped foundation this task builds. Similarly, the `s` keydown parry sweep in this task only resolves `monsterCombatants[0]`'s wind-up — Task 5 upgrades it to sweep every monster currently in its parry zone. This is a deliberate, temporary scoping choice, not a bug: it keeps this already-large task reviewable, and the next two tasks land immediately after it.

This task has no dedicated test file — `battleScreen.js` has no existing test file in this codebase (screen modules are DOM-driving, verified manually, matching the established convention for `mapScreen.js` and every prior `battleScreen.js` change). Run the full suite after each step to confirm no regressions in the rest of the codebase; manual verification of the actual battle flow is Task 8.

- [ ] **Step 1: Replace the module-level state block**

Currently (lines 13-30):

```js
let rootEl = null;
let state = null;
let monsterId = null;
let monsterOverrides = null;
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatant = null;
let battleOver = false;
let log = [];
let elements = {};
let endBattleTimeoutId = null;
let abilityCooldowns = {};
let buffState = createBuffState();
let defenseDebuff = null;
let pendingDelayedHit = null;
let abilityActionInFlight = false;
let monsterWindup = createWindupState();
```

Replace with:

```js
let rootEl = null;
let state = null;
let monsterIds = [];
let monsterOverridesList = [];
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatants = [];
let battleOver = false;
let log = [];
let elements = {};
let endBattleTimeoutId = null;
let abilityCooldowns = {};
let buffState = createBuffState();
let abilityActionInFlight = false;
```

(`defenseDebuff`, `pendingDelayedHit`, and `monsterWindup` move onto each monster combatant object individually in Step 2 — they're no longer module-level globals.)

- [ ] **Step 2: Replace `buildMonsterCombatant`**

Currently (lines 45-55):

```js
function buildMonsterCombatant() {
  const monster = { ...MONSTERS[monsterId], ...(monsterOverrides || {}) };
  const enemySlowPercent = getEquipmentBonuses(state).enemySlowPercent;
  const speed = applyEnemySlow(monster.speed, enemySlowPercent);
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    atb: 0,
  };
}
```

Replace with:

```js
function buildMonsterCombatant(monsterId, overrides) {
  const monster = { ...MONSTERS[monsterId], ...(overrides || {}) };
  const enemySlowPercent = getEquipmentBonuses(state).enemySlowPercent;
  const speed = applyEnemySlow(monster.speed, enemySlowPercent);
  return {
    monsterId,
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    atb: 0,
    windup: createWindupState(),
    defenseDebuff: null,
    pendingDelayedHit: null,
  };
}
```

- [ ] **Step 3: Replace `buildDom` and its `elements` assignment**

Currently (lines 81-138):

```js
function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass}">
      <div class="battle-main">
        <div class="battle-combatants-row">
          <div class="battle-decoration">${battleDecorationHtml()}</div>
          <div class="battle-combatant" id="battle-monster-zone">
            <div class="battle-emoji battle-monster-emoji" id="battle-monster-emoji">${monsterCombatant.emoji}</div>
            <div class="battle-name">${monsterCombatant.name}</div>
            <div class="battle-hp-bar"><div class="battle-hp-fill" id="battle-monster-hp-fill"></div></div>
            <div class="battle-hp-text" id="battle-monster-hp-text"></div>
            <div class="battle-atb-bar" id="battle-monster-atb-bar">
              <div class="battle-parry-zone"></div>
              <div class="battle-atb-fill" id="battle-monster-atb-fill"></div>
            </div>
            <div class="battle-parry-hint" id="battle-parry-hint"></div>
          </div>
          <div class="battle-divider">⚔️</div>
          <div class="battle-combatant" id="battle-hero-zone">
            <div class="battle-emoji" id="battle-hero-emoji">${playerCombatant.emoji}</div>
            <div class="battle-name">You</div>
            <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
            <div class="battle-hp-text" id="battle-hero-hp-text"></div>
            <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-hero-atb-fill"></div></div>
            <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
          </div>
        </div>
        ${timingMeterHtml()}
        <div class="battle-menu" id="battle-menu"></div>
      </div>
      <div class="battle-sidebar">
        <div class="battle-log-label">Battle Log</div>
        <div class="battle-log" id="battle-log"></div>
      </div>
    </div>
  `;

  elements = {
    monsterZone: document.getElementById('battle-monster-zone'),
    monsterEmoji: document.getElementById('battle-monster-emoji'),
    monsterHpFill: document.getElementById('battle-monster-hp-fill'),
    monsterHpText: document.getElementById('battle-monster-hp-text'),
    monsterAtbFill: document.getElementById('battle-monster-atb-fill'),
    monsterAtbBar: document.getElementById('battle-monster-atb-bar'),
    parryHint: document.getElementById('battle-parry-hint'),
    heroZone: document.getElementById('battle-hero-zone'),
    heroEmoji: document.getElementById('battle-hero-emoji'),
    heroHpFill: document.getElementById('battle-hero-hp-fill'),
    heroHpText: document.getElementById('battle-hero-hp-text'),
    heroAtbFill: document.getElementById('battle-hero-atb-fill'),
    buffIndicator: document.getElementById('battle-buff-indicator'),
    menu: document.getElementById('battle-menu'),
    log: document.getElementById('battle-log'),
    timingMeter: document.getElementById('battle-timing-meter'),
    timingFill: document.getElementById('battle-timing-fill'),
  };
}
```

Replace with:

```js
function monsterSlotHtml(mc, index) {
  return `
          <div class="battle-combatant battle-monster-slot" id="battle-monster-zone-${index}">
            <div class="battle-emoji battle-monster-emoji" id="battle-monster-emoji-${index}">${mc.emoji}</div>
            <div class="battle-name">${mc.name}</div>
            <div class="battle-hp-bar"><div class="battle-hp-fill" id="battle-monster-hp-fill-${index}"></div></div>
            <div class="battle-hp-text" id="battle-monster-hp-text-${index}"></div>
            <div class="battle-atb-bar" id="battle-monster-atb-bar-${index}">
              <div class="battle-parry-zone"></div>
              <div class="battle-atb-fill" id="battle-monster-atb-fill-${index}"></div>
            </div>
            <div class="battle-parry-hint" id="battle-parry-hint-${index}"></div>
          </div>`;
}

function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass}">
      <div class="battle-main">
        <div class="battle-combatants-row">
          <div class="battle-decoration">${battleDecorationHtml()}</div>
          <div class="battle-monster-row" id="battle-monster-row">
            ${monsterCombatants.map((mc, i) => monsterSlotHtml(mc, i)).join('')}
          </div>
          <div class="battle-divider">⚔️</div>
          <div class="battle-combatant" id="battle-hero-zone">
            <div class="battle-emoji" id="battle-hero-emoji">${playerCombatant.emoji}</div>
            <div class="battle-name">You</div>
            <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
            <div class="battle-hp-text" id="battle-hero-hp-text"></div>
            <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-hero-atb-fill"></div></div>
            <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
          </div>
        </div>
        ${timingMeterHtml()}
        <div class="battle-menu" id="battle-menu"></div>
      </div>
      <div class="battle-sidebar">
        <div class="battle-log-label">Battle Log</div>
        <div class="battle-log" id="battle-log"></div>
      </div>
    </div>
  `;

  elements = {
    monsterRow: document.getElementById('battle-monster-row'),
    monsterZones: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-zone-${i}`)),
    monsterEmojis: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-emoji-${i}`)),
    monsterHpFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-fill-${i}`)),
    monsterHpTexts: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-text-${i}`)),
    monsterAtbFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-fill-${i}`)),
    monsterAtbBars: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-bar-${i}`)),
    parryHints: monsterCombatants.map((_, i) => document.getElementById(`battle-parry-hint-${i}`)),
    heroZone: document.getElementById('battle-hero-zone'),
    heroEmoji: document.getElementById('battle-hero-emoji'),
    heroHpFill: document.getElementById('battle-hero-hp-fill'),
    heroHpText: document.getElementById('battle-hero-hp-text'),
    heroAtbFill: document.getElementById('battle-hero-atb-fill'),
    buffIndicator: document.getElementById('battle-buff-indicator'),
    menu: document.getElementById('battle-menu'),
    log: document.getElementById('battle-log'),
    timingMeter: document.getElementById('battle-timing-meter'),
    timingFill: document.getElementById('battle-timing-fill'),
  };
}
```

- [ ] **Step 4: Replace `updateHpBars` and `updateAtbBars`**

Currently (lines 196-211):

```js
function updateHpBars() {
  elements.monsterHpFill.style.width = `${percent(monsterCombatant.hp, monsterCombatant.maxHp)}%`;
  elements.monsterHpText.textContent = `HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}`;
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
}

function updateAtbBars() {
  const monsterAtbPercent = monsterWindup.active
    ? windupElapsedPercent(monsterWindup)
    : percent(monsterCombatant.atb, ATB_MAX);
  elements.monsterAtbFill.style.width = `${monsterAtbPercent}%`;
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
  elements.monsterAtbBar.classList.toggle('battle-atb-bar-windup', monsterWindup.active);
  elements.parryHint.textContent = monsterWindup.active ? 'Parry! (s)' : '';
}
```

Replace with:

```js
function updateHpBars() {
  monsterCombatants.forEach((mc, i) => {
    elements.monsterHpFills[i].style.width = `${percent(mc.hp, mc.maxHp)}%`;
    elements.monsterHpTexts[i].textContent = `HP ${mc.hp}/${mc.maxHp}`;
    elements.monsterZones[i].classList.toggle('battle-monster-slot-dead', mc.hp <= 0);
  });
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
}

function updateAtbBars() {
  monsterCombatants.forEach((mc, i) => {
    const monsterAtbPercent = mc.windup.active
      ? windupElapsedPercent(mc.windup)
      : percent(mc.atb, ATB_MAX);
    elements.monsterAtbFills[i].style.width = `${monsterAtbPercent}%`;
    elements.monsterAtbBars[i].classList.toggle('battle-atb-bar-windup', mc.windup.active);
    elements.parryHints[i].textContent = mc.windup.active ? 'Parry! (s)' : '';
  });
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}
```

- [ ] **Step 5: Update `playerAttack` and `playerUseAbility` to target `monsterCombatants[0]`**

In `playerAttack()` (lines 329-352), replace every use of the old singular `monsterCombatant` with `monsterCombatants[0]`, and use `elements.monsterZones[0]`/`elements.monsterEmojis[0]` in the `playHitEffect` call:

```js
function playerAttack() {
  if (abilityActionInFlight) return;
  const target = monsterCombatants[0];
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff));
  target.hp = result.monsterHp;
  target.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  log.push(result.isCrit
    ? `Critical! You hit ${target.name} for ${result.damage}!`
    : `You hit ${target.name} for ${result.damage}.`);
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZones[0], elements.monsterEmojis[0], result.damage, result.isCrit);
  checkOutcome();
  updateMenu();
}
```

In `playerUseAbility(abilityId)` (lines 354-416), the buff branch (`ability.type === 'buff'`) is untouched — it never references a monster. The damage branch replaces every use of `monsterCombatant`/`defenseDebuff`/`pendingDelayedHit` with `monsterCombatants[0]` and that object's own fields:

```js
async function playerUseAbility(abilityId) {
  if (abilityActionInFlight) return;
  abilityActionInFlight = true;
  try {
    const ability = ABILITIES.find((a) => a.id === abilityId);
    if (ability.type === 'buff') {
      buffState = activateBuff(ability);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      playerCombatant.atb = 0;
      log.push(`You use ${ability.name}! Your attacks hit harder for a while.`);
      updateAtbBars();
      updateBuffIndicator();
      updateLog();
      updateMenu();
      return;
    }
    const target = monsterCombatants[0];
    const buffActiveAtPress = buffState.active;
    const defenseDebuffAtPress = target.defenseDebuff;
    const timingHit = await runTimingMeter();
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit);
    target.hp = result.monsterHp;
    target.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    abilityCooldowns[abilityId] = ability.cooldownMs;
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    if (ability.id === 'sweep') {
      target.defenseDebuff = createDefenseDebuff(ability);
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
    log.push((result.isCrit
      ? `Critical! You use ${ability.name} on ${target.name} for ${result.damage}!`
      : `You use ${ability.name} on ${target.name} for ${result.damage}.`) + timingSuffix);
    updateHpBars();
    updateAtbBars();
    updateLog();
    playHitEffect(elements.monsterZones[0], elements.monsterEmojis[0], result.damage, result.isCrit);
    checkOutcome();
    updateMenu();
  } finally {
    abilityActionInFlight = false;
  }
}
```

- [ ] **Step 6: Update `playerFlee`'s boss check**

Currently (lines 436-451) reads `if (MONSTERS[monsterId].isBoss)`. Replace that one line with:

```js
  if (monsterIds.some((id) => MONSTERS[id].isBoss)) {
```

(The rest of `playerFlee` is unchanged. This is always `false` for a real group per this build's design — bosses never appear in a `monsterTable`-rolled group — but stays a correct, general check for the solo boss-fight path, whose `monsterIds` is always a 1-element array.)

- [ ] **Step 7: Replace `monsterAttack` and `resolveMonsterWindup` to take an explicit monster argument**

Currently (lines 453-487):

```js
function monsterAttack() {
  const result = resolveMonsterAttack(monsterCombatant, playerCombatant);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monsterCombatant.atb = result.monsterAtb;
  log.push(result.isCrit
    ? `Critical! ${monsterCombatant.name} hits you for ${result.damage}!`
    : `${monsterCombatant.name} hits you for ${result.damage}.`);
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
  checkOutcome();
}

function resolveMonsterWindup(parried) {
  if (battleOver) return;
  if (!monsterWindup.active) return;
  const elapsedPercent = windupElapsedPercent(monsterWindup);
  monsterWindup = createWindupState();
  if (parried && resolveParryAttempt(elapsedPercent)) {
    const { damage, isCrit } = rollIncomingDamage(monsterCombatant, playerCombatant);
    const result = resolveParrySuccess(monsterCombatant, damage);
    monsterCombatant.hp = result.monsterHp;
    monsterCombatant.atb = result.monsterAtb;
    log.push(`You parry ${monsterCombatant.name}'s attack and strike back for ${result.reflectedDamage}!`);
    updateHpBars();
    updateLog();
    playHitEffect(elements.monsterZone, elements.monsterEmoji, result.reflectedDamage, false);
    checkOutcome();
  } else {
    monsterAttack();
  }
  updateAtbBars();
  updateMenu();
}
```

Replace with:

```js
function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monster.atb = result.monsterAtb;
  log.push(result.isCrit
    ? `Critical! ${monster.name} hits you for ${result.damage}!`
    : `${monster.name} hits you for ${result.damage}.`);
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
  checkOutcome();
}

function resolveMonsterWindup(monster, parried) {
  if (battleOver) return;
  if (!monster.windup.active) return;
  const elapsedPercent = windupElapsedPercent(monster.windup);
  monster.windup = createWindupState();
  const index = monsterCombatants.indexOf(monster);
  if (parried && resolveParryAttempt(elapsedPercent)) {
    const { damage, isCrit } = rollIncomingDamage(monster, playerCombatant);
    const result = resolveParrySuccess(monster, damage);
    monster.hp = result.monsterHp;
    monster.atb = result.monsterAtb;
    log.push(`You parry ${monster.name}'s attack and strike back for ${result.reflectedDamage}!`);
    updateHpBars();
    updateLog();
    playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], result.reflectedDamage, false);
    checkOutcome();
  } else {
    monsterAttack(monster);
  }
  updateAtbBars();
  updateMenu();
}
```

(`monsterCombatants.indexOf(monster)` is a small, deliberate simplicity choice: it's a fixed-size array of 1-3 items, so an `indexOf` scan is negligible cost, and it avoids threading an extra index parameter through every call site in this task. A later cleanup could store the index on the object itself if this file ever needs it in a hot path — not needed here.)

- [ ] **Step 8: Replace `checkOutcome` and `tick`**

Currently (lines 489-534):

```js
function checkOutcome() {
  if (monsterCombatant.hp <= 0) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  monsterCombatant.atb = tickGauge(monsterCombatant.atb, monsterCombatant.speed, 1);
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);

  if (isReady(monsterCombatant.atb) && !monsterWindup.active) {
    monsterWindup = startWindup();
  } else if (monsterWindup.active) {
    monsterWindup = tickWindup(monsterWindup, 300);
    if (isWindupComplete(monsterWindup)) {
      resolveMonsterWindup(false);
    }
  }
  if (battleOver) return;

  defenseDebuff = tickDefenseDebuff(defenseDebuff, 300);
  if (pendingDelayedHit) {
    pendingDelayedHit.dueAtMs -= 300;
    if (pendingDelayedHit.dueAtMs <= 0) {
      const amount = pendingDelayedHit.amount;
      pendingDelayedHit = null;
      monsterCombatant.hp = Math.max(0, monsterCombatant.hp - amount);
      monsterCombatant.atb = applyKnockback(monsterCombatant.atb, ATB_KNOCKBACK);
      log.push(`Slash's bleed hits ${monsterCombatant.name} for ${amount}!`);
      updateHpBars();
      updateAtbBars();
      updateLog();
      playHitEffect(elements.monsterZone, elements.monsterEmoji, amount, false);
      checkOutcome();
    }
  }

  updateAtbBars();
  updateMenu();
  updateBuffIndicator();
}
```

Replace with:

```js
function checkOutcome() {
  if (monsterCombatants.every((mc) => mc.hp <= 0)) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);

  for (const mc of monsterCombatants) {
    if (mc.hp <= 0) continue;
    mc.atb = tickGauge(mc.atb, mc.speed, 1);
    if (isReady(mc.atb) && !mc.windup.active) {
      mc.windup = startWindup();
    } else if (mc.windup.active) {
      mc.windup = tickWindup(mc.windup, 300);
      if (isWindupComplete(mc.windup)) {
        resolveMonsterWindup(mc, false);
      }
    }
    if (battleOver) return;

    mc.defenseDebuff = tickDefenseDebuff(mc.defenseDebuff, 300);
    if (mc.pendingDelayedHit) {
      mc.pendingDelayedHit.dueAtMs -= 300;
      if (mc.pendingDelayedHit.dueAtMs <= 0) {
        const amount = mc.pendingDelayedHit.amount;
        mc.pendingDelayedHit = null;
        mc.hp = Math.max(0, mc.hp - amount);
        mc.atb = applyKnockback(mc.atb, ATB_KNOCKBACK);
        log.push(`Slash's bleed hits ${mc.name} for ${amount}!`);
        updateHpBars();
        updateAtbBars();
        updateLog();
        const index = monsterCombatants.indexOf(mc);
        playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], amount, false);
        checkOutcome();
        if (battleOver) return;
      }
    }
  }

  updateAtbBars();
  updateMenu();
  updateBuffIndicator();
}
```

(The `if (battleOver) return;` guards inside the loop preserve the exact same protection the original single-monster `tick()` had after its own windup-resolution and delayed-hit blocks — a monster's own actions can end the battle mid-tick, and nothing after that point should keep running.)

- [ ] **Step 9: Replace `endBattle`**

Currently (lines 536-548):

```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  if (outcome === 'lost') {
    playReviveEffect(elements.heroZone, elements.heroEmoji);
  }
  monsterWindup = createWindupState();
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, monsterId);
  }, VICTORY_PAUSE_MS);
}
```

Replace with:

```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  if (outcome === 'lost') {
    playReviveEffect(elements.heroZone, elements.heroEmoji);
  }
  const killedMonsterIds = monsterCombatants.filter((mc) => mc.hp <= 0).map((mc) => mc.monsterId);
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, killedMonsterIds);
  }, VICTORY_PAUSE_MS);
}
```

(The old `monsterWindup = createWindupState();` line is removed — there's no longer a single module-level windup to reset; each monster's own `windup` field simply stops being ticked once `battleOver` is true, since `tick()`'s very first line already returns early in that case.)

- [ ] **Step 10: Replace `mount`**

Currently (lines 550-585):

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  monsterOverrides = props.monsterOverrides || null;
  callbacks = props.callbacks;
  battleOver = false;
  log = [pickAppearLine(MONSTERS[monsterId])];
  playerCombatant = buildPlayerCombatant();
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  defenseDebuff = null;
  pendingDelayedHit = null;
  abilityActionInFlight = false;
  monsterWindup = createWindupState();
  monsterCombatant = buildMonsterCombatant();
  buildDom();
  elements.monsterAtbBar.onclick = () => resolveMonsterWindup(true);
  elements.parryHint.onclick = () => resolveMonsterWindup(true);
  updateHpBars();
  updateAtbBars();

  const weakMobOutcome = resolveWeakMobEncounter(playerCombatant, monsterCombatant, Boolean(MONSTERS[monsterId].isBoss));
  if (weakMobOutcome) {
    log.push(WEAK_MOB_LOG_MESSAGES[weakMobOutcome](monsterCombatant.name));
    updateLog();
    playWeakMobFleeEffect(elements.monsterEmoji);
    endBattle(weakMobOutcome);
    return;
  }

  updateLog();
  updateMenu();
  intervalId = setInterval(tick, 300);
  window.addEventListener('keydown', handleKeydown);
}
```

Replace with:

```js
export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterIds = props.monsterIds;
  monsterOverridesList = props.monsterOverrides || monsterIds.map(() => null);
  callbacks = props.callbacks;
  battleOver = false;
  log = [pickAppearLine(MONSTERS[monsterIds[0]])];
  playerCombatant = buildPlayerCombatant();
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  abilityActionInFlight = false;
  monsterCombatants = monsterIds.map((id, i) => buildMonsterCombatant(id, monsterOverridesList[i]));
  buildDom();
  monsterCombatants.forEach((mc, i) => {
    elements.monsterAtbBars[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
    elements.parryHints[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
  });
  updateHpBars();
  updateAtbBars();

  if (monsterIds.length === 1) {
    const soloMonster = monsterCombatants[0];
    const weakMobOutcome = resolveWeakMobEncounter(playerCombatant, soloMonster, Boolean(MONSTERS[monsterIds[0]].isBoss));
    if (weakMobOutcome) {
      log.push(WEAK_MOB_LOG_MESSAGES[weakMobOutcome](soloMonster.name));
      updateLog();
      playWeakMobFleeEffect(elements.monsterEmojis[0]);
      endBattle(weakMobOutcome);
      return;
    }
  }

  updateLog();
  updateMenu();
  intervalId = setInterval(tick, 300);
  window.addEventListener('keydown', handleKeydown);
}
```

(The weak-mob-surrender pre-fight check is now gated on `monsterIds.length === 1` — a group encounter, per this build's design, is never eligible for it and always proceeds straight into the normal battle loop.)

- [ ] **Step 11: Update the `'s'` keydown branch's call site for the new signature**

Currently (lines 301-309), inside `handleKeydown`:

```js
  if (key === 's' || key === 'S') {
    // 's' collides with the map screen's WASD-south binding; this is only
    // safe because screenManager.js's mountOverlay() calls pause() on the
    // underlying screen, detaching its keydown listener while this overlay
    // is mounted. If a battle is ever shown without that pause, this would
    // also move the hero on the map underneath.
    resolveMonsterWindup(true);
    return;
  }
```

Replace the call with the new two-argument signature, keeping this task's scoping to `monsterCombatants[0]` (Task 5 upgrades this to a real sweep):

```js
  if (key === 's' || key === 'S') {
    // 's' collides with the map screen's WASD-south binding; this is only
    // safe because screenManager.js's mountOverlay() calls pause() on the
    // underlying screen, detaching its keydown listener while this overlay
    // is mounted. If a battle is ever shown without that pause, this would
    // also move the hero on the map underneath.
    resolveMonsterWindup(monsterCombatants[0], true);
    return;
  }
```

- [ ] **Step 12: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 276 tests green (275 after Task 1 + 1 from Task 2's `monsterKillCounts` test; this task adds no new test file and removes none).

- [ ] **Step 13: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: rework battleScreen.js monster data model to an array of combatants"
```

---

### Task 4: `battleScreen.js` — target selection (click/arrow/Tab) and visual selection state

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `monsterCombatants` array, `elements.monsterZones`/`monsterEmojis` from Task 3.
- Produces: module-level `selectedMonsterIndex`; `cycleTarget(direction)`; `updateMonsterSelection()`. `playerAttack()`/`playerUseAbility()` now target `monsterCombatants[selectedMonsterIndex]` instead of the Task 3 placeholder `monsterCombatants[0]`.

- [ ] **Step 1: Add the `selectedMonsterIndex` state and targeting functions**

In `js/screens/battleScreen.js`, add a new module-level variable alongside the others (after `let monsterCombatants = [];`, from Task 3):

```js
let selectedMonsterIndex = 0;
```

Add these two new functions, placed after `buildMonsterCombatant` (or any convenient spot before their first use in `mount`/`handleKeydown`):

```js
function livingIndices() {
  return monsterCombatants.map((mc, i) => i).filter((i) => monsterCombatants[i].hp > 0);
}

function cycleTarget(direction) {
  const living = livingIndices();
  if (living.length === 0) return;
  const currentPos = living.indexOf(selectedMonsterIndex);
  const nextPos = currentPos === -1
    ? 0
    : (currentPos + direction + living.length) % living.length;
  selectedMonsterIndex = living[nextPos];
  updateMonsterSelection();
}

function updateMonsterSelection() {
  monsterCombatants.forEach((mc, i) => {
    elements.monsterZones[i].classList.toggle('battle-monster-slot-selected', i === selectedMonsterIndex);
    elements.monsterZones[i].classList.toggle('battle-monster-slot-dim', i !== selectedMonsterIndex && mc.hp > 0);
  });
}
```

- [ ] **Step 2: Wire click-to-select and re-anchor selection in `mount`**

In `mount()`, inside the `monsterCombatants.forEach((mc, i) => { ... })` block added in Task 3 (the one wiring `elements.monsterAtbBars[i].onclick`/`elements.parryHints[i].onclick`), add a click handler on the zone itself for selection:

```js
  monsterCombatants.forEach((mc, i) => {
    elements.monsterZones[i].onclick = () => {
      selectedMonsterIndex = i;
      updateMonsterSelection();
    };
    elements.monsterAtbBars[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
    elements.parryHints[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
  });
```

(`event.stopPropagation()` in the bar/hint handlers stops the click from also bubbling up to the zone's own `onclick` — otherwise clicking a monster's ATB bar to attempt a parry would also silently re-select that monster as the target, which is confusing when you're clicking a bar specifically to parry, not to switch focus.)

Immediately after that `forEach` block (still inside `mount`, before `updateHpBars();`), reset and render the initial selection:

```js
  selectedMonsterIndex = 0;
  updateMonsterSelection();
```

- [ ] **Step 3: Re-anchor selection whenever a monster dies**

In `updateHpBars()` (from Task 3), after the existing `forEach` that updates HP fills/text/dead-class, add a call to keep the selection valid:

```js
function updateHpBars() {
  monsterCombatants.forEach((mc, i) => {
    elements.monsterHpFills[i].style.width = `${percent(mc.hp, mc.maxHp)}%`;
    elements.monsterHpTexts[i].textContent = `HP ${mc.hp}/${mc.maxHp}`;
    elements.monsterZones[i].classList.toggle('battle-monster-slot-dead', mc.hp <= 0);
  });
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
  if (monsterCombatants[selectedMonsterIndex] && monsterCombatants[selectedMonsterIndex].hp <= 0) {
    cycleTarget(1);
  }
}
```

(`cycleTarget(1)` when the currently-selected monster just died re-anchors to the next living monster via the same `livingIndices()`/`currentPos === -1` logic already written in Step 1 — the dead monster is no longer in `livingIndices()`, so `currentPos` is `-1`, and the function's existing `currentPos === -1 ? 0 : ...` branch lands on `living[0]`, the first remaining living monster.)

- [ ] **Step 4: Add Left/Right/Tab keydown handling**

In `handleKeydown`, add a new branch. Place it after the `'s'`/`'S'` branch and before the `'i'`/`'I'` branch (targeting, like parry, doesn't depend on the player's own ATB readiness):

```js
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
    event.preventDefault();
    cycleTarget(key === 'ArrowLeft' ? -1 : 1);
    return;
  }
```

- [ ] **Step 5: Switch `playerAttack`/`playerUseAbility` from `monsterCombatants[0]` to the selection**

In both functions (written in Task 3 Step 5), change:

```js
  const target = monsterCombatants[0];
```

to:

```js
  const target = monsterCombatants[selectedMonsterIndex];
```

(One line in `playerAttack`, one line in `playerUseAbility` — everything else in both functions is unchanged, since they already operate on whatever `target` refers to.)

- [ ] **Step 6: Add the CSS for multi-monster layout and selection state**

In `css/styles.css`, the existing `.battle-combatant` rule (around line 66-69) stays as-is (it still applies to the hero zone and, via the shared class, each monster slot's base layout). Add these new rules after the existing `.battle-parry-hint` rule (ends around line 140):

```css
.battle-monster-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 18px;
  flex-wrap: wrap;
}
.battle-monster-slot {
  transition: transform 0.15s, opacity 0.15s;
  cursor: pointer;
}
.battle-monster-slot .battle-hp-bar,
.battle-monster-slot .battle-atb-bar {
  width: 110px;
}
.battle-monster-slot-selected {
  transform: scale(1.15);
}
.battle-monster-slot-dim {
  transform: scale(0.85);
  opacity: 0.55;
}
.battle-monster-slot-dead {
  display: none;
}
```

(This matches the "B" layout approved during design — the selected target scales up, others dim and shrink slightly. A dead monster's slot is hidden outright via `display: none`, which also makes the surrounding flex row reflow around the gap automatically, satisfying the "dead monsters drop out of the row" behavior from the spec without needing to rebuild the DOM.)

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 276 tests green.

- [ ] **Step 8: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: add click/arrow/Tab target selection for multi-monster battles"
```

---

### Task 5: `battleScreen.js` — global parry sweep

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `resolveMonsterWindup(monster, parried)`, `monsterCombatants`, `windupElapsedPercent`, `resolveParryAttempt` — all from Task 3/existing imports.
- Produces: the `'s'`/`'S'` keydown branch now sweeps every monster currently in its parry zone, rather than only `monsterCombatants[0]`.

- [ ] **Step 1: Replace the `'s'`/`'S'` keydown branch**

Currently (from Task 3 Step 11):

```js
  if (key === 's' || key === 'S') {
    // 's' collides with the map screen's WASD-south binding; this is only
    // safe because screenManager.js's mountOverlay() calls pause() on the
    // underlying screen, detaching its keydown listener while this overlay
    // is mounted. If a battle is ever shown without that pause, this would
    // also move the hero on the map underneath.
    resolveMonsterWindup(monsterCombatants[0], true);
    return;
  }
```

Replace with:

```js
  if (key === 's' || key === 'S') {
    // 's' collides with the map screen's WASD-south binding; this is only
    // safe because screenManager.js's mountOverlay() calls pause() on the
    // underlying screen, detaching its keydown listener while this overlay
    // is mounted. If a battle is ever shown without that pause, this would
    // also move the hero on the map underneath.
    //
    // Global sweep, not a targeted parry: every monster currently sitting in
    // its own parry zone at this exact instant gets parried in one press,
    // regardless of which monster is selected. This is a deliberate design
    // choice (see docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md) -
    // clicking a specific monster's own ATB bar/hint stays scoped to just
    // that monster (see mount()'s per-monster onclick wiring).
    for (const mc of monsterCombatants) {
      if (mc.hp > 0 && mc.windup.active && resolveParryAttempt(windupElapsedPercent(mc.windup))) {
        resolveMonsterWindup(mc, true);
      }
    }
    return;
  }
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 276 tests green.

- [ ] **Step 3: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: make the parry key sweep every in-zone monster at once"
```

---

### Task 6: `main.js` — encounter/battle-end wiring, per-monster rewards, legacy backfill

**Files:**
- Modify: `js/main.js`
- Modify: `js/systems/messageLog.js`

**Interfaces:**
- Consumes: `rollEncounterGroup`, `incrementKillCount` from `../systems/groupEncounters.js` (Task 1). `battleScreen.mount()`'s new `props.monsterIds`/`props.monsterOverrides` array shape and `callbacks.onBattleEnd(outcome, killedMonsterIds)` signature (Task 3).
- Produces: `handleEncounter(monsterIds, monsterOverrides)` (was `handleEncounter(monsterId, monsterOverrides)`), `handleBattleEnd(outcome, killedMonsterIds)` (was `handleBattleEnd(outcome, monsterId)`), `startBossFight` passing a 1-element array, `state.monsterKillCounts` backfilled for legacy saves and incremented on every kill.

- [ ] **Step 1: Write the failing test for `describeMonsterGroup`**

`js/systems/messageLog.js` is a 25-line file ending with `formatBattleOutcomeMessage` at line 20-24; `tests/messageLog.test.js` already exists (69 lines, covering `MESSAGE_LOG_CAP`, `appendMessage`, and `formatBattleOutcomeMessage`). Add the new import and three new tests to the end of the existing `tests/messageLog.test.js`:

Change the top import line (currently line 3):

```js
import { MESSAGE_LOG_CAP, appendMessage, formatBattleOutcomeMessage } from '../js/systems/messageLog.js';
```

to:

```js
import { MESSAGE_LOG_CAP, appendMessage, formatBattleOutcomeMessage, describeMonsterGroup } from '../js/systems/messageLog.js';
```

Then add at the end of the file, after the existing last test (which ends at line 68):

```js
test('describeMonsterGroup names a single monster plainly', () => {
  const name = describeMonsterGroup(['boar'], () => 'Snorty McPigface');
  assert.equal(name, 'Snorty McPigface');
});

test('describeMonsterGroup pluralizes a group with a count', () => {
  const name = describeMonsterGroup(['boar', 'boar', 'boar'], () => 'Snorty McPigface');
  assert.equal(name, '3 Snorty McPigfaces');
});

test('describeMonsterGroup returns an empty string for an empty list', () => {
  const name = describeMonsterGroup([], () => 'Snorty McPigface');
  assert.equal(name, '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/messageLog.test.js`
Expected: FAIL — `describeMonsterGroup` is not exported from `js/systems/messageLog.js`.

- [ ] **Step 3: Write the implementation**

In `js/systems/messageLog.js`, add a new exported function right after `formatBattleOutcomeMessage` (after line 24):

```js
export function describeMonsterGroup(monsterIds, monsterNameById) {
  if (monsterIds.length === 0) return '';
  const name = monsterNameById(monsterIds[0]);
  return monsterIds.length === 1 ? name : `${monsterIds.length} ${name}s`;
}
```

(`monsterNameById` is injected rather than importing `MONSTERS` directly into `messageLog.js` — this file has no existing dependency on the monster data table, and this keeps it that way; `main.js` already imports `MONSTERS` and can pass `(id) => MONSTERS[id].name` as the lookup.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/messageLog.test.js`
Expected: PASS, all tests green (8 existing + 3 new = 11 in this file).

- [ ] **Step 5: Add the `monsterKillCounts` legacy-save backfill**

In `js/main.js`'s `startGame()`, the existing backfill block has (around line 103-114):

```js
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
```

Add a matching backfill right after the `questProgress` block:

```js
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  if (!state.monsterKillCounts) {
    state.monsterKillCounts = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
```

- [ ] **Step 6: Add the import**

At the top of `js/main.js`, add a new import alongside the other `systems/*` imports (e.g. right after the `groupEncounters`-adjacent `quests.js` import at line 43):

```js
import { rollEncounterGroup, incrementKillCount } from './systems/groupEncounters.js';
```

Also update the `messageLog.js` import (currently line 32, `import { formatBattleOutcomeMessage } from './systems/messageLog.js';`) to also bring in the new helper:

```js
import { formatBattleOutcomeMessage, describeMonsterGroup } from './systems/messageLog.js';
```

- [ ] **Step 7: Update `startBossFight` and `handleEncounter` to array shape**

Currently (lines 447-501):

```js
function startBossFight(tier) {
  const monsterId = dungeonMap.bossMonsterId;
  const tierStats = getBossTierStats(MONSTERS[monsterId], tier);
  activeBossTierXp = tierStats.xp;
  activeBossTierAttempt = tier;
  handleEncounter(monsterId, {
    hp: tierStats.hp,
    attack: tierStats.attack,
    defense: tierStats.defense,
    speed: tierStats.speed,
  });
}
```

```js
function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setHudButtonsEnabled(false);
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

Replace both with:

```js
function startBossFight(tier) {
  const monsterId = dungeonMap.bossMonsterId;
  const tierStats = getBossTierStats(MONSTERS[monsterId], tier);
  activeBossTierXp = tierStats.xp;
  activeBossTierAttempt = tier;
  handleEncounter([monsterId], [{
    hp: tierStats.hp,
    attack: tierStats.attack,
    defense: tierStats.defense,
    speed: tierStats.speed,
  }]);
}
```

```js
function handleEncounter(monsterIds, monsterOverridesList = null) {
  battleActive = true;
  setHudButtonsEnabled(false);
  const ngPlusOverridesList = monsterIds.map((monsterId, i) => {
    const overrides = monsterOverridesList ? monsterOverridesList[i] : null;
    const preScaled = { ...MONSTERS[monsterId], ...(overrides || {}) };
    return getNgPlusCombatOverrides(preScaled, state.ngPlusCycle);
  });
  mountOverlay(battleScreen, {
    state,
    monsterIds,
    monsterOverrides: ngPlusOverridesList,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}
```

- [ ] **Step 8: Update `handleBattleEnd`'s signature and flavor banner**

Currently (lines 503-524, the top of `handleBattleEnd` before the outcome branches):

```js
function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;

  // Snapshot effective stats as they stood at the moment combat ended (state.player.hp
  // already reflects the battle's outcome here - battleScreen.js's endBattle() synced it
  // before this callback fires), before any post-battle reward/heal mutations below change
  // them, so the log entry reflects what actually fought this battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
  const playerSnapshot = {
    level: state.player.level,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
  };
  showFlavorBanner(formatBattleOutcomeMessage(outcome, MONSTERS[monsterId].name, playerSnapshot));
```

Replace with:

```js
function handleBattleEnd(outcome, killedMonsterIds) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;

  // Snapshot effective stats as they stood at the moment combat ended (state.player.hp
  // already reflects the battle's outcome here - battleScreen.js's endBattle() synced it
  // before this callback fires), before any post-battle reward/heal mutations below change
  // them, so the log entry reflects what actually fought this battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
  const playerSnapshot = {
    level: state.player.level,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
  };
  const groupName = describeMonsterGroup(killedMonsterIds, (id) => MONSTERS[id].name);
  showFlavorBanner(formatBattleOutcomeMessage(outcome, groupName, playerSnapshot));
```

(For every outcome this build actually produces `killedMonsterIds` for — `'won'`, `'surrender'`, and `'fled'` — the banner now names whichever monsters were actually killed, which for a `'won'` battle is the full group and for a partial-kill `'fled'` is just the ones that died. `'lost'` and `'fled-with-loot'`/`'fled-empty'` still receive an array too since `battleScreen.js`'s `endBattle` always computes one, but those two outcome branches don't use `groupName` today — `'lost'`'s banner doesn't name a monster at all, and `'fled-with-loot'`/`'fled-empty'` are solo-only outcomes from the pre-fight weak-mob check, whose `killedMonsterIds` is always empty since no monster died before that outcome fires.)

- [ ] **Step 9: Update the `'won'`/`'surrender'` reward branch to loop per killed monster**

Currently (lines 526-563):

```js
  if (outcome === 'won' || outcome === 'surrender') {
    const monster = MONSTERS[monsterId];
    if (!state.flags.firstKillCelebrated) {
      state.flags.firstKillCelebrated = true;
      playCelebration('🎉', 'First blood! You feel like a real adventurer now.');
    }
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
      playCelebration('⭐', `Level up! You are now level ${state.player.level}.`);
    }

    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      grantDropItem(drop.item);
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
      if (bossTierAttempt !== null) {
        state.bossTier = resolveBossTierAfterWin(state.bossTier, bossTierAttempt);
      }
    }
    Object.assign(state, incrementQuestProgress(state, monsterId));
    state.lossStreak = 0;

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

Replace with:

```js
  if (outcome === 'won' || outcome === 'surrender') {
    if (!state.flags.firstKillCelebrated) {
      state.flags.firstKillCelebrated = true;
      playCelebration('🎉', 'First blood! You feel like a real adventurer now.');
    }
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    let leveledUpThisBattle = false;
    for (const monsterId of killedMonsterIds) {
      const monster = MONSTERS[monsterId];
      const baseXp = resolveBattleXp(bossTierXp, monster);
      const xp = Math.round(baseXp * rewardMultiplier.xp);
      const preLevelHp = state.player.hp;
      const { player, leveledUp } = applyXp(state.player, xp);
      state.player = player;
      if (leveledUp) {
        leveledUpThisBattle = true;
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
        grantDropItem(drop.item);
      }
      if (monster.isBoss) {
        state.flags.dungeonBossDefeated = true;
        if (bossTierAttempt !== null) {
          state.bossTier = resolveBossTierAfterWin(state.bossTier, bossTierAttempt);
        }
      }
      Object.assign(state, incrementQuestProgress(state, monsterId));
      Object.assign(state, { monsterKillCounts: incrementKillCount(state.monsterKillCounts, monsterId) });
    }
    if (leveledUpThisBattle) {
      playCelebration('⭐', `Level up! You are now level ${state.player.level}.`);
    }
    state.lossStreak = 0;

    persist();
    renderHud();
  } else if (outcome === 'lost') {
```

(`leveledUpThisBattle` is hoisted out of the per-monster loop so a 3-kill group that levels up partway through only plays the level-up celebration once, not once per remaining kill in the same loop pass — matching how the original code only ever handled one kill, and thus one possible level-up, per battle.)

- [ ] **Step 10: Add the `'fled'` partial-reward branch**

Currently (lines 588-591, the tail of the outcome chain):

```js
  } else if (outcome === 'fled' || outcome === 'fled-empty') {
    persist();
    renderHud();
  }
}
```

Replace with:

```js
  } else if (outcome === 'fled') {
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    for (const monsterId of killedMonsterIds) {
      const monster = MONSTERS[monsterId];
      const baseXp = resolveBattleXp(null, monster);
      const xp = Math.round(baseXp * rewardMultiplier.xp);
      const { player } = applyXp(state.player, xp);
      state.player = player;
      const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
      const drop = rollDrop(scaledMonster);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item);
      }
      Object.assign(state, incrementQuestProgress(state, monsterId));
      Object.assign(state, { monsterKillCounts: incrementKillCount(state.monsterKillCounts, monsterId) });
    }
    persist();
    renderHud();
  } else if (outcome === 'fled-empty') {
    persist();
    renderHud();
  }
}
```

(`'fled'` is now a real outcome that can carry partial rewards — a group fight where some members died before the player fled. It's split from `'fled-empty'`, which stays a pure zero-reward path unchanged from today: `battleScreen.js`'s `playerFlee()` still only ever produces the `'fled'` outcome string, but `killedMonsterIds` is empty for a flee-before-any-kill exactly the way it always was, so this loop is simply a no-op in that case — behaviorally identical to today's always-zero-reward flee. `resolveBattleXp(null, monster)` passes `null` for the boss-tier-XP argument the same way the existing boss-tier logic already does for any non-boss monster in the `'won'` branch — a fled group can never include a boss per this build's design, so this always resolves to the monster's own base `xp`.)

- [ ] **Step 11: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 279 tests green (276 prior + 3 new in `tests/messageLog.test.js`, whose own file total goes from 8 to 11).

- [ ] **Step 12: Commit**

```bash
git add js/main.js js/systems/messageLog.js tests/messageLog.test.js
git commit -m "feat: wire multi-mob encounters and per-monster rewards into main.js"
```

---

### Task 7: `mapScreen.js` — roll the group on encounter

**Files:**
- Modify: `js/screens/mapScreen.js`

**Interfaces:**
- Consumes: `rollEncounterGroup` from `../systems/groupEncounters.js` (Task 1); `state.monsterKillCounts` (Task 2).
- Produces: `callbacks.onEncounter` is now always called with an array of monster ids.

- [ ] **Step 1: Add the import**

At the top of `js/screens/mapScreen.js`, add a new import alongside the existing `systems/*` imports (e.g. after the `toolGates.js` import):

```js
import { rollEncounterGroup } from '../systems/groupEncounters.js';
```

- [ ] **Step 2: Update the encounter roll**

In `tryMove()`, the current encounter block reads:

```js
  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
  }
```

Replace with:

```js
  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
    callbacks.onEncounter(monsterIds);
  }
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS. `mapScreen.js` has no dedicated test file (matching this codebase's existing convention for screen modules), so this step confirms nothing elsewhere broke.

- [ ] **Step 4: Commit**

```bash
git add js/screens/mapScreen.js
git commit -m "feat: roll monster groups into the map's encounter trigger"
```

---

### Task 8: Manual verification and CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the fully-wired feature from Tasks 1-7.
- Produces: no code interfaces — this task is verification plus documentation.

This task's manual-verification steps must be performed directly by whoever is driving implementation (via a real browser, e.g. claude-in-chrome tooling), not delegated to a code-only subagent — `battleScreen.js` and `main.js` have no automated coverage for this feature's live behavior, and this is the largest single-file rework in the project so far, so "I read the diff and it looks right" is not equivalent to confirming groups actually spawn and play correctly.

- [ ] **Step 1: Start the app locally**

Serve the repo root with a static file server (e.g. `python3 -m http.server <port>` from the repo root, then open `http://localhost:<port>/index.html`).

- [ ] **Step 2: Manual verification — solo encounters are unaffected**

Create a fresh character (or use one with `monsterKillCounts` all at 0) and fight a normal solo encounter. Confirm: exactly one monster appears, combat plays out identically to before this feature (Attack, abilities, parry, win/loss, rewards) — this is a regression check on the array-of-1 code path, not just a new-feature check.

- [ ] **Step 3: Manual verification — force a group encounter and confirm rendering**

Via DevTools, edit the active save's `monsterKillCounts` for one monster type (e.g. `boar`) to `10` or higher directly in `localStorage`, reload/continue that save, then walk until an encounter with that monster type triggers. Because the spawn chance is only 30%, this may take a few encounters — repeat until a group actually appears. Confirm: 2 or 3 monsters render side by side, each with its own name/HP bar/ATB bar.

- [ ] **Step 4: Manual verification — targeting**

In a group battle, confirm: the first monster starts selected (scaled up); clicking a different monster's zone re-selects it (scale/dim states swap); Left/Right arrow keys and Tab cycle the selection through living monsters only; Attack and at least one ability land on whichever monster is currently selected (confirm via the battle log naming the correct monster and that monster's HP bar dropping).

- [ ] **Step 5: Manual verification — global parry sweep**

In a group battle, let at least two monsters' wind-ups overlap (this happens naturally since each monster's ATB runs independently), and press `s` while both are inside their parry zone at once. Confirm: both are parried by the single press (two log lines, two HP drops on the monster side, zero player damage from either).

- [ ] **Step 6: Manual verification — win condition and full rewards**

Kill every monster in a group. Confirm: the battle ends in a win only once the last one dies (not after the first), and the post-battle rewards (XP, gold, any drops, quest-progress, and `monsterKillCounts` via a DevTools check of the save) reflect the sum of all killed monsters, not just one.

- [ ] **Step 7: Manual verification — partial-kill-then-flee**

In a fresh group battle, kill one monster (not all), then press Flee. Confirm: the battle ends immediately (surviving monsters don't get a final attack in), and the rewards reflect only the one killed monster's XP/gold/drop/quest-progress/kill-count — check via DevTools that `monsterKillCounts` incremented by exactly 1 for that monster type, not by the group size.

- [ ] **Step 8: Manual verification — group encounters skip weak-mob-surrender**

With a save whose kill count is high enough that the player would heavily outclass the monster type (matching the existing weak-mob-surrender threshold), force a group encounter of that same overleveled type and confirm the full battle overlay opens and plays out normally — it must never resolve instantly via the pre-fight surrender/flee roll the way a solo encounter of the same overleveled monster would.

- [ ] **Step 9: Add the CHANGELOG entry**

In `CHANGELOG.md`, under `## [Unreleased]` → `### Added`, add an entry describing the shipped feature (see the existing entries in that section for tone/format). Cover: monster types that have been killed 10+ times now have a 30% chance per encounter to spawn as a group of 2-3; independent per-monster ATB/wind-up/parry; click/arrow/Tab targeting; the parry key sweeps every monster currently in its parry zone at once; killing some of a group then fleeing grants full rewards for whichever monsters actually died.

- [ ] **Step 10: Commit the CHANGELOG entry**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG entry for multi-mob encounters"
```

---

## Self-Review Notes

- **Spec coverage:** The spec's "Kill tracking and group-spawn roll" section is Task 1 + Task 2. "Wiring into encounter generation" is Task 7 (plus `handleEncounter`'s array shape in Task 6). "`battleScreen.js`'s data model" through "Rendering: dead monsters drop out of the row" are Tasks 3-5. "Rewards and flee" and "Weak-mob-surrender exclusion" are covered in Task 6 (rewards) and Task 3 Step 10 (weak-mob gating on `monsterIds.length === 1`). The spec's "Testing" section's manual-verification bullets map directly to Task 8's steps.
- **Placeholder scan:** No TBD/TODO; every step has literal code. Task 6 Step 2's `tests/messageLog.test.js` existence check is a real conditional the implementer resolves by looking (`ls tests/`), not a deferred decision — the three test cases themselves are fully written either way.
- **Type consistency:** `{ monsterId, name, emoji, hp, maxHp, attack, defense, speed, atb, windup, defenseDebuff, pendingDelayedHit }` (the `monsterCombatants` entry shape) is introduced in Task 3 and referenced identically in Tasks 4 and 5 — no renaming drift. `killedMonsterIds` (array) is the name used consistently from `battleScreen.js`'s `endBattle` (Task 3) through `callbacks.onBattleEnd` and `main.js`'s `handleBattleEnd` (Task 6). `rollEncounterGroup`/`incrementKillCount` signatures match between Task 1's implementation and every later task that calls them (Task 6, Task 7).
- **Ordering:** Task 3 depends on nothing but existing code (parry.js's exports, already shipped). Task 4 depends on Task 3's array-shaped state and `elements.monsterZones`/`monsterEmojis`. Task 5 depends on Task 3's per-monster `resolveMonsterWindup` signature. Task 6 depends on Task 1 (`rollEncounterGroup`/`incrementKillCount`) and Task 3 (`battleScreen.mount()`'s new props shape and `onBattleEnd` signature) — placed after both. Task 7 depends on Task 1 and Task 2 (`state.monsterKillCounts` must exist before `mapScreen.js` reads it) — placed after both, and after Task 6 since a real encounter flowing all the way through requires `main.js`'s `handleEncounter` to already accept arrays. Task 8 depends on every prior task being functionally complete.
