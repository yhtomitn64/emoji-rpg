# Ability Rotation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 damage abilities' combo/timing-meter system with 4 distinct instant-cast rotation roles (strong single-target, cleave-adjacent, self-retrigger buff, AOE-widener), renamed Impale/Sever/Lacerate/Faultline.

**Architecture:** `js/systems/abilities.js` loses its combo data/functions and gains simpler per-role fields; `js/screens/battleScreen.js` drops the live wind-up timing-meter entirely (every ability use becomes synchronous) and gains three small pieces of new battle-scoped state (Sever/widen's shared extra-target helper, Faultline's widen-buff flag, Lacerate's self-retrigger window). Internal ability `id`s (`stab`/`chop`/`slash`/`sweep`) are **not** renamed — only `name`/`icon`/mechanics change — so `tools/animation-lab/`'s per-id keyframe designs, the `btn-ability-<id>` DOM ids, and every id-keyed test selector stay valid untouched.

**Tech Stack:** Vanilla JS (ES modules), jsdom-based DOM tests (`tests/helpers/dom.js`), Node's built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-02-ability-rotation-v2-design.md`

## Global Constraints

- Rename (display only, not `id`): Stab → **Impale**, Chop → **Sever**, Slash → **Lacerate**, Sweep → **Faultline** (icon 🌪️ → 🪨). Super Scream is untouched.
- Sever always hits its target plus one random other living enemy (empty pool when solo = primary only).
- Faultline's widen buff: for 6s after use (same duration as its existing defense-shred), Impale/Sever/Lacerate each hit one *additional* random living enemy beyond whatever they already hit (Sever goes target+1 → target+2).
- Lacerate: instant hit + existing delayed bleed tick, unchanged, PLUS opens a ~1.2s self-retrigger window afterward; landing a re-press of Lacerate itself inside the window's sweet spot (last 20%, reusing `TIMING_SWEET_SPOT_START`/`END` = 80/100) grants the shared buffed state (`ROTATION_BONUS_MULTIPLIER`, 1.25x) for 9s — refreshes the single shared `buffState`, never stacks multiplicatively with Super Scream's own buff.
- The live wind-up timing meter (`runTimingMeter`, `.battle-timing-*` DOM/CSS) and the combo system (`comboRole`/`comboPartnerId`/`comboBonusMultiplier`, `comboState`, `comboTimingHintUnlocked`) are deleted entirely — nothing replaces cross-ability priming.
- Starting damage numbers for this ship: **reuse today's exact per-id values unchanged** (`stab`: 0.8x/4000ms cooldown, `chop`: 1.1x/10000ms, `slash`: 0.85x/6000ms + existing 0.2x/900ms delayed hit, `sweep`: 1.3x/12000ms + existing 0.85x/6000ms defense-shred) — only the mechanics wrapped around them change. Retuning is an explicit follow-up via `scripts/simulate-balance.js`, not part of this plan.
- Every code-touching commit needs a `CHANGELOG.md` **Unreleased** entry (this repo's CI enforces it); bump to a dated version before the final push per `CLAUDE.md`'s versioning checklist, with a matching `js/data/playerChangelog.js` entry.

---

## Task 1: Rewrite the ability data model (`js/systems/abilities.js`)

**Files:**
- Modify: `js/systems/abilities.js` (whole file)
- Modify: `js/systems/combat.js:78` (stale comment only)
- Test: `tests/abilities.test.js` (whole file, rewritten)

**Interfaces:**
- Produces: `ABILITIES` (same 5 entries, same `id`s, new `name`/`icon`/fields per Global Constraints), `resolveAbilityUse(player, monster, ability, buffActive, rng = Math.random, critChanceBonus = 0)` (drops `timingHit`/`comboBonusActive`), `estimateAbilityDamage(player, monster, ability, buffActive, rng = () => 0.5)` (drops `comboBonusActive`), `canUseAbility({ locked, onCooldown, ready, alwaysReady, retriggerWindowOpen })` (drops `comboPrimed`/`comboRole`, adds `retriggerWindowOpen`). `resolveTimingHit`, `resolveDelayedHit`, `createDefenseDebuff`/`tickDefenseDebuff`/`applyDefenseDebuff`, `tickCooldowns`, `createBuffState`/`activateBuff`/`tickBuff`, `getUnlockedAbilities` are unchanged. `comboTimingHintUnlocked` and the `COMBO_PAYOFF_BONUS_MULTIPLIER`/`COMBO_RETURN_BONUS_MULTIPLIER`/`TIMING_BONUS_MULTIPLIER` exports are deleted.
- Consumes: nothing from other tasks (this is the foundation).

- [ ] **Step 1: Write the failing tests for the new `ABILITIES` shape**

Replace `tests/abilities.test.js` in full with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveTimingHit, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, canUseAbility, estimateAbilityDamage, ROTATION_BONUS_MULTIPLIER } from '../js/systems/abilities.js';
import { ATB_KNOCKBACK } from '../js/systems/combat.js';

test('ABILITIES has exactly the five abilities in level order, ids unchanged from before the rename', () => {
  assert.deepEqual(ABILITIES.map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(ABILITIES.map((a) => a.unlockLevel), [2, 4, 6, 8, 10]);
});

test('the rename maps display name/icon to the new rotation roles, ids stay internal', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.stab.name, 'Impale');
  assert.equal(byId.chop.name, 'Sever');
  assert.equal(byId.slash.name, 'Lacerate');
  assert.equal(byId.sweep.name, 'Faultline');
  assert.equal(byId.sweep.icon, '🪨');
  assert.equal(byId.superScream.name, 'Super Scream');
});

test('getUnlockedAbilities returns only abilities unlocked at or below the given level', () => {
  assert.deepEqual(getUnlockedAbilities(1), []);
  assert.deepEqual(getUnlockedAbilities(2).map((a) => a.id), ['stab']);
  assert.deepEqual(getUnlockedAbilities(5).map((a) => a.id), ['stab', 'chop']);
  assert.deepEqual(getUnlockedAbilities(10).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
  assert.deepEqual(getUnlockedAbilities(99).map((a) => a.id), ['stab', 'chop', 'slash', 'sweep', 'superScream']);
});

test('tickCooldowns reduces every entry by dt, flooring at 0', () => {
  const result = tickCooldowns({ stab: 1000, chop: 200, sweep: 0 }, 300);
  assert.deepEqual(result, { stab: 700, chop: 0, sweep: 0 });
});

test('tickCooldowns does not mutate the input object', () => {
  const input = { stab: 1000 };
  tickCooldowns(input, 300);
  assert.deepEqual(input, { stab: 1000 });
});

test('createBuffState starts inactive with no bonus', () => {
  assert.deepEqual(createBuffState(), { active: false, remainingMs: 0 });
});

test('activateBuff turns the buff on using the ability\'s own duration', () => {
  const superScream = ABILITIES.find((a) => a.id === 'superScream');
  assert.deepEqual(activateBuff(superScream), { active: true, remainingMs: 12000 });
});

test('tickBuff counts down while active', () => {
  const buff = { active: true, remainingMs: 1000 };
  assert.deepEqual(tickBuff(buff, 300), { active: true, remainingMs: 700 });
});

test('tickBuff expires back to the inactive state once remainingMs hits 0', () => {
  const buff = { active: true, remainingMs: 200 };
  assert.deepEqual(tickBuff(buff, 300), { active: false, remainingMs: 0 });
});

test('tickBuff on an already-inactive buff is a no-op', () => {
  const buff = createBuffState();
  assert.deepEqual(tickBuff(buff, 300), buff);
});

test('resolveTimingHit is true inside the sweet spot, true on the edges, false outside it', () => {
  assert.equal(resolveTimingHit(85, 80, 100), true);
  assert.equal(resolveTimingHit(80, 80, 100), true);
  assert.equal(resolveTimingHit(100, 80, 100), true);
  assert.equal(resolveTimingHit(79, 80, 100), false);
  assert.equal(resolveTimingHit(50, 80, 100), false);
});

test('resolveAbilityUse applies the ability multiplier on top of a plain attack, no buff bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, no crit
  const result = resolveAbilityUse(player, monster, stab, false, () => 0.5);
  assert.equal(result.damage, 6); // round(8 * 0.8) = 6
  assert.equal(result.isCrit, false);
  assert.equal(result.monsterHp, 94);
  assert.equal(result.playerAtb, 0);
});

