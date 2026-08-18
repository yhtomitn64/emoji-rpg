# Combat Abilities (Phase 1: Single-Target) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Attack" button with five level-gated named abilities (Stab, Chop, Slash, Sweep, Super Scream) that have their own real-time cooldowns, a rotation-timing bonus around Super Scream's buff window, and a never-fails timing minigame — all against today's single-monster-per-fight world.

**Architecture:** A new pure module `js/systems/abilities.js` holds every rule (roster, unlock schedule, cooldown math, buff math, secondary-effect math, damage composition) and is fully unit tested, mirroring `js/systems/combat.js`'s existing shape. `js/screens/battleScreen.js` gets thin, untested wiring (per this project's existing convention — no dedicated tests exist for `battleScreen.js` or `main.js`) that holds per-battle ephemeral ability/buff/debuff state and renders the new UI. No save-data or `main.js` changes at all.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict`, no build step, no framework — matches the rest of the project exactly.

**Spec:** `docs/superpowers/specs/2026-08-17-combat-abilities-design.md`

## Global Constraints

- No changes to `state` or save data — ability unlocks are a pure function of `player.level`; cooldowns/buffs/debuffs are ephemeral per-battle state, reset every fight, never persisted.
- No changes to `main.js` or `state.js`.
- Reuse `combat.js`'s existing `rollCrit`, `calculateDamage`, `applyCritMultiplier`, `applySpeedDamageBonus`, `applyKnockback`, `ATB_KNOCKBACK` for all damage math — never reimplement crit/variance/speed-bonus logic.
- Timing minigame never produces a hard fail — a miss (or no input) always resolves the ability at its normal (already-computed) value, never below baseline, never a wasted turn.
- Multi-enemy targeting is explicitly out of scope. Slash/Sweep hit the single monster present, exactly like Stab/Chop, just with the damage/secondary-effect profile below.
- Every new pure function in `abilities.js` gets a `node:test` test written and watched to fail *before* the implementation is written (TDD, per this project's established workflow).
- Run `npm test` after every task; it must stay green.

---

## Task 1: Ability roster and unlock schedule

**Files:**
- Create: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Produces: `ABILITIES` (array of ability definition objects, each `{ id: string, name: string, unlockLevel: number, type: 'damage' | 'buff', cooldownMs: number, ...type-specific fields }`), `getUnlockedAbilities(level: number) => Ability[]`.
- Consumes: nothing.

Ability definitions (all five, full shape used by later tasks):

```js
export const ABILITIES = [
  {
    id: 'stab', name: 'Stab', unlockLevel: 2, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 4000,
  },
  {
    id: 'chop', name: 'Chop', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.8, cooldownMs: 10000,
  },
  {
    id: 'slash', name: 'Slash', unlockLevel: 6, type: 'damage',
    damageMultiplier: 1.0, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
  },
  {
    id: 'sweep', name: 'Sweep', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.5, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
  },
  {
    id: 'superScream', name: 'Super Scream', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000, buffMultiplier: 1.4,
  },
];
```

- [ ] **Step 1: Write the failing test**

Create `tests/abilities.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities } from '../js/systems/abilities.js';

