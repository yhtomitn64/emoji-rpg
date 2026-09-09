# Ability Global-Cooldown Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the player ATB "swing timer" gate on abilities 1-4
(Impale/Sever/Lacerate/Faultline), replacing it with a shared,
speed-scaled global cooldown that reuses the existing per-ability
cooldown state and UI.

**Architecture:** A new pure function (`abilityGcdMsForSpeed`) computes the
GCD duration from player speed. A second pure function
(`applyAbilityGcd`) propagates that duration to every unlocked non-buff
ability's existing cooldown state whenever any one of them is used,
letting an ability's own (currently-unused) `overrideCooldownMs` act as a
floor for itself. The player's ATB gauge (`playerCombatant.atb`,
`ATB_MAX`, `tickGauge`, `isReady`) is then fully removed from the player
side of `battleScreen.js` — monsters keep their own, untouched. The
balance simulator (`scripts/simulate-balance.js` +
`scripts/simulateAbilityPolicy.js`) gets a mirrored update so its win-rate
numbers reflect the new mechanic before any retuning decision is made.

**Tech Stack:** Vanilla JS (ES modules), Node's built-in `node:test` +
`node:assert/strict` test runner, jsdom-based DOM tests
(`tests/helpers/dom.js`).

**Spec:** `docs/superpowers/specs/2026-09-03-ability-gcd-rework-design.md`

## Global Constraints

- Attack's existing spam-decay system (`attackStreakMultiplier`,
  `attackCooldownMsForStreak`, the damage floor) is completely unchanged
  and does not interact with the ability GCD in either direction.
- Monsters' own ATB/windup timing is completely unchanged.
- Super Scream (buff-type ability, bound to Space) stays exempt from the
  GCD propagation entirely, same as it's exempt from cooldown-sharing
  today.
- Lacerate's retrigger sweet-spot mechanic is unaffected — it layers on
  top of whatever Lacerate's own cooldown ends up being.