test('resolveAbilityUse multiplies in the rotation bonus when the buff is active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, () => 0.5);
  // base 8, * 1.1 (chop) = round(8.8) = 9, * 1.25 (rotation) = round(11.25) = 11
  assert.equal(result.damage, 11);
});

test('resolveAbilityUse applies an optional crit chance bonus, defaulting to none', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const noBonus = resolveAbilityUse(player, monster, stab, false, () => 0.15, 0);
  assert.equal(noBonus.isCrit, false);
  const withBonus = resolveAbilityUse(player, monster, stab, false, () => 0.15, 0.08);
  assert.equal(withBonus.isCrit, true);
});

test('resolveAbilityUse knocks the monster\'s ATB back and never drops HP below 0', () => {
  const player = { attack: 500, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 10, defense: 0, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, () => 0.5);
  assert.equal(result.monsterHp, 0);
  assert.equal(result.monsterAtb, 50 - ATB_KNOCKBACK);
});

test('resolveDelayedHit computes Lacerate\'s follow-up bleed tick as a fraction of the original hit', () => {
  const lacerate = ABILITIES.find((a) => a.id === 'slash');
  assert.equal(resolveDelayedHit(100, lacerate), 20); // round(100 * 0.2)
});

test('createDefenseDebuff starts active using the ability\'s own multiplier and duration', () => {
  const faultline = ABILITIES.find((a) => a.id === 'sweep');
  assert.deepEqual(createDefenseDebuff(faultline), { active: true, multiplier: 0.85, remainingMs: 6000 });
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

test('only Faultline has the aoe flag set', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.aoe, true);
  assert.equal(byId.stab.aoe, undefined);
  assert.equal(byId.chop.aoe, undefined);
  assert.equal(byId.slash.aoe, undefined);
  assert.equal(byId.superScream.aoe, undefined);
});

test('Sever carries its own permanent extra-target count of 1, no other ability does by default', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.chop.extraTargetCount, 1);
  assert.equal(byId.stab.extraTargetCount, undefined);
  assert.equal(byId.slash.extraTargetCount, undefined);
  assert.equal(byId.sweep.extraTargetCount, undefined);
});

test('Faultline carries a widenBonusTargets of 1, reused as the widen buff target bonus', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.widenBonusTargets, 1);
});

test('Lacerate carries a retrigger config with a window duration and a sweet spot matching TIMING_SWEET_SPOT_START/END', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.deepEqual(byId.slash.retrigger, { windowMs: 1200, sweetSpotStartPercent: 80, sweetSpotEndPercent: 100, buffDurationMs: 9000 });
});

test('canUseAbility requires ready, unless a retrigger window is open for this ability', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: true }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: false, retriggerWindowOpen: true }), true);
});

test('canUseAbility is false when locked, even with a retrigger window open', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, ready: true, retriggerWindowOpen: true }), false);
});

test('canUseAbility is false when on cooldown and no retrigger window is open', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: true }), false);
});

test('canUseAbility bypasses the ready gate when alwaysReady is set, e.g. Super Scream', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, alwaysReady: true }), true);
  assert.equal(canUseAbility({ locked: false, onCooldown: false, ready: false, alwaysReady: false }), false);
});

test('canUseAbility still respects locked/onCooldown even when alwaysReady is set', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, ready: false, alwaysReady: true }), false);
  assert.equal(canUseAbility({ locked: false, onCooldown: true, ready: false, alwaysReady: true }), false);
});

test('every ability has a distinct icon', () => {
  const icons = ABILITIES.map((a) => a.icon);
  assert.ok(icons.every((icon) => typeof icon === 'string' && icon.length > 0));
  assert.equal(new Set(icons).size, icons.length);
});

test('estimateAbilityDamage applies the ability multiplier with no buff bonus', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // rng()=0.5 -> variance 1.0 -> base damage = 10-2 = 8, * 0.8 (stab) = round(6.4) = 6
  assert.equal(estimateAbilityDamage(player, monster, stab, false, () => 0.5), 6);
});

test('estimateAbilityDamage multiplies in the rotation buff bonus when active', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  // base 8, * 1.1 (chop) = round(8.8) = 9, * 1.25 (rotation) = round(11.25) = 11
  assert.equal(estimateAbilityDamage(player, monster, chop, true, () => 0.5), 11);
});

test('estimateAbilityDamage applies the speed damage bonus deterministically', () => {
  const player = { attack: 10, defense: 4, speed: 20, atb: 0 }; // at SPEED_DAMAGE_BONUS_THRESHOLD
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  // base 8, * 0.8 (stab) = round(6.4) = 6, * 1.1 (speed bonus) = round(6.6) = 7
  assert.equal(estimateAbilityDamage(player, monster, stab, false, () => 0.5), 7);
});

test('estimateAbilityDamage defaults to an average roll when no rng is supplied', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = estimateAbilityDamage(player, monster, stab, false);
  assert.equal(result, 6);
});

test('ROTATION_BONUS_MULTIPLIER keeps its spec\'d value', () => {
  assert.equal(ROTATION_BONUS_MULTIPLIER, 1.25);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/abilities.test.js`
Expected: multiple FAIL — `ABILITIES` entries still have the old names/no `retrigger`/`extraTargetCount`/`widenBonusTargets` fields, `resolveAbilityUse`/`estimateAbilityDamage`/`canUseAbility` still take the old parameter shapes, `comboTimingHintUnlocked` import error (function still exists but the test file above no longer imports it — this step is about the *new* assertions failing, not an import crash).

- [ ] **Step 3: Rewrite `js/systems/abilities.js`**

Replace the whole file with:

```js
import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK } from './combat.js';

// Powers the damage number shown next to each ability button. Deliberately
// excludes crit (rollCrit) - luck at press-time, not something the player
// can know before pressing. Buff state IS known in advance (visible from
// the buff indicator), so it's included for accuracy.

export const ROTATION_BONUS_MULTIPLIER = 1.25;

export const ABILITIES = [
  {
    id: 'stab', name: 'Impale', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.8, cooldownMs: 4000,
    description: 'a strong, precise single-target thrust',
  },
  {
    id: 'chop', name: 'Sever', icon: '🪓', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.1, cooldownMs: 10000,
    extraTargetCount: 1,
    description: 'cuts through the target and into one random enemy beside it - still fine to use one-on-one',
  },
  {
    id: 'slash', name: 'Lacerate', icon: '⚔️', unlockLevel: 6, type: 'damage',
    damageMultiplier: 0.85, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
    retrigger: { windowMs: 1200, sweetSpotStartPercent: 80, sweetSpotEndPercent: 100, buffDurationMs: 9000 },
    description: 'a cut that bleeds for extra damage a moment later - press it again right after landing to buff your other abilities for a while',
  },
  {
    id: 'sweep', name: 'Faultline', icon: '🪨', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
    widenBonusTargets: 1,
    aoe: true,
    description: 'a weak hit on every living enemy that weakens their defense and widens what your other abilities can hit for a few seconds',
  },
  {
    id: 'superScream', name: 'Super Scream', icon: '📢', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000,
    description: 'a roar that boosts all your damage for a while',
  },
];

export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
}

export function canUseAbility({ locked, onCooldown, ready, alwaysReady, retriggerWindowOpen }) {
  if (locked) return false;
  // Lacerate's own self-retrigger window (see js/screens/battleScreen.js)
  // makes its button clickable again despite still being on cooldown - a
  // deliberately different input than a normal reuse.
  if (retriggerWindowOpen) return true;
  return !onCooldown && !!(ready || alwaysReady);
}