test('ABILITIES has exactly the five abilities in level order', () => {
  assert.deepEqual(ABILITIES.map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(ABILITIES.map((a) => a.unlockLevel), [2, 4, 6, 8, 10]);
});

test('getUnlockedAbilities returns only abilities unlocked at or below the given level', () => {
  assert.deepEqual(getUnlockedAbilities(1), []);
  assert.deepEqual(getUnlockedAbilities(2).map((a) => a.id), ['stab']);
  assert.deepEqual(getUnlockedAbilities(5).map((a) => a.id), ['stab', 'chop']);
  assert.deepEqual(getUnlockedAbilities(10).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(getUnlockedAbilities(99).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `js/systems/abilities.js` does not exist yet (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `js/systems/abilities.js` with the `ABILITIES` array shown above, plus:

```js
export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add ability roster and level-based unlock schedule"
```

---

## Task 2: Cooldown ticking

**Files:**
- Modify: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `tickCooldowns(cooldowns: Record<string, number>, dt: number) => Record<string, number>` — a new object with every value reduced by `dt`, floored at 0.

- [ ] **Step 1: Write the failing test**

Append to `tests/abilities.test.js`:

```js
import { tickCooldowns } from '../js/systems/abilities.js';

test('tickCooldowns reduces every entry by dt, flooring at 0', () => {
  const result = tickCooldowns({ stab: 1000, chop: 200, sweep: 0 }, 300);
  assert.deepEqual(result, { stab: 700, chop: 0, sweep: 0 });
});

test('tickCooldowns does not mutate the input object', () => {
  const input = { stab: 1000 };
  tickCooldowns(input, 300);
  assert.deepEqual(input, { stab: 1000 });
});
```

(Add the new `tickCooldowns` name to the existing `import { ABILITIES, getUnlockedAbilities } from '../js/systems/abilities.js';` line at the top of the file instead of a second import statement.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `tickCooldowns` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `js/systems/abilities.js`:

```js
export function tickCooldowns(cooldowns, dt) {
  const next = {};
  for (const [id, remainingMs] of Object.entries(cooldowns)) {
    next[id] = Math.max(0, remainingMs - dt);
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add per-ability real-time cooldown ticking"
```

---

## Task 3: Buff state (Super Scream)

**Files:**
- Modify: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: an ability object shaped like `ABILITIES`'s `superScream` entry (`{ buffDurationMs: number, buffMultiplier: number }`).
- Produces: `createBuffState() => { active: boolean, remainingMs: number, multiplier: number }`, `activateBuff(ability) => BuffState`, `tickBuff(buffState: BuffState, dt: number) => BuffState`.

- [ ] **Step 1: Write the failing test**

Append to `tests/abilities.test.js` (add `createBuffState, activateBuff, tickBuff` to the top import):

```js
test('createBuffState starts inactive with no bonus', () => {
  assert.deepEqual(createBuffState(), { active: false, remainingMs: 0, multiplier: 1 });
});

test('activateBuff turns the buff on using the ability\'s own duration and multiplier', () => {
  const superScream = ABILITIES.find((a) => a.id === 'superScream');
  assert.deepEqual(activateBuff(superScream), { active: true, remainingMs: 12000, multiplier: 1.4 });
});

test('tickBuff counts down while active', () => {
  const buff = { active: true, remainingMs: 1000, multiplier: 1.4 };
  assert.deepEqual(tickBuff(buff, 300), { active: true, remainingMs: 700, multiplier: 1.4 });
});

test('tickBuff expires back to the inactive state once remainingMs hits 0', () => {
  const buff = { active: true, remainingMs: 200, multiplier: 1.4 };
  assert.deepEqual(tickBuff(buff, 300), { active: false, remainingMs: 0, multiplier: 1 });
});

test('tickBuff on an already-inactive buff is a no-op', () => {
  const buff = createBuffState();
  assert.deepEqual(tickBuff(buff, 300), buff);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `createBuffState`/`activateBuff`/`tickBuff` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `js/systems/abilities.js`:

```js
export function createBuffState() {
  return { active: false, remainingMs: 0, multiplier: 1 };
}

export function activateBuff(ability) {
  return { active: true, remainingMs: ability.buffDurationMs, multiplier: ability.buffMultiplier };
}

export function tickBuff(buffState, dt) {
  if (!buffState.active) return buffState;
  const remainingMs = Math.max(0, buffState.remainingMs - dt);
  return remainingMs === 0 ? createBuffState() : { ...buffState, remainingMs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add Super Scream buff activation and countdown"
```

---

## Task 4: Timing minigame hit detection

**Files:**
- Modify: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveTimingHit(actedAtPercent: number, sweetSpotStartPercent: number, sweetSpotEndPercent: number) => boolean`.

- [ ] **Step 1: Write the failing test**

Append to `tests/abilities.test.js` (add `resolveTimingHit` to the top import):

```js
test('resolveTimingHit is true inside the sweet spot', () => {
  assert.equal(resolveTimingHit(85, 80, 100), true);
});

test('resolveTimingHit is true exactly on the sweet spot edges', () => {
  assert.equal(resolveTimingHit(80, 80, 100), true);
  assert.equal(resolveTimingHit(100, 80, 100), true);
});

test('resolveTimingHit is false outside the sweet spot', () => {
  assert.equal(resolveTimingHit(79, 80, 100), false);
  assert.equal(resolveTimingHit(50, 80, 100), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `resolveTimingHit` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `js/systems/abilities.js`:

```js
export function resolveTimingHit(actedAtPercent, sweetSpotStartPercent, sweetSpotEndPercent) {
  return actedAtPercent >= sweetSpotStartPercent && actedAtPercent <= sweetSpotEndPercent;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add timing-minigame sweet-spot hit detection"
```

---

## Task 5: Core ability damage resolution

**Files:**
- Modify: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: `combat.js`'s `rollCrit`, `calculateDamage`, `applyCritMultiplier`, `applySpeedDamageBonus`, `applyKnockback`, `ATB_KNOCKBACK` (import into `abilities.js`); an ability object with `damageMultiplier`.
- Produces: `ROTATION_BONUS_MULTIPLIER = 1.25`, `TIMING_BONUS_MULTIPLIER = 1.30` (exported constants); `resolveAbilityUse(player, monster, ability, buffActive: boolean, timingHit: boolean, rng = Math.random) => { damage: number, isCrit: boolean, monsterHp: number, monsterAtb: number, playerAtb: number }` — same return shape as `combat.js`'s existing `resolvePlayerAttack`, so `battleScreen.js` can apply the result identically.

- [ ] **Step 1: Write the failing test**

Append to `tests/abilities.test.js` (add `resolveAbilityUse, ROTATION_BONUS_MULTIPLIER, TIMING_BONUS_MULTIPLIER` to the top import):

```js
test('resolveAbilityUse applies the ability multiplier on top of a plain attack, no buff/timing bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, no crit (rollCrit uses the same rng draw internally,
  // and 0.5 is well above CRIT_CHANCE=0.1, so no crit here)
  const result = resolveAbilityUse(player, monster, stab, false, false, () => 0.5);
  assert.equal(result.damage, 10); // round(8 * 1.3) = 10
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 90);
  assert.equal(result.playerAtb, 0);
});

test('resolveAbilityUse multiplies in the rotation bonus when the buff is active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, false, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, * 1.25 (rotation) = round(17.5) = 18
  assert.equal(result.damage, 18);
});

test('resolveAbilityUse multiplies in the timing bonus on a hit', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = resolveAbilityUse(player, monster, stab, false, true, () => 0.5);
  // base 8, * 1.3 (stab) = round(10.4) = 10, * 1.30 (timing) = round(13) = 13
  assert.equal(result.damage, 13);
});

test('resolveAbilityUse stacks buff and timing bonuses together', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, true, () => 0.5);
  // base 8, * 1.8 = 14.4 -> round 14, * 1.25 = 17.5 -> round 18, * 1.30 = 23.4 -> round 23
  assert.equal(result.damage, 23);
});

test('resolveAbilityUse knocks the monster\'s ATB back and never drops HP below 0', () => {
  const player = { attack: 500, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 10, defense: 0, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, () => 0.5);
  assert.equal(result.monsterHp, 0);
  assert.equal(result.monsterAtb, 50 - ATB_KNOCKBACK);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `resolveAbilityUse` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to the top of `js/systems/abilities.js`:

```js
import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK } from './combat.js';
```

Add to `js/systems/abilities.js`:

```js
export const ROTATION_BONUS_MULTIPLIER = 1.25;
export const TIMING_BONUS_MULTIPLIER = 1.30;

export function resolveAbilityUse(player, monster, ability, buffActive, timingHit, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  if (timingHit) damage = Math.round(damage * TIMING_BONUS_MULTIPLIER);
  damage = applyCritMultiplier(damage, isCrit);
  damage = applySpeedDamageBonus(damage, player.speed);
  return {
    damage,
    isCrit,
    monsterHp: Math.max(0, monster.hp - damage),
    monsterAtb: applyKnockback(monster.atb, ATB_KNOCKBACK),
    playerAtb: 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 17 tests. Also run `npm test` to confirm the full suite (including `tests/combat.test.js`) is unaffected.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add resolveAbilityUse composing multiplier/buff/timing/crit/speed bonuses"
```

---

## Task 6: Secondary effects — Slash's delayed hit and Sweep's defense shred

**Files:**
- Modify: `js/systems/abilities.js`
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: `slash`'s `delayedHitMultiplier`; `sweep`'s `defenseShredMultiplier`/`defenseShredDurationMs`.
- Produces: `resolveDelayedHit(baseDamage: number, ability) => number`; `createDefenseDebuff(ability) => { active: boolean, multiplier: number, remainingMs: number }`; `tickDefenseDebuff(debuff: DefenseDebuff | null, dt: number) => DefenseDebuff | null`; `applyDefenseDebuff(monster, debuff: DefenseDebuff | null) => monster-shaped object` (returns a new object with `defense` reduced when the debuff is active, or the same monster reference when `debuff` is `null`).

- [ ] **Step 1: Write the failing test**

Append to `tests/abilities.test.js` (add `resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff` to the top import):

```js
test('resolveDelayedHit computes Slash\'s follow-up tick as a fraction of the original hit', () => {
  const slash = ABILITIES.find((a) => a.id === 'slash');
  assert.equal(resolveDelayedHit(100, slash), 20); // round(100 * 0.2)
});

test('createDefenseDebuff starts active using the ability\'s own multiplier and duration', () => {
  const sweep = ABILITIES.find((a) => a.id === 'sweep');
  assert.deepEqual(createDefenseDebuff(sweep), { active: true, multiplier: 0.85, remainingMs: 6000 });
});

test('tickDefenseDebuff counts down and expires to null', () => {
  const debuff = { active: true, multiplier: 0.85, remainingMs: 200 };
  assert.deepEqual(tickDefenseDebuff(debuff, 100), { active: true, multiplier: 0.85, remainingMs: 100 });
  assert.equal(tickDefenseDebuff(debuff, 300), null);
});

test('tickDefenseDebuff on null is a no-op', () => {
  assert.equal(tickDefenseDebuff(null, 300), null);
});

test('applyDefenseDebuff reduces defense while active, leaves the monster untouched when null', () => {
  const monster = { hp: 50, defense: 20, atb: 0 };
  const debuff = { active: true, multiplier: 0.85, remainingMs: 1000 };
  assert.equal(applyDefenseDebuff(monster, debuff).defense, 17); // round(20 * 0.85)
  assert.equal(applyDefenseDebuff(monster, null), monster);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — the four new functions are not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `js/systems/abilities.js`:

```js
export function resolveDelayedHit(baseDamage, ability) {
  return Math.round(baseDamage * ability.delayedHitMultiplier);
}

export function createDefenseDebuff(ability) {
  return { active: true, multiplier: ability.defenseShredMultiplier, remainingMs: ability.defenseShredDurationMs };
}

export function tickDefenseDebuff(debuff, dt) {
  if (!debuff) return null;
  const remainingMs = Math.max(0, debuff.remainingMs - dt);
  return remainingMs === 0 ? null : { ...debuff, remainingMs };
}

export function applyDefenseDebuff(monster, debuff) {
  if (!debuff || !debuff.active) return monster;
  return { ...monster, defense: Math.round(monster.defense * debuff.multiplier) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/abilities.test.js`
Expected: PASS, 22 tests. Run `npm test` to confirm the full suite is green — this is the last purely-logic task, `abilities.js` is now complete and fully covered.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add Slash's delayed-hit and Sweep's defense-shred secondary effects"
```

---

## Task 7: Wire per-battle ability state and render ability buttons

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `ABILITIES`, `getUnlockedAbilities`, `tickCooldowns`, `createBuffState`, `tickBuff` from `js/systems/abilities.js`.
- Produces: module-level `abilityCooldowns` (object, ability id → ms remaining) and `buffState` (`BuffState`) in `battleScreen.js`, both reset every `mount()`; ability buttons rendered in the battle menu (no click behavior yet — that's Task 8).

No new automated test — `battleScreen.js` has no dedicated test file anywhere in this project (confirmed: no `battleScreen.test.js` exists), consistent with how the weak-mob-surrender and tool-gate-clear features were wired in earlier. This task is manually verified (Step 4 below).

- [ ] **Step 1: Add the imports and per-battle state**

In `js/screens/battleScreen.js`, add to the existing import block:

```js
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, tickBuff } from '../systems/abilities.js';
```

Add new module-level state near the existing `let playerCombatant = null;` etc.:

```js
let abilityCooldowns = {};
let buffState = createBuffState();
```

In `mount()`, right after `playerCombatant = buildPlayerCombatant();`, add:

```js
abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
buffState = createBuffState();
```

In `tick()`, right after the two `tickGauge(...)` lines, add:

```js
abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
buffState = tickBuff(buffState, 300);
```

- [ ] **Step 2: Render ability buttons in the menu**

Replace `updateMenu()`'s body with a version that adds ability buttons. Find the existing function:

```js
function updateMenu() {
  if (battleOver) {
    elements.menu.innerHTML = '';
    return;
  }
  const ready = isReady(playerCombatant.atb);
  const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);

  elements.menu.innerHTML = `
    ${ready ? '<button id="btn-attack">Attack</button>' : ''}
    <button id="btn-item" ${hasPotion ? '' : 'disabled'}>Item</button>
    ${ready ? '<button id="btn-flee">Flee</button>' : ''}
  `;
  if (ready) {
    document.getElementById('btn-attack').onclick = playerAttack;
    document.getElementById('btn-flee').onclick = playerFlee;
  }
  document.getElementById('btn-item').onclick = playerUseItem;
}
```

Replace it with:

```js
function abilityButtonsHtml() {
  const unlocked = getUnlockedAbilities(state.player.level);
  return unlocked.map((ability) => {
    const cooldownRemaining = abilityCooldowns[ability.id];
    const disabled = cooldownRemaining > 0 ? 'disabled' : '';
    const label = cooldownRemaining > 0 ? `${ability.name} (${Math.ceil(cooldownRemaining / 1000)}s)` : ability.name;
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button" ${disabled}>${label}</button>`;
  }).join('');
}

function updateMenu() {
  if (battleOver) {
    elements.menu.innerHTML = '';
    return;
  }
  const ready = isReady(playerCombatant.atb);
  const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);

  elements.menu.innerHTML = `
    ${ready ? '<button id="btn-attack">Attack</button>' : ''}
    ${ready ? abilityButtonsHtml() : ''}
    <button id="btn-item" ${hasPotion ? '' : 'disabled'}>Item</button>
    ${ready ? '<button id="btn-flee">Flee</button>' : ''}
  `;
  if (ready) {
    document.getElementById('btn-attack').onclick = playerAttack;
    document.getElementById('btn-flee').onclick = playerFlee;
  }
  document.getElementById('btn-item').onclick = playerUseItem;
}
```

(Ability buttons render with no `onclick` handler yet — Task 8 adds `playerUseAbility`. A disabled/cooling-down button correctly has nothing to click anyway.)

- [ ] **Step 3: Add CSS for the cooldown-disabled look**

Add to `css/styles.css`, near the existing button styles:

```css
.battle-ability-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Manually verify**

Run `python3 -m http.server 8000` (or any free port), create a character, and use the browser console to set `player.level` to 10 directly in the save's `localStorage` entry (same technique used for the weak-mob-surrender and dungeon-shortcut manual tests earlier this project), then reload and enter any battle. Confirm:
- All five ability buttons (Stab, Chop, Slash, Sweep, Super Scream) appear once ATB is ready, alongside Attack/Item/Flee.
- At a fresh battle start, none show a cooldown (all enabled).
- Set `player.level` to 5 instead and confirm only Stab and Chop appear, not Slash/Sweep/Super Scream.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: render level-gated ability buttons with per-battle cooldown state"
```

---

## Task 8: Wire Stab and Chop (simple damage abilities, no secondary effect)

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `resolveAbilityUse` from `js/systems/abilities.js`.
- Produces: `playerUseAbility(abilityId)`, wired as the `onclick` handler for every ability button. For this task, the timing-hit argument is hardcoded to `false` — Task 12 replaces that stub with the real timing-minigame result.

- [ ] **Step 1: Add the import**

Extend the `abilities.js` import in `js/screens/battleScreen.js` (from Task 7) to include `resolveAbilityUse`:

```js
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, tickBuff, resolveAbilityUse } from '../systems/abilities.js';
```

- [ ] **Step 2: Implement `playerUseAbility` for damage-type abilities**

Add a new function near `playerAttack()` in `js/screens/battleScreen.js`:

```js
function playerUseAbility(abilityId) {
  const ability = ABILITIES.find((a) => a.id === abilityId);
  if (ability.type !== 'damage') return; // superScream (buff) is handled in Task 11
  const result = resolveAbilityUse(playerCombatant, monsterCombatant, ability, buffState.active, false);
  monsterCombatant.hp = result.monsterHp;
  monsterCombatant.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  abilityCooldowns[abilityId] = ability.cooldownMs;
  log.push(result.isCrit
    ? `Critical! You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}!`
    : `You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}.`);
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZone, elements.monsterEmoji, result.damage, result.isCrit);
  checkOutcome();
  updateMenu();
}
```

- [ ] **Step 3: Wire the click handlers**

In `updateMenu()`'s `if (ready) { ... }` block (from Task 7), add a loop wiring every rendered ability button:

```js
if (ready) {
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-flee').onclick = playerFlee;
  for (const ability of getUnlockedAbilities(state.player.level)) {
    const btn = document.getElementById(`btn-ability-${ability.id}`);
    if (btn && !btn.disabled) {
      btn.onclick = () => playerUseAbility(ability.id);
    }
  }
}
```

- [ ] **Step 4: Manually verify**

Using the same level-10 test character as Task 7, enter a battle and:
- Click Stab. Confirm: a battle-log line appears ("You use Stab on ... for N."), the monster's HP bar drops, the Stab button immediately shows a countdown and is disabled, and Chop/other unlocked abilities remain clickable.
- Wait ~4 seconds (Stab's cooldown) and confirm the Stab button re-enables with no countdown.
- Click Chop and confirm the same, with its own independent ~10s countdown (Stab being ready again doesn't affect Chop's timer).

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: wire Stab/Chop ability use, cooldown start, and click handlers"
```

---

## Task 9: Wire Slash and Sweep (secondary effects)

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `resolveDelayedHit`, `createDefenseDebuff`, `tickDefenseDebuff`, `applyDefenseDebuff` from `js/systems/abilities.js`; `applyKnockback`, `ATB_KNOCKBACK` from `js/systems/combat.js`.
- Produces: module-level `defenseDebuff` (nullable) and `pendingDelayedHit` (nullable, `{ amount: number, dueAtMs: number }`) state; `playerAttack()` and `playerUseAbility()` both damage through `applyDefenseDebuff(monsterCombatant, defenseDebuff)` instead of `monsterCombatant` directly, so Sweep's debuff affects *all* subsequent damage, not just abilities.

- [ ] **Step 1: Add the imports and new state**

Extend the two import lines in `js/screens/battleScreen.js`:

```js
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, tickBuff, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff } from '../systems/abilities.js';
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, resolveWeakMobEncounter, applyKnockback, ATB_KNOCKBACK } from '../systems/combat.js';
```

Add new module-level state alongside `abilityCooldowns`/`buffState`:

```js
let defenseDebuff = null;
let pendingDelayedHit = null;
```

In `mount()`, alongside the Task 7 reset lines, add:

```js
defenseDebuff = null;
pendingDelayedHit = null;
```

- [ ] **Step 2: Apply the defense debuff to all player damage**

In `playerAttack()`, change:

```js
const result = resolvePlayerAttack(playerCombatant, monsterCombatant);
```

to:

```js
const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuff));
```

In `playerUseAbility()` (Task 8), change:

```js
const result = resolveAbilityUse(playerCombatant, monsterCombatant, ability, buffState.active, false);
```

to:

```js
const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuff), ability, buffState.active, false);
```

(`applyDefenseDebuff` returns a new object with adjusted `defense` for the damage-math call only — `monsterCombatant.hp`/`.atb` remain the real, mutated source of truth, updated from `result.monsterHp`/`result.monsterAtb` exactly as before.)

- [ ] **Step 3: Trigger Slash's delayed hit and Sweep's defense debuff**

In `playerUseAbility()`, after the line `abilityCooldowns[abilityId] = ability.cooldownMs;`, add:

```js
if (ability.id === 'slash') {
  pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
}
if (ability.id === 'sweep') {
  defenseDebuff = createDefenseDebuff(ability);
}
```

- [ ] **Step 4: Resolve the delayed hit and tick the debuff in `tick()`**

In `tick()`, alongside the Task 7 lines, add:

```js
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
```

Place this block right after the existing `if (isReady(monsterCombatant.atb)) { monsterAttack(); }` check, still before the final `updateAtbBars(); updateMenu();` lines at the end of `tick()`.

- [ ] **Step 5: Manually verify**

Using the level-10 test character:
- Use Slash, confirm the immediate hit lands, then ~900ms later a second "Slash's bleed hits..." log line and a second HP-bar drop appear without any further input.
- Use Sweep, then immediately use Attack or Stab and confirm its logged damage is visibly higher than the same ability used before Sweep (defense reduced) — compare against a same-ability hit from Task 8's verification.
- Let Sweep's debuff run out (~6s) and confirm subsequent damage returns to its normal (non-debuffed) value.
- Land a killing blow via a Slash follow-up tick specifically (fight a weak monster down to low HP, then use Slash so the delayed tick finishes it) and confirm the battle ends normally (win screen, rewards).

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: wire Slash's delayed bleed tick and Sweep's defense-shred debuff"
```

---

## Task 10: Numbered ability shortcuts, always-visible buttons, and trees behind combatants

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `ABILITIES` (already imported).
- Produces: `abilityButtonsHtml()` reworked to iterate the full, fixed `ABILITIES` array (not `getUnlockedAbilities`) so every ability has a permanent slot number (`ABILITIES` index + 1) that never changes as more abilities unlock; `updateMenu()` reworked so Attack/ability/Flee buttons are always present in the DOM (disabled, never removed) so the menu never resizes; `handleKeydown` gains digit-key (`1`-`5`) shortcuts mirroring the button numbers; `buildDom()`'s template restructured so the decorative trees sit behind the combatant row specifically, not behind the whole panel (which today visually places them behind the button row at the bottom).

This task lands between Tasks 9 and 11 in build order — it changes the button-rendering shape that Task 11 (Super Scream indicator) and Task 12 (timing minigame) build on top of, so it must land first even though it was added to the plan after those two were originally written.

- [ ] **Step 1: Fixed numbered ability slots with always-enabled-when-possible buttons**

Replace `abilityButtonsHtml()` and `updateMenu()` (built across Tasks 7-9) with:

```js
function abilityButtonsHtml() {
  const ready = isReady(playerCombatant.atb);
  return ABILITIES.map((ability, index) => {
    const slot = index + 1;
    const locked = state.player.level < ability.unlockLevel;
    const cooldownRemaining = abilityCooldowns[ability.id] || 0;
    const disabled = locked || cooldownRemaining > 0 || !ready;
    const cooldownSuffix = cooldownRemaining > 0 ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const label = `${ability.name} (${slot})${cooldownSuffix}`;
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }).join('');
}

function updateMenu() {
  if (battleOver) {
    elements.menu.innerHTML = '';
    return;
  }
  const ready = isReady(playerCombatant.atb);
  const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);

  elements.menu.innerHTML = `
    <button id="btn-attack" ${ready ? '' : 'disabled'}>Attack</button>
    ${abilityButtonsHtml()}
    <button id="btn-item" ${hasPotion ? '' : 'disabled'}>Item</button>
    <button id="btn-flee" ${ready ? '' : 'disabled'}>Flee</button>
  `;
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-flee').onclick = playerFlee;
  document.getElementById('btn-item').onclick = playerUseItem;
  for (const ability of ABILITIES) {
    const btn = document.getElementById(`btn-ability-${ability.id}`);
    if (btn) {
      btn.onclick = () => playerUseAbility(ability.id);
    }
  }
}
```

Ability buttons now always render for all five abilities (locked ones show disabled with no countdown, since `cooldownRemaining` is `0` for an ability the player has never unlocked and thus never started a cooldown for). `onclick` handlers are now assigned unconditionally — a `disabled` button already ignores clicks natively in the DOM, so there's no need to gate the assignment itself, matching how `btn-item` already behaved before this task.

- [ ] **Step 2: Digit-key shortcuts**

Replace `handleKeydown` (unchanged since before this plan) with:

```js
function handleKeydown(event) {
  if (battleOver) return;
  const key = event.key;
  if (key === 'i' || key === 'I') {
    playerUseItem();
    return;
  }
  if (!isReady(playerCombatant.atb)) return;
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'Escape') {
    playerFlee();
  } else if (key >= '1' && key <= '5') {
    const ability = ABILITIES[Number(key) - 1];
    const locked = state.player.level < ability.unlockLevel;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    if (!locked && !onCooldown) {
      playerUseAbility(ability.id);
    }
  }
}
```

- [ ] **Step 3: Move the trees behind the combatant row only**

Today `.battle-decoration` is a direct child of `.overlay-panel.battle-screen`, absolutely positioned to cover the *entire* panel including the button row below it — since it's bottom-aligned (`align-items: flex-end`), the trees visually end up behind the buttons rather than behind the monster/hero emoji. Scope the decoration to just the combatant row by wrapping the monster zone, divider, and hero zone in a new container and moving `.battle-decoration` inside it.

In `buildDom()`'s template, change:

```html
      <div class="battle-decoration">${battleDecorationHtml()}</div>
      <div class="battle-main">
        <div class="battle-combatant" id="battle-monster-zone">
```

to:

```html
      <div class="battle-main">
        <div class="battle-combatants-row">
          <div class="battle-decoration">${battleDecorationHtml()}</div>
          <div class="battle-combatant" id="battle-monster-zone">
```

and change the existing closing tags right after the hero zone's closing `</div>` (immediately before `<div class="battle-menu" id="battle-menu"></div>`) from:

```html
        </div>
        <div class="battle-menu" id="battle-menu"></div>
```

to:

```html
        </div>
        </div>
        <div class="battle-menu" id="battle-menu"></div>
```

(This closes the new `.battle-combatants-row` wrapper right after the hero zone, before the menu — the menu stays a sibling of the row, outside the decoration's bounds.)

In `css/styles.css`, change:

```css
.battle-decoration {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-evenly;
  font-size: 5rem;
  line-height: 1;
  padding-bottom: 4px;
  opacity: 0.32;
  pointer-events: none;
  z-index: 0;
}
```

to:

```css
.battle-combatants-row {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.battle-decoration {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  font-size: 5rem;
  line-height: 1;
  opacity: 0.32;
  pointer-events: none;
  z-index: 0;
}
```

(`.battle-decoration` keeps the same absolute/z-index approach, just scoped to the new smaller `.battle-combatants-row` instead of the whole panel — no change needed to `.battle-main`'s existing `position: relative; z-index: 1;`, it's harmless now but not worth removing in this task.)

- [ ] **Step 4: Manually verify**

Using a level-10 test character (same `localStorage` technique as prior tasks): confirm all five ability buttons are always visible in the menu, including before ATB is ready (greyed/disabled rather than absent) and confirm the menu's height doesn't visibly change as ATB fills and the buttons re-enable. Confirm each button's label shows its number, e.g. "Stab (1)", "Super Scream (5)". Press `1` through `5` on the keyboard during a ready turn and confirm each triggers the matching ability exactly like clicking its button. Visually confirm the trees now render behind the monster/hero emoji and HP/ATB bars, not overlapping or appearing near the button row.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: fixed numbered ability slots, always-visible buttons, trees behind combatants"
```

---

## Task 11: Wire Super Scream (buff activation + indicator)

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `activateBuff` from `js/systems/abilities.js`.
- Produces: `playerUseAbility` handles `ability.type === 'buff'`; a buff indicator element in the battle DOM showing an active countdown.

- [ ] **Step 1: Add the import**

Extend the `abilities.js` import to include `activateBuff`.

- [ ] **Step 2: Branch `playerUseAbility` for buff-type abilities**

Change the top of `playerUseAbility` (from Task 8):

```js
function playerUseAbility(abilityId) {
  const ability = ABILITIES.find((a) => a.id === abilityId);
  if (ability.type === 'buff') {
    buffState = activateBuff(ability);
    abilityCooldowns[abilityId] = ability.cooldownMs;
    playerCombatant.atb = 0;
    log.push(`You use ${ability.name}! Your attacks hit harder for a while.`);
    updateAtbBars();
    updateLog();
    updateMenu();
    return;
  }
  const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuff), ability, buffState.active, false);
  // ...rest unchanged from Task 9
```

- [ ] **Step 3: Add a buff indicator to the DOM**

In `buildDom()`'s template, inside the `#battle-hero-zone` div, add a new element right after the hero's ATB bar:

```html
<div class="battle-buff-indicator" id="battle-buff-indicator"></div>
```

Add the new element to the `elements` object built right after `buildDom()`'s `rootEl.innerHTML = ...` assignment:

```js
buffIndicator: document.getElementById('battle-buff-indicator'),
```

Add a small render function and call it from `tick()` (alongside the other per-tick updates) and from `updateMenu()`/`playerUseAbility`'s buff branch (so it also reflects state right after activation, not just on the next tick):

```js
function updateBuffIndicator() {
  elements.buffIndicator.textContent = buffState.active
    ? `💪 Super Scream: ${Math.ceil(buffState.remainingMs / 1000)}s`
    : '';
}
```

Call `updateBuffIndicator();` at the end of `tick()`, and add a call to it right after `buffState = activateBuff(ability);` in `playerUseAbility`.

- [ ] **Step 4: Add CSS for the indicator**

Add to `css/styles.css`:

```css
.battle-buff-indicator {
  font-size: 0.85rem;
  color: #f5b942;
  min-height: 1.2em;
  margin-top: 4px;
}
```

- [ ] **Step 5: Manually verify**

Using the level-10 test character: use Super Scream, confirm the indicator shows "💪 Super Scream: 12s" and counts down every tick, and disappears at 0. While it's active, use Stab/Chop and confirm (per Task 5's tested math) the damage is visibly the rotation-boosted amount, not the base amount from Task 8's verification.

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: wire Super Scream buff activation and battle-screen indicator"
```

---

## Task 12: Timing minigame UI

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `resolveTimingHit` from `js/systems/abilities.js`.
- Produces: pressing an ability button now shows a short timing meter before the ability resolves; the previously-hardcoded `false` timing argument in `playerUseAbility`'s `resolveAbilityUse` call is replaced with the real result.

This is the one piece of new interactive UI beyond a button, so it's worth spelling out the exact mechanism: a meter fills over `TIMING_METER_DURATION_MS`; a "sweet spot" zone covers the last 20% of it; a click on the meter (or pressing Space) at any point locks in that moment's percentage, or the meter auto-resolves as a miss (percent = -1, always outside the sweet spot) if the player never acts.

- [ ] **Step 1: Add the import and constants**

Extend the `abilities.js` import to include `resolveTimingHit`. Add near the top of `js/screens/battleScreen.js`:

```js
const TIMING_METER_DURATION_MS = 1000;
const TIMING_SWEET_SPOT_START = 80;
const TIMING_SWEET_SPOT_END = 100;
```

- [ ] **Step 2: Add the timing-meter DOM and its own small render loop**

In `buildDom()`'s template, add a hidden-by-default overlay inside `.battle-main`:

```html
<div class="battle-timing-meter" id="battle-timing-meter" hidden>
  <div class="battle-timing-track">
    <div class="battle-timing-sweet-spot" style="left: 80%; width: 20%;"></div>
    <div class="battle-timing-fill" id="battle-timing-fill"></div>
  </div>
</div>
```

Add to the `elements` object:

```js
timingMeter: document.getElementById('battle-timing-meter'),
timingFill: document.getElementById('battle-timing-fill'),
```

Add a new function that shows the meter, animates it, and resolves to a Promise of the hit/miss boolean:

```js
function runTimingMeter() {
  return new Promise((resolve) => {
    elements.timingMeter.hidden = false;
    const startedAt = performance.now();
    let resolved = false;
    let rafId = null;

    function finish(actedAtPercent) {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(rafId);
      elements.timingMeter.hidden = true;
      elements.timingMeter.onclick = null;
      resolve(resolveTimingHit(actedAtPercent, TIMING_SWEET_SPOT_START, TIMING_SWEET_SPOT_END));
    }

    function frame(now) {
      const elapsed = now - startedAt;
      const percent = Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100);
      elements.timingFill.style.width = `${percent}%`;
      if (percent >= 100) {
        finish(-1); // ran out with no input: always a miss, ability still resolves at base value
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    elements.timingMeter.onclick = () => {
      const elapsed = performance.now() - startedAt;
      finish(Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100));
    };

    rafId = requestAnimationFrame(frame);
  });
}
```

- [ ] **Step 3: Route ability use through the timing meter**

Change `playerUseAbility` (built across Tasks 8-9 and 11) from a synchronous function into an `async` one, and use the real timing result in place of the Task 8 stub. Replace the function signature and the `resolveAbilityUse` call site:

```js
async function playerUseAbility(abilityId) {
  const ability = ABILITIES.find((a) => a.id === abilityId);
  if (ability.type === 'buff') {
    buffState = activateBuff(ability);
    abilityCooldowns[abilityId] = ability.cooldownMs;
    playerCombatant.atb = 0;
    log.push(`You use ${ability.name}! Your attacks hit harder for a while.`);
    updateAtbBars();
    updateLog();
    updateBuffIndicator();
    updateMenu();
    return;
  }
  const timingHit = await runTimingMeter();
  const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuff), ability, buffState.active, timingHit);
  // ...rest unchanged from Task 9 (monsterCombatant.hp = result.monsterHp; etc.)
}
```

The click-handler wiring in `updateMenu()` (Task 10) already assigns `onclick = () => playerUseAbility(ability.id)` unconditionally — this already works unchanged with an `async` function; no change needed there.

- [ ] **Step 4: Add CSS for the meter**

Add to `css/styles.css`:

```css
.battle-timing-meter {
  margin: 8px 0;
}
.battle-timing-track {
  position: relative;
  height: 14px;
  background: #2a2a2a;
  border-radius: 7px;
  overflow: hidden;
}
.battle-timing-sweet-spot {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(74, 222, 128, 0.35);
}
.battle-timing-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 0%;
  background: #f5b942;
  cursor: pointer;
}
```

- [ ] **Step 5: Manually verify**

Using the level-10 test character: use any damage ability and confirm the timing meter appears, sweeps left to right over about a second, and clicking anywhere on it resolves the ability immediately. Click inside the last 20% (the highlighted green zone) and confirm the resulting damage matches Task 5's tested timing-bonus math (visibly higher than a click earlier in the bar). Deliberately don't click at all and confirm the meter auto-resolves after ~1s with the ability still landing at its normal (non-bonus) value — never stuck, never a wasted turn.

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: add never-fails timing minigame to ability activation"
```