- Parry's timing minigame is unaffected.
- `npm run test` must stay green after every task.
- Starting GCD formula: `ABILITY_GCD_BASE_MS = 1150`,
  `ABILITY_GCD_MS_PER_SPEED = 30`, `ABILITY_GCD_FLOOR_MS = 500` (exactly
  1000ms at the player's starting speed of 5) — a starting point to be
  confirmed or adjusted by Task 12's balance comparison, not final.
- All 4 abilities start with no `overrideCooldownMs` (bare GCD only) —
  don't add per-ability overrides preemptively.

---

## Task 1: Capture a baseline balance report

No code changes — this is the "before" snapshot Task 12 diffs against.

- [ ] **Step 1: Run the balance simulator at its default trial count and save the output**

Run: `node scripts/simulate-balance.js | tee /tmp/balance-baseline-before-gcd.txt`

- [ ] **Step 2: Copy the saved report somewhere durable**

The `/tmp` copy won't survive a reboot. Copy it into the plan's own
working notes so Task 12 can find it even in a fresh session:

Run: `mkdir -p docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes && cp /tmp/balance-baseline-before-gcd.txt docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes/balance-baseline-before-gcd.txt`

- [ ] **Step 3: Commit the baseline**

```bash
git add docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes/balance-baseline-before-gcd.txt
git commit -m "$(cat <<'EOF'
docs: capture pre-rework balance baseline for ability GCD comparison [skip ci]
EOF
)"
```

---

## Task 2: `abilityGcdMsForSpeed` in combat.js

**Files:**
- Modify: `js/systems/combat.js` (add after `attackFalloffJustTriggered`, near the end of the file's cooldown-related exports)
- Test: `tests/combat.test.js`

**Interfaces:**
- Produces: `ABILITY_GCD_BASE_MS`, `ABILITY_GCD_MS_PER_SPEED`,
  `ABILITY_GCD_FLOOR_MS` (exported constants), `abilityGcdMsForSpeed(speed)
  → number` (pure function). Task 5/11 call this.

- [ ] **Step 1: Write the failing tests**

Add to `tests/combat.test.js`, in the import line at the top add
`ABILITY_GCD_BASE_MS, ABILITY_GCD_MS_PER_SPEED, ABILITY_GCD_FLOOR_MS,
abilityGcdMsForSpeed` to the existing `from '../js/systems/combat.js'`
import, then append at the end of the file:

```js
test('abilityGcdMsForSpeed is exactly 1000ms at the player\'s starting speed of 5', () => {
  assert.equal(abilityGcdMsForSpeed(5), 1000);
});

test('abilityGcdMsForSpeed decreases as speed increases', () => {
  assert.ok(abilityGcdMsForSpeed(10) < abilityGcdMsForSpeed(5));
});

test('abilityGcdMsForSpeed never drops below the floor, however high speed goes', () => {
  assert.equal(abilityGcdMsForSpeed(1000), ABILITY_GCD_FLOOR_MS);
});

test('abilityGcdMsForSpeed matches the base/per-speed/floor formula directly', () => {
  assert.equal(abilityGcdMsForSpeed(0), ABILITY_GCD_BASE_MS);
  assert.equal(abilityGcdMsForSpeed(20), Math.max(ABILITY_GCD_FLOOR_MS, ABILITY_GCD_BASE_MS - 20 * ABILITY_GCD_MS_PER_SPEED));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/combat.test.js`
Expected: FAIL — `SyntaxError: ... does not provide an export named 'abilityGcdMsForSpeed'` (or similar for the constants), since none of it exists yet.

- [ ] **Step 3: Implement**

Add to `js/systems/combat.js`, after the existing
`attackFalloffJustTriggered` function:

```js
// Speed-scaled shared cooldown for abilities 1-4 (Impale/Sever/Lacerate/
// Faultline), replacing the player ATB "swing timer" gate those abilities
// used to wait on - see docs/superpowers/specs/2026-09-03-ability-gcd-
// rework-design.md. Starting values give exactly 1000ms at the player's
// starting speed of 5, floored at 500ms around speed 22 (just past
// SPEED_DAMAGE_BONUS_THRESHOLD) - a starting point for the balance pass
// in that same spec's workflow section, not a final tuning.
export const ABILITY_GCD_BASE_MS = 1150;
export const ABILITY_GCD_MS_PER_SPEED = 30;
export const ABILITY_GCD_FLOOR_MS = 500;

export function abilityGcdMsForSpeed(speed) {
  return Math.max(ABILITY_GCD_FLOOR_MS, ABILITY_GCD_BASE_MS - speed * ABILITY_GCD_MS_PER_SPEED);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/combat.test.js`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add js/systems/combat.js tests/combat.test.js
git commit -m "$(cat <<'EOF'
feat: add abilityGcdMsForSpeed, the speed-scaled ability GCD formula

First piece of the ability global-cooldown rework - see
docs/superpowers/specs/2026-09-03-ability-gcd-rework-design.md. Not
wired into battleScreen.js yet.
EOF
)"
```

---

## Task 3: `applyAbilityGcd` in abilities.js

**Files:**
- Modify: `js/systems/abilities.js` (add after `getUnlockedAbilities`)
- Test: `tests/abilities.test.js`

**Interfaces:**
- Consumes: nothing new (uses plain objects/arrays).
- Produces: `applyAbilityGcd(cooldowns, unlockedAbilities, usedAbilityId, gcdMs, totals = {}) → { cooldowns, totals }`. Task 5/11 call this.

- [ ] **Step 1: Write the failing tests**

Add `applyAbilityGcd` to the existing `from '../js/systems/abilities.js'`
import in `tests/abilities.test.js`, then append:

```js
test('applyAbilityGcd puts every unlocked non-buff ability on the GCD, not just the one used', () => {
  const unlocked = ABILITIES.filter((a) => ['stab', 'chop', 'slash', 'sweep'].includes(a.id));
  const { cooldowns } = applyAbilityGcd({}, unlocked, 'stab', 1000);
  assert.equal(cooldowns.stab, 1000);
  assert.equal(cooldowns.chop, 1000);
  assert.equal(cooldowns.slash, 1000);
  assert.equal(cooldowns.sweep, 1000);
});

test('applyAbilityGcd leaves Super Scream (a buff-type ability) untouched', () => {
  const unlocked = ABILITIES; // includes superScream at level 10
  const { cooldowns } = applyAbilityGcd({}, unlocked, 'stab', 1000);
  assert.equal('superScream' in cooldowns, false);
});

test('applyAbilityGcd never shortens an ability that already has a longer remaining cooldown', () => {
  const unlocked = ABILITIES.filter((a) => ['stab', 'chop'].includes(a.id));
  const { cooldowns } = applyAbilityGcd({ chop: 5000 }, unlocked, 'stab', 1000);
  assert.equal(cooldowns.chop, 5000, 'chop already had 5000ms remaining from an earlier use - a fresh 1000ms GCD must not shorten it');
  assert.equal(cooldowns.stab, 1000);
});

test('applyAbilityGcd lets the used ability\'s own overrideCooldownMs raise its cooldown above the bare GCD', () => {
  const longAbility = { id: 'sweep', type: 'damage', overrideCooldownMs: 6000 };
  const shortAbility = { id: 'stab', type: 'damage' };
  const { cooldowns } = applyAbilityGcd({}, [longAbility, shortAbility], 'sweep', 1000);
  assert.equal(cooldowns.sweep, 6000, 'sweep has its own overrideCooldownMs of 6000, longer than the 1000ms GCD');
  assert.equal(cooldowns.stab, 1000, 'stab is not the used ability, so it only gets the bare GCD even though sweep has a longer override');
});

test('applyAbilityGcd tracks the applied duration in totals, in lockstep with cooldowns, for cooldown-percentage display', () => {
  const unlocked = ABILITIES.filter((a) => ['stab', 'chop'].includes(a.id));
  const { cooldowns, totals } = applyAbilityGcd({}, unlocked, 'stab', 1000);
  assert.equal(totals.stab, 1000);
  assert.equal(totals.chop, 1000);
  assert.equal(cooldowns.stab, totals.stab);
});

test('applyAbilityGcd does not overwrite totals when it does not overwrite cooldowns (the not-shortened case)', () => {
  const unlocked = ABILITIES.filter((a) => ['stab', 'chop'].includes(a.id));
  const { totals } = applyAbilityGcd({ chop: 5000 }, unlocked, 'stab', 1000, { chop: 5000 });
  assert.equal(totals.chop, 5000, 'chop\'s cooldown was not touched (still has 5000ms remaining from its own longer application), so its total must stay 5000 too - otherwise the percentage math would use the wrong denominator');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `applyAbilityGcd is not a function` (or similar), since it doesn't exist yet.

- [ ] **Step 3: Implement**

Add to `js/systems/abilities.js`, after `getUnlockedAbilities`:

```js
// Reuses the existing per-ability cooldown state (abilityCooldowns in
// js/screens/battleScreen.js / scripts/simulate-balance.js) as the shared
// global cooldown mechanism, rather than introducing a separate timer -
// see docs/superpowers/specs/2026-09-03-ability-gcd-rework-design.md's
// "Mechanism" section. `totals` is a parallel map of the duration that was
// actually applied to each ability's most recent cooldown (mirrors
// battleScreen.js's existing attackCooldownMs/attackCooldownTotalMs
// pattern) - needed because cooldownPct can no longer divide by a fixed
// per-ability config value once the applied duration varies per use.
export function applyAbilityGcd(cooldowns, unlockedAbilities, usedAbilityId, gcdMs, totals = {}) {
  const nextCooldowns = { ...cooldowns };
  const nextTotals = { ...totals };
  for (const ability of unlockedAbilities) {
    if (ability.type === 'buff') continue; // Super Scream stays independent
    const floor = ability.id === usedAbilityId ? (ability.overrideCooldownMs || 0) : 0;
    const target = Math.max(gcdMs, floor);
    if (target > (nextCooldowns[ability.id] || 0)) {
      nextCooldowns[ability.id] = target;
      nextTotals[ability.id] = target;
    }
  }
  return { cooldowns: nextCooldowns, totals: nextTotals };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/abilities.test.js`
Expected: PASS, all tests including the 6 new ones.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "$(cat <<'EOF'
feat: add applyAbilityGcd, propagating the shared ability GCD

Second piece of the ability global-cooldown rework - reuses the
existing per-ability cooldown field/UI instead of a new timer. Not
wired into battleScreen.js yet.
EOF
)"
```

---

## Task 4: Simplify `canUseAbility` (drop `ready`/`alwaysReady`)

**Files:**
- Modify: `js/systems/abilities.js:48-55` (the existing `canUseAbility` function)
- Test: `tests/abilities.test.js`

**Interfaces:**
- Produces: `canUseAbility({ locked, onCooldown, retriggerWindowOpen }) → boolean` (signature shrinks by 2 params). Task 6 updates all 3 call sites in `battleScreen.js`.

Current implementation (for reference — this is what's being replaced):

```js
export function canUseAbility({ locked, onCooldown, ready, alwaysReady, retriggerWindowOpen }) {
  if (locked) return false;
  // Lacerate's own self-retrigger window (see js/screens/battleScreen.js)
  // makes its button clickable again despite still being on cooldown - a
  // deliberately different input than a normal reuse.
  if (retriggerWindowOpen) return true;
  return !onCooldown && !!(ready || alwaysReady);
}
```

- [ ] **Step 1: Replace the existing `canUseAbility` tests with the new-signature versions**

In `tests/abilities.test.js`, replace this block:

```js
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
```

with:

```js
test('canUseAbility is true when unlocked and off cooldown', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: false }), true);
});