export function tickCooldowns(cooldowns, dt) {
  const next = {};
  for (const [id, remainingMs] of Object.entries(cooldowns)) {
    next[id] = Math.max(0, remainingMs - dt);
  }
  return next;
}

export function createBuffState() {
  return { active: false, remainingMs: 0 };
}

export function activateBuff(ability) {
  return { active: true, remainingMs: ability.buffDurationMs };
}

export function tickBuff(buffState, dt) {
  if (!buffState.active) return buffState;
  const remainingMs = Math.max(0, buffState.remainingMs - dt);
  return remainingMs === 0 ? createBuffState() : { ...buffState, remainingMs };
}

export function resolveTimingHit(actedAtPercent, sweetSpotStartPercent, sweetSpotEndPercent) {
  return actedAtPercent >= sweetSpotStartPercent && actedAtPercent <= sweetSpotEndPercent;
}

export function resolveAbilityUse(player, monster, ability, buffActive, rng = Math.random, critChanceBonus = 0) {
  const isCrit = rollCrit(rng, critChanceBonus);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
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

export function estimateAbilityDamage(player, monster, ability, buffActive, rng = () => 0.5) {
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  return applySpeedDamageBonus(damage, player.speed);
}

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

- [ ] **Step 4: Update the stale comment in `js/systems/combat.js`**

At `js/systems/combat.js:78`, replace:

```js
// Each unlocked ability (Stab/Chop/Slash/Sweep/Super Scream) drags the floor
```

with:

```js
// Each unlocked ability (Impale/Sever/Lacerate/Faultline/Super Scream) drags the floor
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/abilities.test.js`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add js/systems/abilities.js js/systems/combat.js tests/abilities.test.js
git commit -m "feat: ability rotation v2 data model - new roles, names, drop combo system"
```

---

## Task 2: Remove the live timing meter; make ability use synchronous; drop combo bookkeeping

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`
- Modify: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `abilities.js`'s new `resolveAbilityUse(player, monster, ability, buffActive, rng, critChanceBonus)` / `estimateAbilityDamage(player, monster, ability, buffActive, rng)` / `canUseAbility({ locked, onCooldown, ready, alwaysReady, retriggerWindowOpen })` from Task 1.
- Produces: `playerUseAbility(abilityId)` is now the same synchronous shape `playerAttack()` already has for the non-aoe branch (still `async function` for consistency with the aoe branch's staggered-sequence `await`s, but no longer awaits a timing meter). `abilityButtonEntries()` no longer computes combo state. This task deliberately does NOT yet implement Sever's extra target, Faultline's widen buff, or Lacerate's retrigger window (Tasks 3-5) - it only removes the old mechanism and keeps single-target/aoe resolution behaviorally equivalent (minus the timing bonus, which is being removed, not replaced yet).

- [ ] **Step 1: Write the failing/updated DOM tests for synchronous ability use**

In `tests/battleScreenDom.test.js`, replace the test at (search for) `'a landed hit on a timing-hit Stab primes Chop for an instant combo bonus'` with:

```js
  await t.test('using Impale resolves synchronously - no timing meter to wait through', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 2 } }) });
    const before = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-ability-stab'));
    // No await needed at all - resolves in the same synchronous click handler.
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, before);
    assert.match(root.querySelector('#battle-log').textContent, /You use Impale/);
  });
```

Then find the two comments referencing the old combo system and fix them (behavior in these two tests is already correct/unchanged, only the comments are stale):
- `'using Chop spawns a swing sprite carrying Chop\'s own icon, not the equipped weapon\'s'`: replace its comment `// Chop is a combo payoff (js/systems/abilities.js) - it skips the timing\n    // meter entirely, so clicking it resolves synchronously like Attack does,\n    // no need for the timing-meter wait/keydown dance the Stab test above uses.` with `// Every ability resolves synchronously post-rotation-v2 (js/systems/abilities.js) - no timing-meter wait needed for any of them.` and update the test's own title/references from "Chop" to "Sever" only in the assertion text if any (the button id `#btn-ability-chop` and icon `🪓` stay unchanged since Sever's icon is unchanged).
- `'using Sweep hits each target in sequence with a single traveling swing sprite, not all at once'`: replace its comment `// Sweep is a combo payoff (js/systems/abilities.js) - like Chop, it skips\n    // the timing meter, so the only await before the first target resolves\n    // is the new staggered sequence's own delay.` with `// Faultline (js/systems/abilities.js) resolves synchronously too - the only await before the first target resolves is the staggered sequence's own delay.`

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL on the new "using Impale resolves synchronously" test (Impale/Stab still awaits the timing meter, so a synchronous assertion right after `click()` sees no change yet), and a second FAIL on the old removed test's replacement not existing yet if you ran before editing - confirm only the new test fails, the Chop/Sweep ones still pass since their behavior hasn't changed yet.

- [ ] **Step 3: Delete the timing meter from `js/screens/battleScreen.js`**

Delete these in full:
- The `TIMING_METER_DURATION_MS`, `TIMING_SWEET_SPOT_START`, `TIMING_SWEET_SPOT_END` constants (lines ~30-32) — **keep** `TIMING_SWEET_SPOT_START`/`TIMING_SWEET_SPOT_END` (Task 5 needs them for Lacerate's own retrigger sweet spot) but **delete** `TIMING_METER_DURATION_MS`.
- The `runTimingMeter(ability)` function (lines ~331-428).
- The `timingMeterHtml()` function (lines ~211-222) and its call site `${timingMeterHtml()}` in `buildDom()`'s template (line ~284).
- The four `elements.timingMeter`/`timingFill`/`timingHint`/`timingSweetSpot` entries in `buildDom()`'s `elements = {...}` object (lines ~324-327).
- The `activeTimingMeterHandle` module variable (line ~63-ish, search for its declaration) and its `= null` reset in `mount()` (line ~1983).
- `comboTimingHintUnlocked` from the `abilities.js` import at the top of the file.

- [ ] **Step 4: Remove combo bookkeeping and make `playerUseAbility` synchronous**

Replace `abilityButtonEntries()` (currently lines ~747-796) with:

```js
function abilityButtonEntries() {
  const ready = isReady(playerCombatant.atb);
  const target = monsterCombatants[selectedMonsterIndex];
  return getUnlockedAbilities(state.player.level).map((ability, index) => {
    const slot = index + 1;
    const cooldownRemaining = abilityCooldowns[ability.id] || 0;
    const alwaysReady = ability.type === 'buff';
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, ready, alwaysReady });
    const cooldownActive = cooldownRemaining > 0;
    const cooldownPct = cooldownActive ? (cooldownRemaining / ability.cooldownMs) * 100 : 0;
    const cooldownSuffix = cooldownActive ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const keyLabel = alwaysReady ? 'Space' : String(slot);
    const keyDisplay = alwaysReady ? 'Spc' : String(slot);
    const damageSuffix = ability.type === 'damage' && target
      ? ` ~${estimateAbilityDamage(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), ability, buffState.active)} dmg`
      : '';
    const buffEffectSuffix = ability.type === 'buff'
      ? ` (+${Math.round((ROTATION_BONUS_MULTIPLIER - 1) * 100)}% for ${ability.buffDurationMs / 1000}s)`
      : '';
    const title = `${ability.name} (${keyLabel}) — ${ability.description}${buffEffectSuffix}${cooldownSuffix}${damageSuffix}`;
    const html = actionButtonHtml({
      id: `btn-ability-${ability.id}`,
      icon: ability.icon,
      key: keyDisplay,
      title,
      disabled,
      cooldownPct,
    });
    return { html, numbered: !alwaysReady };
  });
}
```

(This intentionally omits the retrigger-specific `extraClass`/suffix wiring — that's added in Task 5, which touches this same function again.)

In `handleKeydown` (search `comboPrimed` around line ~1388), remove the `comboPrimed`/`comboRole` reads and the corresponding `canUseAbility` call's now-removed arguments — the number-key/Space dispatch logic itself (which ability a key maps to) is unchanged, only the `canUseAbility` call site loses its combo arguments:

```js
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    if (canUseAbility({ locked: false, onCooldown, ready: isReady(playerCombatant.atb) })) {
```

Now rewrite `playerUseAbility` (currently lines ~1485-1658). Replace the whole function with:

```js
async function playerUseAbility(abilityId) {
  if (battleOver || battlePaused) return;
  if (abilityActionInFlight) return;
  abilityActionInFlight = true;
  document.getElementById(`btn-ability-${abilityId}`)?.classList.add('battle-ability-button-pressed');
  try {
    const ability = ABILITIES.find((a) => a.id === abilityId);
    logEvent('ability_used', { abilityId, inBattle: true, ngPlusCycle: state.ngPlusCycle });
    if (ability.type === 'buff') {
      buffState = activateBuff(ability);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      attackStreak = 0;
      attackStreakIdleMs = 0;
      log.push(`You use ${ability.name}! Your attacks hit harder for a while.`);
      updateAtbBars();
      updateBuffIndicator();
      updateLog();
      updateMenu();
      return;
    }

    const buffActiveAtPress = buffState.active;

    if (ability.aoe) {
      const targetIndices = monsterCombatants
        .map((mc, i) => i)
        .filter((i) => monsterCombatants[i].hp > 0);
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      attackStreak = 0;
      attackStreakIdleMs = 0;
      const livingIndices = targetIndices.filter((i) => monsterCombatants[i].hp > 0);
      playPlayerSweepSwing(ability, livingIndices.map((i) => elements.monsterZones[i]));
      for (let n = 0; n < targetIndices.length; n++) {
        const monsterIndex = targetIndices[n];
        await sleep(SWEEP_STAGGER_MS);
        if (battleOver || unmounted) return;
        const mc = monsterCombatants[monsterIndex];
        if (mc.hp <= 0) continue;
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, Math.random, consumeGuaranteedCritBonus());
        mc.hp = result.monsterHp;
        mc.atb = result.monsterAtb;
        playerCombatant.atb = result.playerAtb;
        maybeMarkSplitDeath(mc, result);
        mc.defenseDebuff = createDefenseDebuff(ability);
        log.push(result.isCrit
          ? `Critical! You use ${ability.name} on ${mc.name} for ${result.damage}!`
          : `You use ${ability.name} on ${mc.name} for ${result.damage}.`);
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
        recordPlayerDamage(abilityId, result.damage, elements.monsterZones[monsterIndex]);
        applyOnHitEffects(mc, result.damage);
        updateHpBars();
        updateAtbBars();
        updateLog();
      }
      checkOutcome();
      updateMenu();
      return;
    }

    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, Math.random, consumeGuaranteedCritBonus());
    target.hp = result.monsterHp;
    target.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    maybeMarkSplitDeath(target, result);
    abilityCooldowns[abilityId] = ability.cooldownMs;
    attackStreak = 0;
    attackStreakIdleMs = 0;
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    log.push(result.isCrit
      ? `Critical! You use ${ability.name} on ${target.name} for ${result.damage}!`
      : `You use ${ability.name} on ${target.name} for ${result.damage}.`);
    playPlayerSwing(ability, elements.monsterZones[targetIndex], result.isCrit);
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
    recordPlayerDamage(abilityId, result.damage, elements.monsterZones[targetIndex]);
    applyOnHitEffects(target, result.damage);
    updateHpBars();
    updateAtbBars();
    updateLog();
    checkOutcome();
    updateMenu();
  } finally {
    abilityActionInFlight = false;
  }
}
```

Remove `let comboState = {};` (module variable declaration) and its `comboState = {};` reset in `mount()`.

- [ ] **Step 5: Remove the timing-meter CSS**

In `css/styles.css`, delete the `.battle-timing-meter`, `.battle-timing-meter-active`, `.battle-timing-track`, `.battle-timing-sweet-spot`, `.battle-timing-fill`, `.battle-timing-hint`, `.battle-timing-hint-visible` rules (the block starting `.battle-timing-meter {` through `.battle-timing-hint-visible { opacity: 1; }`, currently lines ~606-647). Leave `@keyframes battle-zone-pulse` in place — it's still used by the parry zone and will be reused by Lacerate's retrigger sweet-spot flash in Task 5.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/abilities.test.js tests/battleScreenDom.test.js`
Expected: PASS. (Some other DOM tests deeper in the file that still reference combo/timing behavior surface as failures here — leave any such failures for Task 6's audit step; do not attempt to fix DOM tests unrelated to what this task changed without first confirming they're actually broken by this task's edits, not pre-existing.)

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css tests/battleScreenDom.test.js
git commit -m "feat: remove live timing meter and combo system from battle screen"
```

---

## Task 3: Sever's extra-target mechanic

**Files:**
- Modify: `js/screens/battleScreen.js`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `ability.extraTargetCount` from Task 1's `ABILITIES` (Sever/`chop` has `extraTargetCount: 1`).
- Produces: `pickRandomOtherLivingIndices(excludeIndex, count)` (new helper, also consumed by Task 4's widen buff).

- [ ] **Step 1: Write the failing DOM test**

Add to `tests/battleScreenDom.test.js` (near the other ability tests):

```js
  await t.test('using Sever against 2+ monsters also hits one random other living enemy', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    const hpText = (i) => root.querySelector(`#battle-monster-hp-text-${i}`).textContent;
    const before = [hpText(0), hpText(1), hpText(2)];
    click(root.querySelector('#btn-ability-chop'));
    const after = [hpText(0), hpText(1), hpText(2)];
    const hitCount = after.filter((text, i) => text !== before[i]).length;
    assert.equal(hitCount, 2, 'Sever should hit exactly the selected target plus one other');
  });

  await t.test('using Sever solo (one monster) only hits that one monster, no crash', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    const before = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-ability-chop'));
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, before);
  });
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL on "using Sever against 2+ monsters..." (`hitCount` is 1, not 2 — Sever only ever hits its primary target today). The solo test passes already (no behavior change needed for that case).