---

## Task 13: Full playtest pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests pass, including the ~22 new `abilities.test.js` tests and every pre-existing test file untouched.

- [ ] **Step 2: Fresh-character progression playtest**

Start a brand-new character (no `localStorage` manipulation this time — real leveling) and play far enough to level up naturally through 2, 4, 6, 8, and 10 (grinding near-town monsters is fine). At each threshold, confirm the newly-unlocked ability's button becomes enabled (it should already be visible, just disabled, per Task 10 — confirm it was never absent) and that later, still-locked abilities remain visibly present but disabled with their correct slot number.

- [ ] **Step 3: Full-kit combat playtest at level 10**

In a real battle: confirm the menu's size stays visually constant as ATB fills and buttons enable/disable (no resizing); use each of the five keyboard shortcuts (`1`-`5`) at least once and confirm they match their buttons; use Stab and Chop a few times each to confirm independent cooldowns feel right at a glance; use Slash and confirm the delayed bleed tick lands; use Sweep and confirm a follow-up attack visibly hits harder; use Super Scream and confirm the buff indicator, then land a Chop or Slash during the window and confirm it's a clearly bigger number than the same ability outside the window; try the timing meter both hitting and missing the sweet spot deliberately; confirm the trees render behind the combatants, not overlapping the button row.