test('canUseAbility is false when on cooldown and no retrigger window is open', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: true }), false);
});

test('canUseAbility is true on cooldown when a retrigger window is open for this ability', () => {
  assert.equal(canUseAbility({ locked: false, onCooldown: true, retriggerWindowOpen: true }), true);
});

test('canUseAbility is false when locked, even with a retrigger window open', () => {
  assert.equal(canUseAbility({ locked: true, onCooldown: false, retriggerWindowOpen: true }), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — `canUseAbility is true when unlocked and off cooldown` and the retrigger test fail (old implementation returns `false` for both, since `ready`/`alwaysReady` are `undefined` → falsy). The "false when locked" and "false when on cooldown" tests still pass against the old code (harmless overlap, not a problem).

- [ ] **Step 3: Implement**

In `js/systems/abilities.js`, replace `canUseAbility`:

```js
export function canUseAbility({ locked, onCooldown, retriggerWindowOpen }) {
  if (locked) return false;
  // Lacerate's own self-retrigger window (see js/screens/battleScreen.js)
  // makes its button clickable again despite still being on cooldown - a
  // deliberately different input than a normal reuse.
  if (retriggerWindowOpen) return true;
  return !onCooldown;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/abilities.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "$(cat <<'EOF'
refactor: simplify canUseAbility - drop ready/alwaysReady params

Both become meaningless once the player ATB gauge goes away (part of
the ability GCD rework) - cooldown state is now the only gate, same
as it already was for Attack. battleScreen.js call sites still pass
the old params here (harmless, just ignored) - updated in the next
task.
EOF
)"
```

---

## Task 5: Wire `applyAbilityGcd` into `playerUseAbility`, fix cooldown-percentage tracking, clean up dead `cooldownMs` data

**Files:**
- Modify: `js/screens/battleScreen.js` (imports, module state, `playerUseAbility`, `abilityButtonEntries`, `mount`)
- Modify: `js/systems/abilities.js` (`ABILITIES` — drop `cooldownMs` from the 4 digit abilities, it's dead once this task lands)
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `abilityGcdMsForSpeed` (combat.js, Task 2), `applyAbilityGcd` (abilities.js, Task 3).
- Produces: module-scope `abilityCooldownTotals` map, used by `abilityButtonEntries()`'s `cooldownPct` calc.

- [ ] **Step 1: Write the failing tests**

Add to `tests/battleScreenDom.test.js`, right after the existing Lacerate
retrigger tests (search for `'landing the re-press while Super Scream\'s
buff is already active refreshes it instead of stacking'` — add after
that block, still inside the `test('battleScreen DOM', ...)` block):

```js
  await t.test('using one ability puts every other unlocked ability on cooldown too (the shared GCD)', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    // Level 8 unlocks stab(1)/chop(2)/slash(3)/sweep(4).
    click(root.querySelector('#btn-ability-stab'));
    assert.equal(root.querySelector('#btn-ability-chop').disabled, true, 'chop should be on the shared GCD too, even though it was never pressed');
    assert.equal(root.querySelector('#btn-ability-sweep').disabled, true, 'sweep should be on the shared GCD too');
  });

  await t.test('the shared GCD does not touch Super Scream (a buff-type ability)', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 10 } }) });
    click(root.querySelector('#btn-ability-stab'));
    assert.equal(root.querySelector('#btn-ability-superScream').disabled, false, 'Super Scream is not part of the shared GCD propagation');
  });

  await t.test('every ability button\'s cooldown-wipe percentage divides by the duration that actually applied, not a stale config value', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    click(root.querySelector('#btn-ability-stab'));
    const chopWipe = root.querySelector('#btn-ability-chop .battle-ability-cooldown-wipe');
    assert.ok(chopWipe, 'chop should show a cooldown-wipe animation from the shared GCD');
    const pct = Number(chopWipe.style.getPropertyValue('--pct'));
    assert.ok(pct > 90 && pct <= 100, `expected a fresh cooldown to read near 100%, got ${pct}`);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL on all 3 new tests — today, using `stab` only sets
`abilityCooldowns.stab`, so `chop`/`sweep`/`superScream` stay off
cooldown and `chop`'s cooldown-wipe element doesn't exist at all (button
not disabled).

- [ ] **Step 3: Wire it in**

In `js/screens/battleScreen.js`, add `abilityGcdMsForSpeed` to the
existing `from '../systems/combat.js'` import, and `applyAbilityGcd` to
the existing `from '../systems/abilities.js'` import.

Add a new module-scope variable next to the existing declaration:

```js
let abilityCooldowns = {};
```
becomes:
```js
let abilityCooldowns = {};
let abilityCooldownTotals = {};
```

In `mount()`, find:
```js
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
```
and add right after it:
```js
  abilityCooldownTotals = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
```

In `playerUseAbility`, find:
```js
    const ability = ABILITIES.find((a) => a.id === abilityId);
    logEvent('ability_used', { abilityId, inBattle: true, ngPlusCycle: state.ngPlusCycle });
    if (ability.type === 'buff') {
```
and change to:
```js
    const ability = ABILITIES.find((a) => a.id === abilityId);
    logEvent('ability_used', { abilityId, inBattle: true, ngPlusCycle: state.ngPlusCycle });
    const gcdMs = abilityGcdMsForSpeed(playerCombatant.speed);
    if (ability.type === 'buff') {
```

Still in `playerUseAbility`, in the AOE branch, find:
```js
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      attackStreak = 0;
```
and change to:
```js
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      ({ cooldowns: abilityCooldowns, totals: abilityCooldownTotals } = applyAbilityGcd(abilityCooldowns, getUnlockedAbilities(state.player.level), abilityId, gcdMs, abilityCooldownTotals));
      attackStreak = 0;
```

Then in the single/multi-target branch (further down, non-AOE), find:
```js
    maybeMarkSplitDeath(target, result);
    abilityCooldowns[abilityId] = ability.cooldownMs;
    attackStreak = 0;
```
and change to:
```js
    maybeMarkSplitDeath(target, result);
    ({ cooldowns: abilityCooldowns, totals: abilityCooldownTotals } = applyAbilityGcd(abilityCooldowns, getUnlockedAbilities(state.player.level), abilityId, gcdMs, abilityCooldownTotals));
    attackStreak = 0;
```

Leave the buff branch (`abilityCooldowns[abilityId] = ability.cooldownMs;`
right after `buffState = activateBuff(ability);`) completely untouched —
Super Scream keeps its own fixed cooldown, unaffected by the GCD.

In `abilityButtonEntries()`, find:
```js
    const cooldownActive = cooldownRemaining > 0;
    const cooldownPct = cooldownActive ? (cooldownRemaining / ability.cooldownMs) * 100 : 0;
```
and change to:
```js
    const cooldownActive = cooldownRemaining > 0;
    const cooldownPct = cooldownActive ? (cooldownRemaining / (abilityCooldownTotals[ability.id] || ability.cooldownMs)) * 100 : 0;
```

(The `|| ability.cooldownMs` fallback keeps Super Scream's percentage
working exactly as before, since its cooldown is never routed through
`abilityCooldownTotals`.)

In `js/systems/abilities.js`, in the `ABILITIES` array, remove the now-dead
`cooldownMs` field from the 4 digit abilities (Super Scream keeps its
`cooldownMs: 30000` — untouched):

```js
  {
    id: 'stab', name: 'Impale', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.8, cooldownMs: 4000,
    description: 'a strong, precise single-target thrust',
  },
```
becomes:
```js
  {
    id: 'stab', name: 'Impale', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.8,
    description: 'a strong, precise single-target thrust',
  },
```

Apply the same removal (`cooldownMs: 10000,` / `cooldownMs: 6000,` /
`cooldownMs: 12000,` — each on its own line) to the `chop`, `slash`, and
`sweep` entries. Leave `superScream`'s `cooldownMs: 30000` alone.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS, all tests including the 3 new ones. Also run
`node --test tests/abilities.test.js` and `node --test
tests/simulateAbilityPolicy.test.js` to confirm nothing else broke from
the `ABILITIES` data change — `simulateAbilityPolicy.test.js` doesn't
read `cooldownMs` directly so it should already pass.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js js/systems/abilities.js tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
feat: wire the shared ability GCD into playerUseAbility

Using any of Impale/Sever/Lacerate/Faultline now puts every other
unlocked one on the same speed-scaled cooldown too, not just the one
pressed - the actual GCD behavior. Fixes the cooldown-wipe percentage
to divide by the duration that was actually applied
(abilityCooldownTotals) instead of a now-removed static per-ability
config value. Abilities are still also gated on the old player ATB
gauge at this point (unchanged, removed in the next task) - this is a
deliberately redundant intermediate state, not a bug.
EOF
)"
```

---

## Task 6: Drop `ready`/`isReady` from ability-gating call sites

**Files:**
- Modify: `js/screens/battleScreen.js` (`abilityButtonEntries`, `handleKeydown`'s Space and digit-key branches)
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Consumes: `canUseAbility` (Task 4's simplified signature).

- [ ] **Step 1: Write the failing test**

Add to `tests/battleScreenDom.test.js`, right after the 3 tests Task 5 added:

```js
  await t.test('an ability can be used the instant it comes off cooldown, with no extra wait for a swing timer to refill', async () => {
    const { root, state } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 2, speed: 1 } }) });
    // speed: 1 deliberately kept low - under the old ATB gauge this would
    // make readiness take a long time to refill. If the ability still
    // fires the instant it's mounted (cooldowns start at 0), the swing
    // timer is confirmed gone, not just fast.
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-ability-stab'));
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — with `speed: 1`, `playerCombatant.atb` starts at 0 and
`isReady` never returns true within the test's synchronous click, so the
ability button is disabled and the click is a no-op (HP unchanged).

- [ ] **Step 3: Implement**

In `abilityButtonEntries()`, find:
```js
function abilityButtonEntries() {
  const ready = isReady(playerCombatant.atb);
  const target = monsterCombatants[selectedMonsterIndex];
```
and change to:
```js
function abilityButtonEntries() {
  const target = monsterCombatants[selectedMonsterIndex];
```

A few lines down in the same function, find:
```js
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, ready, alwaysReady, retriggerWindowOpen });
```
and change to:
```js
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, retriggerWindowOpen });
```

(`alwaysReady` stays declared and used elsewhere in this same function for
`keyLabel`/`keyDisplay` — only its use inside the `canUseAbility(...)`
call is removed.)

In `handleKeydown`, find the Space branch:
```js
  if (event.code === 'Space') {
    // Super Scream lives on Space instead of a digit key, and unlike every
    // other ability it's exempt from the swing-timer-ready gate entirely -
    // see canUseAbility's alwaysReady param. The existing abilityActionInFlight
    // guard inside playerUseAbility already keeps this safe if Space is
    // pressed while another ability's resolution is still in flight: that
    // call just no-ops.
    event.preventDefault();
    const superScream = ABILITIES.find((a) => a.id === 'superScream');
    const locked = state.player.level < superScream.unlockLevel;
    const onCooldown = (abilityCooldowns[superScream.id] || 0) > 0;
    if (canUseAbility({ locked, onCooldown, ready: isReady(playerCombatant.atb), alwaysReady: true })) {
      playerUseAbility(superScream.id);
    }
    return;
  }
```
and change to:
```js
  if (event.code === 'Space') {
    // Super Scream lives on Space instead of a digit key. The existing
    // abilityActionInFlight guard inside playerUseAbility already keeps
    // this safe if Space is pressed while another ability's resolution is
    // still in flight: that call just no-ops.
    event.preventDefault();
    const superScream = ABILITIES.find((a) => a.id === 'superScream');
    const locked = state.player.level < superScream.unlockLevel;
    const onCooldown = (abilityCooldowns[superScream.id] || 0) > 0;
    if (canUseAbility({ locked, onCooldown })) {
      playerUseAbility(superScream.id);
    }
    return;
  }
```

Further down in the same function, find:
```js
  } else if (key >= '1' && key <= '4') {
    const ability = getUnlockedAbilities(state.player.level)[Number(key) - 1];
    if (!ability) return;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    const retriggerWindowOpen = ability.id === 'slash' && lacerateRetriggerOpen;
    if (canUseAbility({ locked: false, onCooldown, ready: isReady(playerCombatant.atb), retriggerWindowOpen })) {
      playerUseAbility(ability.id);
    }
  }
```
and change to:
```js
  } else if (key >= '1' && key <= '4') {
    const ability = getUnlockedAbilities(state.player.level)[Number(key) - 1];
    if (!ability) return;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    const retriggerWindowOpen = ability.id === 'slash' && lacerateRetriggerOpen;
    if (canUseAbility({ locked: false, onCooldown, retriggerWindowOpen })) {
      playerUseAbility(ability.id);
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
feat: abilities 1-4 and Super Scream stop waiting on the player ATB gauge

Cooldown state (now GCD-aware, see the previous commit) is the only
gate left, same as Attack already works. playerCombatant.atb/ATB_MAX/
tickGauge/isReady are still read/written elsewhere in this file for
now (the dead ATB bar UI, Flee's own gate) - removed in the next two
tasks.
EOF
)"
```

---

## Task 7: Remove the player ATB gauge entirely

**Files:**
- Modify: `js/screens/battleScreen.js` (template, `elements` map, `buildPlayerCombatant`, `updateAtbBars`, `tick`, every `playerCombatant.atb` read/write site)
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Nothing produced for later tasks — this is cleanup of now-dead state
  and UI, safe once Task 6 landed (nothing reads `playerCombatant.atb`
  for gating purposes anymore).

- [ ] **Step 1: Write the failing test**

Add to `tests/battleScreenDom.test.js`, right after the test Task 6 added:

```js
  await t.test('the player no longer has an ATB gauge bar - only monsters do', async () => {
    const { root } = await mountBattle(['boar']);
    assert.equal(root.querySelector('#battle-hero-atb-fill'), null);
    assert.ok(root.querySelector('[id^="battle-monster-atb-fill-"]'), 'monster ATB bars should still exist, untouched');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — `#battle-hero-atb-fill` still exists in the template today.

- [ ] **Step 3: Implement**

In `buildDom()`'s template string, find:
```js
              <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
              <div class="battle-hp-text" id="battle-hero-hp-text"></div>
              <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-hero-atb-fill"></div></div>
              <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
```
and change to:
```js
              <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
              <div class="battle-hp-text" id="battle-hero-hp-text"></div>
              <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
```

In the `elements = {...}` object built right after, remove this line:
```js
    heroAtbFill: document.getElementById('battle-hero-atb-fill'),
```

In `buildPlayerCombatant`, find:
```js
    speed: state.player.speed + bonuses.speed,
    atb: 0,
  };
}
```
and change to:
```js
    speed: state.player.speed + bonuses.speed,
  };
}
```

In `updateAtbBars()`, remove the last line of the function:
```js
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}
```
becomes (removing just that one line, the closing brace stays):
```js
}
```

In `tick()`, remove this line and update the comment right after it that
refers to "that gauge above":
```js
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  // Attack's decayed streak only resets passively after a sustained
  // real-time idle stretch with no Attack presses (ATTACK_STREAK_RECOVERY_MS) -
  // deliberately slow, and deliberately decoupled from the ATB gauge above:
  // that gauge caps at ATB_MAX and abilities read the same value for their
  // own readiness, so it can't be pushed further to represent a slower
  // recharge on its own. Landing an ability still resets the streak
  // instantly (elsewhere in this file) - only the "just wait it out" path
  // is slow.
```
becomes:
```js
  // Attack's decayed streak only resets passively after a sustained
  // real-time idle stretch with no Attack presses (ATTACK_STREAK_RECOVERY_MS) -
  // deliberately slow on purpose. Landing an ability still resets the
  // streak instantly (elsewhere in this file) - only the "just wait it
  // out" path is slow.
```

Remove every remaining `playerCombatant.atb = result.playerAtb;` line
(there are 4 left — inside `resolveOneAttack`, the AOE ability branch in
`playerUseAbility`, the single-target branch in `playerUseAbility`, and
`monsterAttack(monster)`, which applies a monster's own attack result back
onto the player). Search the file for the literal string
`playerCombatant.atb = result.playerAtb;` and delete each occurrence (just
the one line each time — nothing else on those lines).

Also remove the one remaining assignment inside `playerFlee()`'s
boss-block branch:
```js
    log.push('You cannot flee from this battle!');
    playerCombatant.atb = 0;
    updateAtbBars();
```
becomes:
```js
    log.push('You cannot flee from this battle!');
    updateAtbBars();
```

Finally, remove `tickGauge` and `isReady` from the `from
'../systems/combat.js'` import at the top of the file if nothing else in
`battleScreen.js` uses them — check first: `isReady(mc.atb)` (monster
windup check, in `tick()`) still needs `isReady`, so **keep `isReady`**
imported. `tickGauge` is still needed for `mc.atb =
tickGauge(mc.atb, mc.speed, 1);` (monster tick) too, so **keep
`tickGauge`** imported as well. `ATB_MAX` is still needed by
`updateAtbBars()`'s monster-half (`percent(mc.atb, ATB_MAX)`), so **keep
`ATB_MAX`** too. Nothing to remove from the import line — this step is a
no-op, included so the check isn't skipped.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS, all tests including the new one. Also run `npm run test`
for the full suite, since removing `playerCombatant.atb` touches several
functions other tests exercise indirectly (Attack, ability use, Flee,
monster attacks).

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
refactor: remove the player ATB gauge entirely

playerCombatant.atb stopped gating anything once abilities/Attack
moved off it - removes the dead state, its UI bar, and every
now-pointless read/write. Monster ATB (tickGauge/isReady/ATB_MAX) is
completely untouched, still driving their own windup/attack timing.
EOF
)"
```

---

## Task 8: Flee becomes always available

**Files:**
- Modify: `js/screens/battleScreen.js` (`updateMenu`, `handleKeydown`)
- Test: `tests/battleScreenDom.test.js`

**Interfaces:**
- Nothing produced for later tasks.

- [ ] **Step 1: Write the failing test**

Add to `tests/battleScreenDom.test.js`, right after the test Task 7 added:

```js
  await t.test('Flee is available instantly at the start of battle, with no wait', async () => {
    const { root } = await mountBattle(['boar']);
    assert.equal(root.querySelector('#btn-flee').disabled, false);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/battleScreenDom.test.js`
Expected: FAIL — today, `updateMenu()`'s `const ready =
isReady(playerCombatant.atb);` is `false` at the very start of a fresh
battle (the gauge starts at 0), so Flee's button renders `disabled: true`.

- [ ] **Step 3: Implement**

In `updateMenu()`, find:
```js
  if (battleOver) return;
  const ready = isReady(playerCombatant.atb);
```
and change to:
```js
  if (battleOver) return;
```

A bit further down, find:
```js
    ${actionButtonHtml({
      id: 'btn-flee',
      icon: '🏃',
      key: 'f',
      title: 'Flee (f) — retreat from the fight instantly; always works except against bosses',
      disabled: !ready,
    })}
```
and change to:
```js
    ${actionButtonHtml({
      id: 'btn-flee',
      icon: '🏃',
      key: 'f',
      title: 'Flee (f) — retreat from the fight instantly; always works except against bosses',
    })}
```

In `handleKeydown`, find:
```js
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
    if (!isReady(playerCombatant.atb)) return;
    playerFlee();
```
and change to:
```js
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
    playerFlee();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
fix: Flee is instantly available, matching its own tooltip's claim

It was gated on the player ATB gauge before (contradicting its own
"retreat instantly" tooltip) - nothing meaningful left to gate it on
once that gauge is gone, so it's unconditionally available now,
same as it already claimed to be.
EOF
)"
```

---

## Task 9: Update the one test that worked around the old ATB-fill wait

**Files:**
- Modify: `tests/battleScreenDom.test.js`

- [ ] **Step 1: Find and read the current test**

Search `tests/battleScreenDom.test.js` for `the "3" key also lands the
re-press during Lacerate's window`. It currently reads:

```js
  await t.test('the "3" key also lands the re-press during Lacerate\'s window, not just clicking its button', async () => {
    // speed: 999 is a test-only override, not part of the brief's literal
    // setup - see the comment just below for why it's needed. Unrelated to
    // retrigger mechanics themselves.
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6, speed: 999 } }) });
    // Level 6 unlocks stab(1)/chop(2)/slash(3) - Lacerate is slot 3.
    // Unlike click() (a plain .onclick handler with no readiness gate - a
    // pre-existing jsdom quirk the click-based ability tests elsewhere in
    // this file already lean on, confirmed: dispatching a synthetic click
    // on a genuinely `disabled` button still fires its handler here),
    // handleKeydown's digit-key branch explicitly requires
    // isReady(playerCombatant.atb) before calling playerUseAbility. ATB
    // starts at 0 at mount and only fills at `speed` per 300ms tick, so the
    // very first "3" press needs at least one real tick to land - bump
    // speed so a single tick is enough and wait past it first. This is
    // about the ability landing at all, not about the retrigger window.
    await new Promise((resolve) => setTimeout(resolve, 350));
    keydown('3');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    keydown('3');
    assert.match(root.querySelector('#battle-buff-indicator').textContent, /Buffed/);
  });
```

This test is expected to be **passing right now** (the `speed: 999` +
initial 350ms wait were a workaround for the old ATB gate Task 6 already
removed, so this test has been incidentally still working — the extra
wait is just now-unnecessary padding, not a failure). No RED step for
this task: it's a simplification of already-passing test setup, not new
behavior. Verify that first:

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS (including this test, as-is).

- [ ] **Step 2: Simplify it**

Replace the whole test with:

```js
  await t.test('the "3" key also lands the re-press during Lacerate\'s window, not just clicking its button', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 6 } }) });
    // Level 6 unlocks stab(1)/chop(2)/slash(3) - Lacerate is slot 3.
    // No ATB gate to wait past anymore (see the ability-GCD rework) - a
    // fresh battle starts every ability off cooldown, so "3" lands on the
    // very first press.
    keydown('3');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    keydown('3');
    assert.match(root.querySelector('#battle-buff-indicator').textContent, /Buffed/);
  });
```

- [ ] **Step 3: Run the test to verify it still passes**

Run: `node --test tests/battleScreenDom.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
test: drop the now-unnecessary ATB-fill workaround in the Lacerate "3" key test

The speed:999 override and initial wait existed only to satisfy the
player ATB gate the ability-GCD rework already removed - the ability
lands on the very first press now, no workaround needed.
EOF
)"
```

---

## Task 10: Update `simulateAbilityPolicy.js`

**Files:**
- Modify: `scripts/simulateAbilityPolicy.js`
- Test: `tests/simulateAbilityPolicy.test.js`

**Interfaces:**
- Produces: `chooseAction({ level, cooldowns, buffActive, attackOnCooldown }) → { kind, id? }` (drops the `ready` param). Task 11 calls this.

Current implementation (for reference):

```js
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

- [ ] **Step 1: Replace the existing tests**

Read `tests/simulateAbilityPolicy.test.js` in full first (it's short —
under 45 lines). Replace every call to `chooseAction({...})` that
includes a `ready:` field by removing that field entirely, **except** the
test currently named `'chooseAction does nothing when not ready and Attack
is on cooldown'` (around line 38) — replace that whole test with:

```js
test('chooseAction does nothing when every unlocked ability and Attack are all on cooldown', () => {
  const action = chooseAction({ level: 4, cooldowns: { stab: 1000, chop: 1000 }, buffActive: false, attackOnCooldown: true });
  assert.deepEqual(action, { kind: 'none' });
});
```

Every other existing test (Super Scream priority, highest-unlocked
ready damage ability, skips on-cooldown abilities, attacks when
everything else is on cooldown) keeps its same assertions — just delete
the `ready: true` / `ready: false` key from each call's object literal.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: FAIL on exactly 3 tests — `'chooseAction does not re-trigger
Super Scream while its buff is already active'`, `'chooseAction picks the
highest-unlocked ready damage ability'`, and `'chooseAction skips damage
abilities that are on cooldown even if ready'`. Omitting `ready` makes it
`undefined` (falsy) under the *old* code, which gates the entire
damage-ability branch behind `if (ready)` — so all 3 fall through to the
`{ kind: 'attack' }` fallback instead of picking an ability, mismatching
their expected `{ kind: 'ability', id: ... }`. The other 4 rewritten
tests (level-1 fallback, Super Scream's own priority check, "every
ability on cooldown," and the renamed "does nothing" test) don't actually
depend on `ready` for their expected outcome either way, so they pass
against the old code too — that's expected, not a problem.

- [ ] **Step 3: Implement**

In `scripts/simulateAbilityPolicy.js`, replace `chooseAction`:

```js
export function chooseAction({ level, cooldowns, buffActive, attackOnCooldown }) {
  const unlocked = getUnlockedAbilities(level);
  const offCooldown = (id) => (cooldowns[id] || 0) <= 0;

  const superScream = unlocked.find((a) => a.type === 'buff');
  if (superScream && offCooldown(superScream.id) && !buffActive) {
    return { kind: 'ability', id: superScream.id };
  }

  const candidates = unlocked.filter((a) => a.type === 'damage' && offCooldown(a.id));
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (b.unlockLevel > a.unlockLevel ? b : a));
    return { kind: 'ability', id: best.id };
  }

  return attackOnCooldown ? { kind: 'none' } : { kind: 'attack' };
}
```

Also update the doc comment above it — replace:
```js
 *   2. Otherwise, if the swing timer is ready, the highest-unlocked damage
 *      ability that's off cooldown.
```
with:
```js
 *   2. Otherwise, the highest-unlocked damage ability that's off
 *      cooldown (all abilities share a GCD now, not a separate swing
 *      timer - see the ability-GCD rework spec).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/simulateAbilityPolicy.js tests/simulateAbilityPolicy.test.js
git commit -m "$(cat <<'EOF'
refactor: simulateAbilityPolicy drops the ready param

Matches canUseAbility's own simplification - the simulated player no
longer needs a separate "is the swing timer ready" check, only
cooldown state.
EOF
)"
```

---

## Task 11: Update `simulate-balance.js`

**Files:**
- Modify: `scripts/simulate-balance.js`

No dedicated test file for this task — `scripts/simulate-balance.js` is
explicitly excluded from `npm test` (its own header explains why: a
stochastic report, not a pass/fail suite). Correctness is verified by
running it and confirming it completes without errors, then by Task 12's
comparison.

- [ ] **Step 1: Add imports**

In `scripts/simulate-balance.js`, add `abilityGcdMsForSpeed` to the
existing `from '../js/systems/combat.js'` import, and `applyAbilityGcd`
to the existing `from '../js/systems/abilities.js'` import.

- [ ] **Step 2: Remove the player ATB tick and reads/writes**

Find:
```js
  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    player.atb = tickGauge(player.atb, player.speed, 1);
    monster.atb = tickGauge(monster.atb, monster.speed, 1);
```
and change to:
```js
  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    monster.atb = tickGauge(monster.atb, monster.speed, 1);
```

Find (inside the monster-attack-resolution block):
```js
        result = resolveMonsterAttack(monster, player, Math.random, build.thornsPercent);
        player.hp = result.playerHp;
        player.atb = result.playerAtb;
      }
```
and change to:
```js
        result = resolveMonsterAttack(monster, player, Math.random, build.thornsPercent);
        player.hp = result.playerHp;
      }
```

Find (right before `chooseAction`'s call):
```js
    const action = chooseAction({
      level: build.level,
      cooldowns: abilityCooldowns,
      buffActive: buffState.active,
      ready: isReady(player.atb),
      attackOnCooldown: attackCooldownMs > 0,
    });
```
and change to:
```js
    const action = chooseAction({
      level: build.level,
      cooldowns: abilityCooldowns,
      buffActive: buffState.active,
      attackOnCooldown: attackCooldownMs > 0,
    });
```

- [ ] **Step 3: Wire in the shared GCD for the non-buff ability branch**

Find:
```js
      } else {
        const result = resolveAbilityUse(player, applyDefenseDebuff(monster, monster.defenseDebuff), ability, buffState.active, Math.random, build.critChancePercent / 100);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        player.atb = result.playerAtb;
        applyOnHitEffects(build, player, monster, result.damage);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        attackStreakIdleMs = 0;
```
and change to:
```js
      } else {
        const result = resolveAbilityUse(player, applyDefenseDebuff(monster, monster.defenseDebuff), ability, buffState.active, Math.random, build.critChancePercent / 100);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        applyOnHitEffects(build, player, monster, result.damage);
        ({ cooldowns: abilityCooldowns } = applyAbilityGcd(abilityCooldowns, getUnlockedAbilities(build.level), ability.id, abilityGcdMsForSpeed(player.speed)));
        attackStreak = 0;
        attackStreakIdleMs = 0;
```

Leave the buff branch (`abilityCooldowns[ability.id] = ability.cooldownMs;`
right after `buffState = activateBuff(ability);`, a few lines above this
one) untouched — same reasoning as Task 5's `battleScreen.js` change.

- [ ] **Step 4: Verify it runs cleanly**

Run: `node scripts/simulate-balance.js --trials 200`
Expected: completes without throwing, prints a report (fewer trials than
default just to check quickly it doesn't error — Task 12 runs the real
comparison at full trial count).

- [ ] **Step 5: Commit**

```bash
git add scripts/simulate-balance.js
git commit -m "$(cat <<'EOF'
refactor: simulate-balance.js mirrors the ability GCD rework

Keeps the balance simulator's win-rate numbers meaningful - its own
header warns this file must be hand-updated whenever ability-
readiness logic changes in the real game. player.atb/isReady(player)
are gone (mirroring battleScreen.js), abilityCooldowns now goes
through applyAbilityGcd for the same non-buff branch.
EOF
)"
```

---

## Task 12: Re-run the balance simulator, compare, and decide on retuning together

This task ends with a report back to Timothy, not an autonomous decision
— per the design spec, monster retuning and any per-ability
`overrideCooldownMs` are explicitly "see what the data says" calls to
make together, not something to auto-implement here.

- [ ] **Step 1: Run the full comparison**

Run: `node scripts/simulate-balance.js | tee /tmp/balance-after-gcd.txt`

Then diff it against Task 1's baseline:

Run: `diff docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes/balance-baseline-before-gcd.txt /tmp/balance-after-gcd.txt`

- [ ] **Step 2: Save the after-report next to the baseline**

Run: `cp /tmp/balance-after-gcd.txt docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes/balance-after-gcd.txt`

- [ ] **Step 3: Summarize the diff for Timothy**

Report, in plain language, per dungeon/boss tier: which win rates moved,
by how much, and in which direction. Call out anything that crossed from
"winnable" to "not winnable" (or vice versa) — that's the signal for
whether monster stats need retuning, and whether any of the 4 abilities
looks like it needs its own `overrideCooldownMs` above the bare GCD
(check the report's per-ability usage/DPS breakdown, if present, for one
ability dominating the rotation).

- [ ] **Step 4: Commit the after-report**

```bash
git add docs/superpowers/plans/2026-09-03-ability-gcd-rework-notes/balance-after-gcd.txt
git commit -m "$(cat <<'EOF'
docs: post-rework balance report for ability GCD comparison [skip ci]
EOF
)"
```

- [ ] **Step 5: Stop here and wait for direction**

Do not retune monster stats or add any `overrideCooldownMs` values
without discussing the actual numbers from Step 3 first — this is the
explicit "think through together" checkpoint from the original ask.

---

## After all tasks: versioning checklist

Per this repo's `CLAUDE.md`, before this branch/work is pushed: bump
`CHANGELOG.md`'s `Unreleased` section into a new dated version (MINOR
bump — this is a completed feature/mechanic, not a patch), add a matching
`js/data/playerChangelog.js` entry (player-facing: "abilities no longer
wait on a refilling gauge - use them the moment they're off cooldown,"
plus whatever Task 12's retuning conversation actually changes about
enemy difficulty, if anything), and run `npm run test` one final time
before pushing.