- [ ] **Step 3: Add the shared target-picking helper and wire it into Sever**

In `js/screens/battleScreen.js`, add this new function near `livingIndices()` (search for `function livingIndices()`):

```js
// Picks up to `count` distinct random living monster indices, excluding
// excludeIndex - used by Sever's own extra target and (Task 4) Faultline's
// widen buff. Returns fewer than `count` (down to zero) if there aren't
// enough other living enemies - e.g. Sever solo just returns [].
function pickRandomOtherLivingIndices(excludeIndex, count) {
  const pool = monsterCombatants
    .map((mc, i) => i)
    .filter((i) => i !== excludeIndex && monsterCombatants[i].hp > 0);
  const picked = [];
  for (let n = 0; n < count && pool.length > 0; n++) {
    const poolIndex = Math.floor(Math.random() * pool.length);
    picked.push(pool[poolIndex]);
    pool.splice(poolIndex, 1);
  }
  return picked;
}
```

In `playerUseAbility`'s single-target branch (the block added/kept in Task 2, right after `const target = monsterCombatants[targetIndex];`), add extra-target resolution. Replace this section:

```js
    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, Math.random, consumeGuaranteedCritBonus());
```

with:

```js
    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    const extraTargetIndices = pickRandomOtherLivingIndices(targetIndex, ability.extraTargetCount || 0);
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, Math.random, consumeGuaranteedCritBonus());
```

Then, after the primary target's resolution block ends (after `applyOnHitEffects(target, result.damage);` and before `updateHpBars();`), insert the extra-target loop:

```js
    for (const extraIndex of extraTargetIndices) {
      const extraTarget = monsterCombatants[extraIndex];
      if (extraTarget.hp <= 0) continue;
      const extraResult = resolveAbilityUse(playerCombatant, applyDefenseDebuff(extraTarget, extraTarget.defenseDebuff), ability, buffActiveAtPress, Math.random, consumeGuaranteedCritBonus());
      extraTarget.hp = extraResult.monsterHp;
      extraTarget.atb = extraResult.monsterAtb;
      maybeMarkSplitDeath(extraTarget, extraResult);
      log.push(extraResult.isCrit
        ? `Critical! You use ${ability.name} on ${extraTarget.name} for ${extraResult.damage}!`
        : `You use ${ability.name} on ${extraTarget.name} for ${extraResult.damage}.`);
      playHitEffect(elements.monsterZones[extraIndex], elements.monsterEmojis[extraIndex], extraResult.damage, extraResult.isCrit);
      recordPlayerDamage(abilityId, extraResult.damage, elements.monsterZones[extraIndex]);
      applyOnHitEffects(extraTarget, extraResult.damage);
    }
    updateHpBars();
```

(Note: the original single `updateHpBars();` call right after `applyOnHitEffects(target, result.damage);` is removed and replaced by the one after this new loop, so HP bars update once covering both the primary and any extra targets.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "feat: Sever hits one random other living enemy alongside its target"
```

---

## Task 4: Faultline's widen buff

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `pickRandomOtherLivingIndices` from Task 3; `ability.widenBonusTargets` from Task 1.
- Produces: `widenBuffState` (module-level, `{ active: true, remainingMs } | null`, same shape `tickDefenseDebuff` already ticks), `updateWidenIndicator()`.

- [ ] **Step 1: Write the failing DOM test**

Add to `tests/battleScreenDom.test.js`:

```js
  await t.test('Faultline\'s widen buff makes Impale also hit one extra random enemy for 6s', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    const hpText = (i) => root.querySelector(`#battle-monster-hp-text-${i}`).textContent;
    click(root.querySelector('#btn-ability-sweep'));
    // Let Faultline's own staggered all-enemies sequence finish.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.match(root.querySelector('#battle-widen-indicator').textContent, /Widened/);

    const before = [hpText(0), hpText(1), hpText(2)];
    click(root.querySelector('#btn-ability-stab'));
    const after = [hpText(0), hpText(1), hpText(2)];
    const hitCount = after.filter((text, i) => text !== before[i]).length;
    assert.equal(hitCount, 2, 'Impale should hit its target plus one extra while the widen buff is active');
  });

  await t.test('the widen buff indicator is empty when no widen buff is active', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    assert.equal(root.querySelector('#battle-widen-indicator').textContent, '');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — `#battle-widen-indicator` doesn't exist yet (both new tests fail on the `querySelector` returning `null` and `.textContent` throwing, or the assertion mismatching).

- [ ] **Step 3: Add the widen buff state, DOM element, and wiring**

In `js/screens/battleScreen.js`, add a module variable near `let buffState = createBuffState();`:

```js
let widenBuffState = null;
```

In `buildDom()`'s template, add a widen indicator next to the existing buff indicator (find `<div class="battle-buff-indicator" id="battle-buff-indicator"></div>`):

```html
              <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
              <div class="battle-widen-indicator" id="battle-widen-indicator"></div>
```

In `buildDom()`'s `elements = {...}` object, add:

```js
    widenIndicator: document.getElementById('battle-widen-indicator'),
```

Add the update function near `updateBuffIndicator()`:

```js
function updateWidenIndicator() {
  elements.widenIndicator.textContent = widenBuffState?.active
    ? `🪨 Widened: ${Math.ceil(widenBuffState.remainingMs / 1000)}s`
    : '';
}
```

Call `updateWidenIndicator();` everywhere `updateBuffIndicator();` is already called: at the end of `tick()` (next to `updateBuffIndicator();`) and at the end of the `ability.type === 'buff'` early-return branch in `playerUseAbility` is not needed there (Faultline isn't a buff-type ability), but it IS needed right after Faultline's aoe loop finishes. In the `ability.aoe` branch of `playerUseAbility`, right before `checkOutcome();`, add:

```js
      if (ability.widenBonusTargets) {
        widenBuffState = { active: true, remainingMs: ability.defenseShredDurationMs };
        updateWidenIndicator();
      }
```

In `tick()`, next to `mc.defenseDebuff = tickDefenseDebuff(mc.defenseDebuff, 300);`'s sibling ticking (find where `buffState = tickBuff(buffState, 300);` is called near the top of `tick()`), add:

```js
  widenBuffState = tickDefenseDebuff(widenBuffState, 300);
```

And in `tick()`'s final block (find `updateBuffIndicator();` near the end of `tick()`), add the widen indicator call alongside it:

```js
  updateBuffIndicator();
  updateWidenIndicator();
```

In `mount()`'s reset block, add next to `buffState = createBuffState();`:

```js
  widenBuffState = null;
```

Now apply the widen bonus target in `playerUseAbility`'s single-target branch. In the extra-target-count line added by Task 3:

```js
    const extraTargetIndices = pickRandomOtherLivingIndices(targetIndex, ability.extraTargetCount || 0);
```

replace with:

```js
    const widenActive = !!widenBuffState?.active;
    const extraTargetCount = (ability.extraTargetCount || 0) + (widenActive ? 1 : 0);
    const extraTargetIndices = pickRandomOtherLivingIndices(targetIndex, extraTargetCount);
```

- [ ] **Step 4: Add the widen indicator's CSS**

In `css/styles.css`, add next to `.battle-potion-buff-indicator`:

```css
.battle-widen-indicator {
  font-size: 0.75rem;
  color: #c9a876;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css tests/battleScreenDom.test.js
git commit -m "feat: Faultline's widen buff gives Impale/Sever/Lacerate one extra target for 6s"
```

---

## Task 5: Lacerate's self-retrigger window

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `ability.retrigger` from Task 1 (`{ windowMs, sweetSpotStartPercent, sweetSpotEndPercent, buffDurationMs }`), `resolveTimingHit`, `TIMING_SWEET_SPOT_START`/`END` (still exported from `abilities.js`... actually these are battleScreen.js's own module constants per Task 2's Step 3, which kept them — clarify: Task 2 kept `TIMING_SWEET_SPOT_START`/`_END` as battleScreen.js module constants for this task to reuse).
- Produces: `lacerateRetriggerOpen`, `lacerateRetriggerStartedAt` (module state), updated `canUseAbility` calls passing `retriggerWindowOpen`, updated `abilityButtonEntries()` glow class/suffix, `.battle-ability-button-retrigger` CSS.

- [ ] **Step 1: Write the failing DOM tests**

Add to `tests/battleScreenDom.test.js`:

```js
  await t.test('Lacerate opens a re-press window after landing, shown as a glow class on its own button', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6 } }) });
    const lacerateBtn = root.querySelector('#btn-ability-slash');
    click(lacerateBtn);
    assert.ok(lacerateBtn.classList.contains('battle-ability-button-retrigger'), 'Lacerate\'s button should glow while its retrigger window is open');
    assert.equal(lacerateBtn.disabled, false, 'Lacerate should stay clickable during its own retrigger window, despite being on cooldown');
  });

  await t.test('landing the re-press inside the sweet spot buffs the other abilities', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6 } }) });
    const lacerateBtn = root.querySelector('#btn-ability-slash');
    click(lacerateBtn);
    // The retrigger window is 1200ms with an 80-100% sweet spot - wait to 1100ms in.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    click(lacerateBtn);
    assert.match(root.querySelector('#battle-buff-indicator').textContent, /Buffed/);
    assert.equal(lacerateBtn.classList.contains('battle-ability-button-retrigger'), false, 'the glow should clear once the window is resolved');
  });

  await t.test('the "3" key also lands the re-press during Lacerate\'s window, not just clicking its button', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6 } }) });
    // Level 6 unlocks stab(1)/chop(2)/slash(3) - Lacerate is slot 3.
    keydown('3');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    keydown('3');
    assert.match(root.querySelector('#battle-buff-indicator').textContent, /Buffed/);
  });

  await t.test('missing the re-press window entirely (letting it lapse) grants no buff', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6 } }) });
    const lacerateBtn = root.querySelector('#btn-ability-slash');
    click(lacerateBtn);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // past the 1200ms window, tick() polls it closed
    assert.equal(root.querySelector('#battle-buff-indicator').textContent, '');
    assert.equal(lacerateBtn.classList.contains('battle-ability-button-retrigger'), false);
  });

  await t.test('landing the re-press while Super Scream\'s buff is already active refreshes it instead of stacking', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 10 } }) });
    click(root.querySelector('#btn-ability-superScream'));
    const buffTextAfterScream = root.querySelector('#battle-buff-indicator').textContent;
    assert.match(buffTextAfterScream, /12s/);

    const lacerateBtn = root.querySelector('#btn-ability-slash');
    click(lacerateBtn);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    click(lacerateBtn);
    // Lacerate's own buffDurationMs (9s) is shorter than Super Scream's
    // remaining ~12s at this point, so a real stack would show >12s and a
    // refresh would show exactly 9s (the single shared buffState replaced).
    assert.match(root.querySelector('#battle-buff-indicator').textContent, /9s/);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL on all five new tests — no `.battle-ability-button-retrigger` class exists yet, Lacerate's button (and the "3" key) stays gated by `disabled`/`canUseAbility` on cooldown, no buff is ever granted from a re-press.

- [ ] **Step 3: Add the retrigger window state and open/close/tick logic**

In `js/screens/battleScreen.js`, add module variables near `let buffState = createBuffState();`:

```js
let lacerateRetriggerOpen = false;
let lacerateRetriggerStartedAt = null;
```

Add helper functions near `pickRandomOtherLivingIndices` (from Task 3):

```js
function openLacerateRetriggerWindow() {
  lacerateRetriggerOpen = true;
  lacerateRetriggerStartedAt = performance.now();
}

function closeLacerateRetriggerWindow() {
  lacerateRetriggerOpen = false;
  lacerateRetriggerStartedAt = null;
}

// Reads the elapsed time since the window opened against Lacerate's own
// sweet spot, exactly like resolveTimingHit reads a live meter's elapsed
// percent - landing it activates the shared buff state at Lacerate's own
// duration; missing it (early, late, or already expired) does nothing.
function handleLacerateRetriggerPress() {
  const lacerate = ABILITIES.find((a) => a.id === 'slash');
  const elapsedMs = performance.now() - lacerateRetriggerStartedAt;
  const elapsedPercent = Math.min(100, (elapsedMs / lacerate.retrigger.windowMs) * 100);
  closeLacerateRetriggerWindow();
  if (resolveTimingHit(elapsedPercent, lacerate.retrigger.sweetSpotStartPercent, lacerate.retrigger.sweetSpotEndPercent)) {
    buffState = activateBuff({ buffDurationMs: lacerate.retrigger.buffDurationMs });
    log.push('Lacerate\'s follow-through lands! Your attacks hit harder for a while.');
    updateBuffIndicator();
    updateLog();
  }
  updateMenu();
}
```

In `tick()`, add auto-expiry near the other cooldown/buff ticking (next to `buffState = tickBuff(buffState, 300);`):

```js
  if (lacerateRetriggerOpen) {
    const lacerate = ABILITIES.find((a) => a.id === 'slash');
    if (performance.now() - lacerateRetriggerStartedAt >= lacerate.retrigger.windowMs) {
      closeLacerateRetriggerWindow();
    }
  }
```

In `mount()`'s reset block, add next to `buffState = createBuffState();`:

```js
  lacerateRetriggerOpen = false;
  lacerateRetriggerStartedAt = null;
```

- [ ] **Step 4: Wire the button click and rendering**

At the very top of `playerUseAbility(abilityId)` (right after `if (battleOver || battlePaused) return;`, before the `abilityActionInFlight` guard), add the retrigger branch:

```js
  if (abilityId === 'slash' && lacerateRetriggerOpen) {
    handleLacerateRetriggerPress();
    return;
  }
```

In the single-target branch, after the primary target's `if (ability.id === 'slash') { target.pendingDelayedHit = ...; }` block (from the original code, kept as-is through Task 2), add opening the window:

```js
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
      openLacerateRetriggerWindow();
    }
```

In `abilityButtonEntries()` (from Task 2's rewrite), add the glow class and title suffix. Replace:

```js
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, ready, alwaysReady });
    const cooldownActive = cooldownRemaining > 0;
    const cooldownPct = cooldownActive ? (cooldownRemaining / ability.cooldownMs) * 100 : 0;
    const cooldownSuffix = cooldownActive ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const keyLabel = alwaysReady ? 'Space' : String(slot);
    const keyDisplay = alwaysReady ? 'Spc' : String(slot);
    const damageSuffix = ability.type === 'damage' && target
      ? ` ~${estimateAbilityDamage(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), ability, buffState.active)} dmg`
      : '';
    const buffEffectSuffix = ability.type === 'buff'
      ? ` (+${Math.round((ROTATION_BONUS_MULTIPLIER - 1) * 100)}% for ${ability.buffDurationMs / 1000}s)`
      : '';
    const title = `${ability.name} (${keyLabel}) — ${ability.description}${buffEffectSuffix}${cooldownSuffix}${damageSuffix}`;
    const html = actionButtonHtml({
      id: `btn-ability-${ability.id}`,
      icon: ability.icon,
      key: keyDisplay,
      title,
      disabled,
      cooldownPct,
    });