- [ ] **Step 4: Confirm nothing outside battle changed**

Visit Stats, Inventory, Shop, Smith, and the Log screen — confirm nothing about them changed (this build touches only `battleScreen.js`, `abilities.js`, and `styles.css`).

- [ ] **Step 5: Update CHANGELOG.md**

Add an entry under `## [Unreleased]` → `### Added` in `CHANGELOG.md` describing the shipped feature (five abilities, real-time cooldowns, Super Scream rotation window, never-fails timing minigame), matching the style of the existing entries in that file. Commit:

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for Phase 1 combat abilities"
```

---

## Plan self-review notes

- **Spec coverage:** every named mechanic in the spec (roster/schedule, real-time cooldowns independent of ATB, rotation bonus, timing minigame with no hard fail, Slash/Sweep secondary effects, damage composition order, zero save-data changes) maps to a task above. Multi-enemy targeting is confirmed out of scope throughout (no task references a second monster).
- **Type consistency check:** `resolveAbilityUse`'s return shape (`damage/isCrit/monsterHp/monsterAtb/playerAtb`) is defined once in Task 5 and consumed identically in Tasks 8-9 and 11-12 without renaming any field. `BuffState`'s shape (`active/remainingMs/multiplier`) and `DefenseDebuff`'s shape (`active/multiplier/remainingMs`) are likewise defined once (Tasks 3 and 6) and never reshaped later.
- **No placeholders:** every step includes literal code, not a description of code.

## Amendment (2026-08-17, mid-execution)

Task 10 (numbered ability shortcuts, always-visible buttons, trees behind combatants) was inserted after Task 9 and before the original Task 10, based on user feedback watching Tasks 7-9 run live in the browser. The original Task 10 (Super Scream) and Task 11 (timing minigame) were renumbered to 11 and 12; the original Task 12 (full playtest) became Task 13, with its manual-verification steps extended to cover the new UI. Cross-references throughout the plan (Task 8's forward-reference comment, Task 12's references to where click-wiring lives) were updated to match. This insertion works because Task 10 only reshapes button *rendering* (`updateMenu`/`abilityButtonsHtml`/`handleKeydown`) and the decoration DOM structure — it does not touch `playerUseAbility`'s internal logic, so Tasks 11-12's edits to that function's body remain valid unchanged against the post-Task-10 file.