```

with:

```js
    const retriggerWindowOpen = ability.id === 'slash' && lacerateRetriggerOpen;
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, ready, alwaysReady, retriggerWindowOpen });
    const cooldownActive = cooldownRemaining > 0;
    const cooldownPct = cooldownActive ? (cooldownRemaining / ability.cooldownMs) * 100 : 0;
    const cooldownSuffix = cooldownActive ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const keyLabel = alwaysReady ? 'Space' : String(slot);
    const keyDisplay = alwaysReady ? 'Spc' : String(slot);
    const damageSuffix = ability.type === 'damage' && target
      ? ` ~${estimateAbilityDamage(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), ability, buffState.active)} dmg`
      : '';
    const buffEffectSuffix = ability.type === 'buff'
      ? ` (+${Math.round((ROTATION_BONUS_MULTIPLIER - 1) * 100)}% for ${ability.buffDurationMs / 1000}s)`
      : '';
    const retriggerSuffix = retriggerWindowOpen ? ' ⚡ Re-press for buff!' : '';
    const title = `${ability.name} (${keyLabel}) — ${ability.description}${buffEffectSuffix}${cooldownSuffix}${damageSuffix}${retriggerSuffix}`;
    const retriggerClass = retriggerWindowOpen ? ' battle-ability-button-retrigger' : '';
    const html = actionButtonHtml({
      id: `btn-ability-${ability.id}`,
      icon: ability.icon,
      key: keyDisplay,
      title,
      disabled,
      extraClass: retriggerClass,
      cooldownPct,
    });
```

The number-key shortcut (`handleKeydown`, Task 2's simplified version) needs the same `retriggerWindowOpen` bypass as the button, or pressing "3" during Lacerate's glow window would silently do nothing (its own `canUseAbility` gate would still see it as on-cooldown). Find:

```js
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    if (canUseAbility({ locked: false, onCooldown, ready: isReady(playerCombatant.atb) })) {
```

and replace with:

```js
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    const retriggerWindowOpen = ability.id === 'slash' && lacerateRetriggerOpen;
    if (canUseAbility({ locked: false, onCooldown, ready: isReady(playerCombatant.atb), retriggerWindowOpen })) {
```

Update `updateBuffIndicator()` (its text is no longer Super-Scream-specific now that Lacerate's retrigger also grants it):

```js
function updateBuffIndicator() {
  elements.buffIndicator.textContent = buffState.active
    ? `💪 Buffed: ${Math.ceil(buffState.remainingMs / 1000)}s`
    : '';
}
```

- [ ] **Step 5: Add the retrigger glow CSS**

In `css/styles.css`, rename `.battle-ability-button-combo` to `.battle-ability-button-retrigger` (it's otherwise unused after Task 2 removed the combo system):

```css
.battle-ability-button-retrigger {
  border-color: #f5b942;
  box-shadow: 0 0 8px rgba(245, 185, 66, 0.6);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/abilities.test.js tests/battleScreenDom.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css tests/battleScreenDom.test.js
git commit -m "feat: Lacerate self-retrigger window buffs the rotation on a well-timed re-press"
```

---

## Task 6: Update the balance simulator for the new roster shape

**Files:**
- Modify: `scripts/simulateAbilityPolicy.js`
- Modify: `scripts/simulate-balance.js`
- Modify: `tests/simulateAbilityPolicy.test.js`

**Interfaces:**
- Consumes: `abilities.js`'s new `resolveAbilityUse`/`activateBuff` shapes from Task 1.
- Produces: `chooseAction({ level, cooldowns, buffActive, ready, attackOnCooldown })` (drops `comboState`).

- [ ] **Step 1: Write the failing tests**

Replace `tests/simulateAbilityPolicy.test.js` in full with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../scripts/simulateAbilityPolicy.js';

test('chooseAction attacks when nothing is unlocked yet (level 1)', () => {
  const action = chooseAction({ level: 1, cooldowns: {}, buffActive: false, ready: true, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction uses Super Scream when unlocked, off cooldown, and not already active', () => {
  const action = chooseAction({ level: 10, cooldowns: {}, buffActive: false, ready: false, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'ability', id: 'superScream' });
});

test('chooseAction does not re-trigger Super Scream while its buff is already active', () => {
  const action = chooseAction({ level: 10, cooldowns: {}, buffActive: true, ready: true, attackOnCooldown: false });
  // Falls through to the best ready damage ability instead (sweep/Faultline is the highest-unlocked at level 10).
  assert.deepEqual(action, { kind: 'ability', id: 'sweep' });
});

test('chooseAction picks the highest-unlocked ready damage ability', () => {
  const action = chooseAction({ level: 6, cooldowns: {}, buffActive: false, ready: true, attackOnCooldown: false });
  // Level 6 unlocks stab/chop/slash - slash has the highest unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'slash' });
});

test('chooseAction skips damage abilities that are on cooldown even if ready', () => {
  const action = chooseAction({ level: 6, cooldowns: { slash: 2000 }, buffActive: false, ready: true, attackOnCooldown: false });
  // slash is excluded (on cooldown); of the remaining unlocked candidates (stab, chop), chop has the higher unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'chop' });
});

test('chooseAction attacks when ready but every unlocked ability is on cooldown', () => {
  const action = chooseAction({ level: 4, cooldowns: { stab: 1000, chop: 1000 }, buffActive: false, ready: true, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction does nothing when not ready and Attack is on cooldown', () => {
  const action = chooseAction({ level: 4, cooldowns: {}, buffActive: false, ready: false, attackOnCooldown: true });
  assert.deepEqual(action, { kind: 'none' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: FAIL — `chooseAction` still expects/uses `comboState`, and the old "primed payoff" test cases no longer exist in this file so the removed behavior isn't tested (the remaining tests fail because `chooseAction` still prioritizes a `comboState`-primed payoff over the highest-unlocked-ready-ability path in ways that don't match the new expectations, e.g. it never falls into the "highest-unlocked ready" branch the same way without `comboState` present).

- [ ] **Step 3: Rewrite `chooseAction`**

Replace `scripts/simulateAbilityPolicy.js` in full with:

```js
import { getUnlockedAbilities } from '../js/systems/abilities.js';

/**
 * Decides what the simulated player does on one tick, in priority order:
 *   1. Super Scream, if unlocked/off cooldown/not already active - free and
 *      strictly beneficial, so a reasonable player always takes it.
 *   2. Otherwise, if the swing timer is ready, the highest-unlocked damage
 *      ability that's off cooldown.
 *   3. Otherwise, Attack - unless it's still on its own short cooldown, in
 *      which case there's nothing to do this tick.
 *
 * Post-ability-rotation-v2 (2026-09-02): no more combo-primer priority step -
 * every ability resolves independently now, there's no cross-ability
 * priming to model. Pure and side-effect-free on purpose: this is
 * unit-tested directly, kept in its own module so importing it never runs
 * simulate-balance.js's own unconditional report-printing `main()`.
 */
export function chooseAction({ level, cooldowns, buffActive, ready, attackOnCooldown }) {
  const unlocked = getUnlockedAbilities(level);
  const offCooldown = (id) => (cooldowns[id] || 0) <= 0;

  const superScream = unlocked.find((a) => a.type === 'buff');
  if (superScream && offCooldown(superScream.id) && !buffActive) {
    return { kind: 'ability', id: superScream.id };
  }

  if (ready) {
    const candidates = unlocked.filter((a) => a.type === 'damage' && offCooldown(a.id));
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => (b.unlockLevel > a.unlockLevel ? b : a));
      return { kind: 'ability', id: best.id };
    }
  }

  return attackOnCooldown ? { kind: 'none' } : { kind: 'attack' };
}
```

- [ ] **Step 4: Update `scripts/simulate-balance.js`**

Remove `comboState` and timing-hit modeling. Replace (search for `let comboState = {};` around line 385):

```js
  let comboState = {};
```

with nothing (delete the line).

Replace the ability-use branch (currently lines ~454-482):

```js
    if (action.kind === 'ability') {
      const ability = ABILITIES.find((a) => a.id === action.id);
      if (ability.type === 'buff') {
        buffState = activateBuff(ability);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        attackStreakIdleMs = 0;
      } else {
        const timingHit = ability.comboRole === 'setup' ? Math.random() < TIMING_HIT_RATE : false;
        const comboBonusActive = !!comboState[ability.id];
        const result = resolveAbilityUse(player, applyDefenseDebuff(monster, monster.defenseDebuff), ability, buffState.active, timingHit, comboBonusActive, Math.random, build.critChancePercent / 100);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        player.atb = result.playerAtb;
        applyOnHitEffects(build, player, monster, result.damage);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        attackStreakIdleMs = 0;
        comboState[ability.id] = false;
        if (ability.comboPartnerId && (ability.comboRole === 'payoff' || timingHit)) {
          comboState[ability.comboPartnerId] = true;
        }
        if (ability.defenseShredMultiplier) {
          monster.defenseDebuff = createDefenseDebuff(ability);
        }
        if (monster.hp <= 0) {
          return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
        }
      }
    } else if (action.kind === 'attack') {
```

with:

```js
    if (action.kind === 'ability') {
      const ability = ABILITIES.find((a) => a.id === action.id);
      if (ability.type === 'buff') {
        buffState = activateBuff(ability);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        attackStreakIdleMs = 0;
      } else {
        const result = resolveAbilityUse(player, applyDefenseDebuff(monster, monster.defenseDebuff), ability, buffState.active, Math.random, build.critChancePercent / 100);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        player.atb = result.playerAtb;
        applyOnHitEffects(build, player, monster, result.damage);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        attackStreakIdleMs = 0;
        // Lacerate's self-retrigger (js/systems/abilities.js's `retrigger`
        // field, id 'slash') is modeled the same stand-in way
        // TIMING_HIT_RATE already models human timing skill elsewhere in
        // this file: a reasonably-attentive simulated player always
        // attempts the re-press and lands it at the same rate.
        if (ability.retrigger && Math.random() < TIMING_HIT_RATE) {
          buffState = activateBuff({ buffDurationMs: ability.retrigger.buffDurationMs });
        }
        if (ability.defenseShredMultiplier) {
          monster.defenseDebuff = createDefenseDebuff(ability);
        }
        if (monster.hp <= 0) {
          return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
        }
      }
    } else if (action.kind === 'attack') {
```

Update the `chooseAction` call site (search `comboState,` inside the `chooseAction({...})` call around line 445-452) — remove the `comboState,` line from that object literal.

Update the module docstring's "What's modeled" bullet (search `Combo primer tracking and timing hits for setup abilities`, around line 322) to:

```
 *   - Ability rotation policy via chooseAction from simulateAbilityPolicy.js
 *   - Lacerate's self-retrigger buff (stand-in success rate, same as the old combo-timing model)
 *   - Buff state (duration, active/inactive)
```

And the comment above `TIMING_HIT_RATE` (search `Only setup abilities (Stab/`, around line 300-307):

```
// Stands in for a human's real input timing, since the simulator has no
// input timing to model - used both for the retrigger check above (see
// docs/superpowers/specs/2026-08-22-balance-pass-design.md for why 0.7 and
// what to re-check if results feel overly sensitive to it).
const TIMING_HIT_RATE = 0.7;
```

Since Sever's extra target and Faultline's widen buff only matter with 2+ monsters and this simulator is 1-on-1 only, no changes are needed for those mechanics here — `pickRandomOtherLivingIndices`-shaped logic never has anything to pick against a single `monster`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: PASS.

Run: `node scripts/simulate-balance.js` (smoke-check it still runs end-to-end without throwing)
Expected: prints its usual matchup report with no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/simulateAbilityPolicy.js scripts/simulate-balance.js tests/simulateAbilityPolicy.test.js
git commit -m "feat: update balance simulator for ability rotation v2's roster shape"
```

---

## Task 7: Full test-suite audit, changelog, and backlog cleanup

**Files:**
- Modify: `tests/battleScreenDom.test.js` (audit only, fix anything Tasks 2-5 missed)
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`
- Modify: `docs/superpowers/BACKLOG.md`
- Modify: `docs/superpowers/BACKLOG_SHIPPED.md`

**Interfaces:**
- Consumes: nothing new — this is verification and bookkeeping only.

- [ ] **Step 1: Run the full suite and fix any remaining stale references**

Run: `npm run test`

If anything besides the tests already touched by Tasks 1-6 fails, it's almost certainly one of these two categories — search and fix them:
- A test still importing/asserting on a removed export (`comboTimingHintUnlocked`, `TIMING_BONUS_MULTIPLIER`, `COMBO_PAYOFF_BONUS_MULTIPLIER`, `COMBO_RETURN_BONUS_MULTIPLIER`, `comboState`). Run `grep -rn "comboTimingHintUnlocked\|TIMING_BONUS_MULTIPLIER\|COMBO_PAYOFF_BONUS_MULTIPLIER\|COMBO_RETURN_BONUS_MULTIPLIER\|comboState" tests/ scripts/ js/` — every remaining hit needs its containing test/assertion removed (these concepts no longer exist).
- A test asserting on the old ability names ("Stab", "Chop", "Slash", "Sweep") in log-message or title-text assertions (not the `id`s, which are unchanged). Run `grep -n "'Stab'\|'Chop'\|'Slash'\|'Sweep'\|/Stab\|/Chop\|/Slash\|/Sweep" tests/battleScreenDom.test.js` and update matched strings to `Impale`/`Sever`/`Lacerate`/`Faultline`.

Expected after fixes: PASS, full suite green.

- [ ] **Step 2: Bump the version and write the CHANGELOG entry**

Check the current version at the top of `CHANGELOG.md`'s `## [Unreleased]`/latest dated section to confirm the next number. This is a completed feature/build (new systems replacing old ones), so it's a **MINOR** bump per `CHANGELOG.md`'s own versioning rules — e.g. if the latest shipped version is `0.18.1`, this becomes `0.19.0`.

Add to `CHANGELOG.md`, replacing `## [Unreleased]` with a new dated section above it (keep `## [Unreleased]` itself empty above the new section, per this repo's standing pattern):

```markdown
## [Unreleased]

## [0.19.0] - 2026-09-02

### Changed
- Rewrote the 4 damage abilities' rotation (`js/systems/abilities.js`,
  `js/screens/battleScreen.js`) around distinct roles instead of a flat
  power ramp, and renamed three of them: Stab → **Impale** (strong
  single-target hit), Chop → **Sever** (hits its target plus one random
  other living enemy, still fine 1-on-1), Slash → **Lacerate** (keeps its
  delayed bleed tick, and re-pressing it right after landing buffs the
  rest of your abilities for a while), Sweep → **Faultline** (icon
  🌪️ → 🪨; keeps its weak all-enemies hit and defense-shred, and now
  also widens what Impale/Sever/Lacerate can hit for 6s after use).
  Every ability now resolves instantly - the live wind-up timing meter
  and the old Stab→Chop/Slash→Sweep combo-priming system are both gone
  entirely, replaced by each ability's own mechanic above. Super Scream
  is unchanged. See `docs/superpowers/specs/2026-09-02-ability-rotation-
  v2-design.md` for the full design and
  `docs/superpowers/plans/2026-09-02-ability-rotation-v2.md` for the
  implementation.
- `scripts/simulate-balance.js`/`scripts/simulateAbilityPolicy.js`
  updated to match: no more combo-primer priority in the simulated
  player's action policy, Lacerate's retrigger buff modeled with the
  same stand-in timing-skill rate the old combo system used.
```

- [ ] **Step 3: Write the player-facing changelog entry**

Add to `js/data/playerChangelog.js`, at the top of `PLAYER_CHANGELOG` (before the current first entry):

```js
  {
    version: '0.19.0',
    date: '2026-09-02',
    highlights: [
      'Changed: your 4 combat abilities got new names and new jobs. Impale (was Stab) is your strong single hit. Sever (was Chop) always hits your target plus one random enemy beside it. Lacerate (was Slash) keeps its bleed - press it again right after landing for a damage buff. Faultline (was Sweep) is a weak hit on every enemy that also widens what your other 3 abilities can hit for a few seconds.',
      'Changed: every ability now hits instantly - no more timing-meter bar to wait through or watch for a green zone.',
    ],
  },
```

- [ ] **Step 4: Run the version-sync test**

Run: `node --test tests/versionSync.test.js`
Expected: PASS (the newest `CHANGELOG.md` version and `PLAYER_CHANGELOG[0].version` now match).

- [ ] **Step 5: Move the backlog entry to shipped**

In `docs/superpowers/BACKLOG.md`, find the "Ability rotation v2" entry (in the Combat pass ideas section, and its Index-section pointer near the top) and remove both — replace with nothing (or, if the Index section still needs a line for hygiene, a one-line pointer to `BACKLOG_SHIPPED.md`).

In `docs/superpowers/BACKLOG_SHIPPED.md`, add an entry (matching this file's existing `### ~~Title~~ Shipped YYYY-MM-DD (version)` style) summarizing what shipped, with a pointer to the design doc and this plan.

- [ ] **Step 6: Run the full suite one last time**

Run: `npm run test`
Expected: PASS, full suite green (this repo's CI will re-run this on push and fails the deploy if the CHANGELOG entry step above was somehow missed).

- [ ] **Step 7: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js docs/superpowers/BACKLOG.md docs/superpowers/BACKLOG_SHIPPED.md tests/battleScreenDom.test.js
git commit -m "feat: ability rotation v2 - version bump, changelog, backlog cleanup (0.19.0)"
```

(If Step 1 required fixes to `tests/battleScreenDom.test.js` beyond what's already staged from earlier tasks, they're included in this same commit since they're part of making the full suite pass before shipping.)
