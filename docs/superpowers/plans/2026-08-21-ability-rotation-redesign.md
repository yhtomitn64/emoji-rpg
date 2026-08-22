# Ability Rotation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Sweep a full-damage AOE role, turn Stab↔Chop and Slash↔Sweep into two independent combo lanes with a setup/payoff bonus (and a swing-timer-skip on the payoff), and add on-screen cues (a combo-ready button glow and a timing-meter "Press Space!" hint) so both the combo and the existing timing-meter mechanic are self-explanatory in the moment.

**Architecture:** Almost all logic changes live in `js/systems/abilities.js` (pure functions, TDD-covered) — `ABILITIES` gains combo-lane and AOE metadata, and `resolveAbilityUse` gains one new boolean parameter. `js/screens/battleScreen.js` wires that into the existing ability-button/timing-meter DOM code with a small amount of new per-battle state (`comboState`); this file has zero automated test coverage by established project convention (see `.superpowers/sdd/2026-08-21-multi-mob-encounters/progress.md` history and every prior plan touching this file) and is verified live in-browser instead, in the final task. `css/styles.css` gets two small additive blocks for the new visual cues.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, no build step, no framework.

**Spec:** `docs/superpowers/specs/2026-08-21-ability-rotation-redesign-design.md`

## Global Constraints

- Only Sweep gets `aoe: true`. Stab, Chop, and Slash stay single-target against whatever is currently selected. Super Scream is untouched by everything in this plan.
- Combo lanes: Stab (`setup`) ↔ Chop (`payoff`), Slash (`setup`) ↔ Sweep (`payoff`). The two lanes never interact with each other.
- `COMBO_PAYOFF_BONUS_MULTIPLIER = 1.5` (forward: landing a setup primes its payoff for this bonus). `COMBO_RETURN_BONUS_MULTIPLIER = 1.15` (return: landing a payoff primes its setup for this smaller bonus). Both stack multiplicatively with the existing `buffActive`/`timingHit` bonuses, same pattern as today.
- No expiration on a primed state — it persists until the primed ability is actually used, regardless of what else happens in between.
- The swing-timer-full requirement (`isReady(playerCombatant.atb)`) is bypassed **only** for a primed payoff (Chop primed by Stab, Sweep primed by Slash) — never for a primed setup's return bonus. A primed ability still respects its own real-time cooldown either way.
- Using a primed payoff still resets the player's swing timer to empty afterward, exactly like every other action — only the *wait to press it* is skipped, not the normal post-use reset.
- Sweep hitting every living monster deals **full** damage independently to each (own crit roll, own combo/buff/timing bonuses if applicable — not split or reduced), and applies the existing defense-shred debuff to every monster it hits.
- Out of scope for this plan (do not implement): ability button icons, damage-number previews, press-animations on ability buttons; moving Super Scream off key `5` or exempting it from the swing-timer gate; any change to Attack's behavior; any AOE/combo behavior on Super Scream.

---

### Task 1: `js/systems/abilities.js` — combo metadata, AOE flag, and the combo bonus in `resolveAbilityUse`

**Files:**
- Modify: `js/systems/abilities.js`
- Modify: `tests/abilities.test.js`

**Interfaces:**
- Produces: `COMBO_PAYOFF_BONUS_MULTIPLIER` (1.5), `COMBO_RETURN_BONUS_MULTIPLIER` (1.15) — new named exports.
- Produces: each entry in `ABILITIES` for `stab`/`chop`/`slash`/`sweep` gains `comboRole: 'setup' | 'payoff'`, `comboPartnerId: <ability id>`, `comboBonusMultiplier: <number>`. `sweep` additionally gains `aoe: true`. `superScream`'s entry is unchanged (no combo/aoe fields).
- Produces: `resolveAbilityUse(player, monster, ability, buffActive, timingHit, comboBonusActive, rng = Math.random)` — **signature change**, inserting a new `comboBonusActive` boolean parameter before the existing `rng` parameter. Every existing call site and every existing test call must be updated to pass this new argument.
- Consumes: nothing new from other tasks (this task has no dependencies).

This is the first task and the foundation everything else builds on — no other task's code exists yet, so don't reference anything outside this file.

- [ ] **Step 1: Update the existing `resolveAbilityUse` tests for the new signature, and add the new combo/AOE tests — write them first, expect failures**

Open `tests/abilities.test.js`. It currently has 5 calls to `resolveAbilityUse` that each pass 5 positional arguments ending in an `rng` lambda, e.g. `resolveAbilityUse(player, monster, stab, false, false, () => 0.5)`. Change each of these 5 calls to insert `false` as a new 6th argument (the `comboBonusActive` parameter) immediately before the `rng` lambda, so they become 6 positional arguments, e.g. `resolveAbilityUse(player, monster, stab, false, false, false, () => 0.5)`.

The 5 existing calls to update, by their exact current text:
1. `resolveAbilityUse(player, monster, stab, false, false, () => 0.5)` → `resolveAbilityUse(player, monster, stab, false, false, false, () => 0.5)`
2. `resolveAbilityUse(player, monster, chop, true, false, () => 0.5)` → `resolveAbilityUse(player, monster, chop, true, false, false, () => 0.5)`
3. `resolveAbilityUse(player, monster, stab, false, true, () => 0.5)` → `resolveAbilityUse(player, monster, stab, false, true, false, () => 0.5)`
4. `resolveAbilityUse(player, monster, chop, true, true, () => 0.5)` → `resolveAbilityUse(player, monster, chop, true, true, false, () => 0.5)`
5. `resolveAbilityUse(player, monster, chop, false, false, () => 0.5)` → `resolveAbilityUse(player, monster, chop, false, false, false, () => 0.5)`

Then update the import line at the top of the file to add the two new named exports:

```js
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveTimingHit, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, ROTATION_BONUS_MULTIPLIER, TIMING_BONUS_MULTIPLIER, COMBO_PAYOFF_BONUS_MULTIPLIER, COMBO_RETURN_BONUS_MULTIPLIER } from '../js/systems/abilities.js';
```

Then append these new tests at the end of the file (after the last existing test, `applyDefenseDebuff reduces defense while active, leaves the monster untouched when null`):

```js
test('ABILITIES combo metadata pairs Stab↔Chop and Slash↔Sweep with matching roles and bonus multipliers', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.stab.comboRole, 'setup');
  assert.equal(byId.stab.comboPartnerId, 'chop');
  assert.equal(byId.stab.comboBonusMultiplier, COMBO_RETURN_BONUS_MULTIPLIER);
  assert.equal(byId.chop.comboRole, 'payoff');
  assert.equal(byId.chop.comboPartnerId, 'stab');
  assert.equal(byId.chop.comboBonusMultiplier, COMBO_PAYOFF_BONUS_MULTIPLIER);
  assert.equal(byId.slash.comboRole, 'setup');
  assert.equal(byId.slash.comboPartnerId, 'sweep');
  assert.equal(byId.slash.comboBonusMultiplier, COMBO_RETURN_BONUS_MULTIPLIER);
  assert.equal(byId.sweep.comboRole, 'payoff');
  assert.equal(byId.sweep.comboPartnerId, 'slash');
  assert.equal(byId.sweep.comboBonusMultiplier, COMBO_PAYOFF_BONUS_MULTIPLIER);
  assert.equal(byId.superScream.comboRole, undefined);
});

test('only Sweep has the aoe flag set', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(byId.sweep.aoe, true);
  assert.equal(byId.stab.aoe, undefined);
  assert.equal(byId.chop.aoe, undefined);
  assert.equal(byId.slash.aoe, undefined);
  assert.equal(byId.superScream.aoe, undefined);
});

test('COMBO_PAYOFF_BONUS_MULTIPLIER and COMBO_RETURN_BONUS_MULTIPLIER have the spec’d values', () => {
  assert.equal(COMBO_PAYOFF_BONUS_MULTIPLIER, 1.5);
  assert.equal(COMBO_RETURN_BONUS_MULTIPLIER, 1.15);
});

test('resolveAbilityUse multiplies in the combo payoff bonus when comboBonusActive is true on a payoff ability', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, true, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, * 1.5 (combo payoff bonus) = round(21) = 21
  assert.equal(result.damage, 21);
});

test('resolveAbilityUse multiplies in the smaller combo return bonus on a setup ability', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const stab = ABILITIES.find((a) => a.id === 'stab');
  const result = resolveAbilityUse(player, monster, stab, false, false, true, () => 0.5);
  // base 8, * 1.3 (stab) = round(10.4) = 10, * 1.15 (combo return bonus) = round(11.5) = 12
  assert.equal(result.damage, 12);
});

test('resolveAbilityUse stacks the combo bonus with the buff and timing bonuses together', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, true, true, true, () => 0.5);
  // base 8, * 1.8 = 14.4 -> 14, * 1.25 (buff) = 17.5 -> 18, * 1.30 (timing) = 23.4 -> 23, * 1.5 (combo) = 34.5 -> 35
  assert.equal(result.damage, 35);
});

test('resolveAbilityUse does not apply any combo bonus when comboBonusActive is false', () => {
  const player = { attack: 10, defense: 4, speed: 5, atb: 0 };
  const monster = { hp: 100, defense: 2, atb: 50 };
  const chop = ABILITIES.find((a) => a.id === 'chop');
  const result = resolveAbilityUse(player, monster, chop, false, false, false, () => 0.5);
  // base 8, * 1.8 (chop) = round(14.4) = 14, no combo multiplier
  assert.equal(result.damage, 14);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --test tests/abilities.test.js`
Expected: FAIL — the updated calls now pass 7 total arguments where `resolveAbilityUse` only accepts 6 (`player, monster, ability, buffActive, timingHit, rng`), and the new `COMBO_PAYOFF_BONUS_MULTIPLIER`/`COMBO_RETURN_BONUS_MULTIPLIER` imports don't exist yet, and the new metadata assertions (`comboRole`, `comboPartnerId`, `comboBonusMultiplier`, `aoe`) all fail since those fields don't exist on `ABILITIES` yet.

- [ ] **Step 3: Implement — add the two new constants, the combo/AOE metadata on `ABILITIES`, and the new `resolveAbilityUse` parameter**

In `js/systems/abilities.js`, replace the existing `ABILITIES` export and the two constants above `resolveAbilityUse` with:

```js
export const ROTATION_BONUS_MULTIPLIER = 1.25;
export const TIMING_BONUS_MULTIPLIER = 1.30;
export const COMBO_PAYOFF_BONUS_MULTIPLIER = 1.5;
export const COMBO_RETURN_BONUS_MULTIPLIER = 1.15;

export const ABILITIES = [
  {
    id: 'stab', name: 'Stab', unlockLevel: 2, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 4000,
    comboRole: 'setup', comboPartnerId: 'chop', comboBonusMultiplier: COMBO_RETURN_BONUS_MULTIPLIER,
  },
  {
    id: 'chop', name: 'Chop', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.8, cooldownMs: 10000,
    comboRole: 'payoff', comboPartnerId: 'stab', comboBonusMultiplier: COMBO_PAYOFF_BONUS_MULTIPLIER,
  },
  {
    id: 'slash', name: 'Slash', unlockLevel: 6, type: 'damage',
    damageMultiplier: 1.0, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
    comboRole: 'setup', comboPartnerId: 'sweep', comboBonusMultiplier: COMBO_RETURN_BONUS_MULTIPLIER,
  },
  {
    id: 'sweep', name: 'Sweep', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.5, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
    aoe: true,
    comboRole: 'payoff', comboPartnerId: 'slash', comboBonusMultiplier: COMBO_PAYOFF_BONUS_MULTIPLIER,
  },
  {
    id: 'superScream', name: 'Super Scream', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000,
  },
];
```

(Note: the `ROTATION_BONUS_MULTIPLIER`/`TIMING_BONUS_MULTIPLIER` constants currently live just above `resolveAbilityUse`, further down the file, not above `ABILITIES` — move them up to sit with the two new constants as shown above, so all four related tunables are declared together right after the imports.)

Then replace `resolveAbilityUse`'s definition (removing the now-duplicated `ROTATION_BONUS_MULTIPLIER`/`TIMING_BONUS_MULTIPLIER` declarations from their old location) with:

```js
export function resolveAbilityUse(player, monster, ability, buffActive, timingHit, comboBonusActive, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  if (timingHit) damage = Math.round(damage * TIMING_BONUS_MULTIPLIER);
  if (comboBonusActive) damage = Math.round(damage * ability.comboBonusMultiplier);
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

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test tests/abilities.test.js`
Expected: PASS, all tests green (14 existing + 6 new = 20 tests in this file).

- [ ] **Step 5: Run the full suite to confirm no regressions elsewhere**

Run: `node --test`
Expected: PASS. No other file currently calls `resolveAbilityUse` (it's only called from `js/screens/battleScreen.js`, which Tasks 2-3 update — until then it's unreferenced by any other module, and no other test file imports it), so this should be a clean, isolated pass.

- [ ] **Step 6: Commit**

```bash
git add js/systems/abilities.js tests/abilities.test.js
git commit -m "feat: add combo-lane metadata, AOE flag, and combo bonus to the abilities system"
```

---

### Task 2: `js/screens/battleScreen.js` — combo state, priming, and button UI (single-target abilities)

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `ABILITIES` entries' `comboRole`/`comboPartnerId`/`comboBonusMultiplier` fields and `resolveAbilityUse`'s new `comboBonusActive` parameter, both from Task 1.
- Produces: module-level `comboState` object (keyed by ability id, e.g. `{ stab: true }` meaning Stab's return bonus is primed) — Task 3 reads and mutates this same variable for the AOE branch.

This task wires combo priming into the ability-use flow and the button UI for the existing single-target resolution path. **Sweep still resolves single-target in this task** — its AOE behavior is Task 3's job, which will move Sweep into a separate branch of `playerUseAbility` while reusing the combo-state-update lines this task adds. Since Sweep hasn't been made AOE yet at this point in the plan, this task's changes to `playerUseAbility` apply uniformly to all four damage abilities including Sweep, and Task 3 will only touch the parts specific to iterating over multiple monsters.

`js/screens/battleScreen.js` has zero automated test coverage by established project convention (every prior task touching this file across the parry and multi-mob-encounters plans relied on manual live-browser verification instead) — this task has no test step; correctness is verified live in Task 5.

- [ ] **Step 1: Add the `comboState` module variable and reset it per battle**

Find this line near the top of `js/screens/battleScreen.js` (around line 32-33):

```js
let abilityCooldowns = {};
let buffState = createBuffState();
```

Change it to:

```js
let abilityCooldowns = {};
let buffState = createBuffState();
let comboState = {};
```

Find this block inside `mount()` (around line 660-661):

```js
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
```

Change it to:

```js
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  comboState = {};
```

- [ ] **Step 2: Prime the combo state on ability use, and pass `comboBonusActive` into `resolveAbilityUse`**

Find `playerUseAbility` in `js/screens/battleScreen.js`. Its current body (the non-buff branch) is:

```js
    const target = monsterCombatants[selectedMonsterIndex];
    const buffActiveAtPress = buffState.active;
    const defenseDebuffAtPress = target.defenseDebuff;
    const timingHit = await runTimingMeter();
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
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
```

Replace it with:

```js
    const target = monsterCombatants[selectedMonsterIndex];
    const buffActiveAtPress = buffState.active;
    const comboBonusActive = !!comboState[abilityId];
    const defenseDebuffAtPress = target.defenseDebuff;
    const timingHit = await runTimingMeter();
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive);
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
    // Consume this ability's own primed bonus (if any), then prime its combo
    // partner: a setup primes its payoff for the bigger forward bonus, a
    // payoff primes its setup for the smaller return bonus. Same two lines
    // handle both directions since comboPartnerId points both ways.
    comboState[abilityId] = false;
    if (ability.comboPartnerId) {
      comboState[ability.comboPartnerId] = true;
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
```

Leave the rest of `playerUseAbility` (the `log.push`, `playHitEffect`, `updateHpBars()`, etc. after this point) exactly as-is.

- [ ] **Step 3: Show the combo state on the ability buttons, and let a primed payoff bypass the swing-timer requirement**

Find `abilityButtonsHtml()`:

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
```

Replace it with:

```js
function abilityButtonsHtml() {
  const ready = isReady(playerCombatant.atb);
  return ABILITIES.map((ability, index) => {
    const slot = index + 1;
    const locked = state.player.level < ability.unlockLevel;
    const cooldownRemaining = abilityCooldowns[ability.id] || 0;
    // A primed payoff (e.g. Chop after Stab landed) can be pressed even
    // before the swing timer is full - that's the "instant" combo feel.
    // A primed setup's return bonus (e.g. Stab after Chop landed) does NOT
    // get this bypass, only the extra damage - see Global Constraints.
    const comboPrimed = !!comboState[ability.id];
    const comboSkipsReady = comboPrimed && ability.comboRole === 'payoff';
    const disabled = locked || cooldownRemaining > 0 || (!ready && !comboSkipsReady);
    const cooldownSuffix = cooldownRemaining > 0 ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const comboSuffix = comboPrimed
      ? (ability.comboRole === 'payoff' ? ' ⚡ Combo Ready' : ' ⚡ Bonus Ready')
      : '';
    const label = `${ability.name} (${slot})${cooldownSuffix}${comboSuffix}`;
    const comboClass = comboPrimed ? ' battle-ability-button-combo' : '';
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button${comboClass}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }).join('');
}
```

- [ ] **Step 4: Add CSS for the combo-ready button glow**

In `css/styles.css`, find the `.battle-ability-button:disabled` block:

```css
.battle-ability-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

Add this immediately after it:

```css
.battle-ability-button-combo {
  border-color: #f5b942;
  box-shadow: 0 0 8px rgba(245, 185, 66, 0.6);
  animation: battle-combo-pulse 1.2s ease-in-out infinite;
}
@keyframes battle-combo-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(245, 185, 66, 0.4); }
  50% { box-shadow: 0 0 12px rgba(245, 185, 66, 0.9); }
}
```

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all tests green (same count as the end of Task 1 — this task only changes `battleScreen.js`, which has no test file).

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: wire combo priming into ability use and show a combo-ready button state"
```

---

### Task 3: `js/screens/battleScreen.js` — Sweep resolves as AOE

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: `ability.aoe` from Task 1's `ABILITIES` metadata; `comboState`/the combo-priming lines from Task 2 (reused, not reimplemented, for the AOE branch).
- Produces: nothing new consumed by later tasks — this is the last logic task.

- [ ] **Step 1: Branch `playerUseAbility` on `ability.aoe`**

Find the entire `playerUseAbility` function in `js/screens/battleScreen.js` (as it stands after Task 2 — it starts with `async function playerUseAbility(abilityId) {` and ends with the `finally { abilityActionInFlight = false; }` block's closing `}`). Replace the whole function with this complete version:

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

    const buffActiveAtPress = buffState.active;
    const comboBonusActive = !!comboState[abilityId];

    if (ability.aoe) {
      const targetIndices = monsterCombatants
        .map((mc, i) => i)
        .filter((i) => monsterCombatants[i].hp > 0);
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      const timingHit = await runTimingMeter();
      // Same battle-can-end-mid-await hazard as the single-target path below.
      if (battleOver) return;
      targetIndices.forEach((monsterIndex, n) => {
        const mc = monsterCombatants[monsterIndex];
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, timingHit, comboBonusActive);
        mc.hp = result.monsterHp;
        mc.atb = result.monsterAtb;
        playerCombatant.atb = result.playerAtb;
        mc.defenseDebuff = createDefenseDebuff(ability);
        const timingSuffix = timingHit ? ' Perfect timing!' : '';
        log.push((result.isCrit
          ? `Critical! You use ${ability.name} on ${mc.name} for ${result.damage}!`
          : `You use ${ability.name} on ${mc.name} for ${result.damage}.`) + timingSuffix);
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
      });
      abilityCooldowns[abilityId] = ability.cooldownMs;
      comboState[abilityId] = false;
      if (ability.comboPartnerId) {
        comboState[ability.comboPartnerId] = true;
      }
      updateHpBars();
      updateAtbBars();
      updateLog();
      checkOutcome();
      updateMenu();
      return;
    }

    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    const timingHit = await runTimingMeter();
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive);
    target.hp = result.monsterHp;
    target.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    abilityCooldowns[abilityId] = ability.cooldownMs;
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    comboState[abilityId] = false;
    if (ability.comboPartnerId) {
      comboState[ability.comboPartnerId] = true;
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
    log.push((result.isCrit
      ? `Critical! You use ${ability.name} on ${target.name} for ${result.damage}!`
      : `You use ${ability.name} on ${target.name} for ${result.damage}.`) + timingSuffix);
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
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

Two things changed from Task 2's version, beyond the new `if (ability.aoe) { ... }` branch: `buffActiveAtPress`/`comboBonusActive` are now computed once, before the branch, instead of being duplicated in each path; and the single-target tail's `if (ability.id === 'sweep') { target.defenseDebuff = createDefenseDebuff(ability); }` block is gone — Sweep always takes the `ability.aoe` branch above and returns early now, so that block could never run for Sweep anymore. Its AOE equivalent (`mc.defenseDebuff = createDefenseDebuff(ability);`) is inside the loop above. The `if (ability.id === 'slash') { ... }` bleed-setup block stays in the single-target tail unchanged — Slash is not AOE.

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, same count as Task 2 (this task only changes `battleScreen.js`, which has no test file).

- [ ] **Step 3: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: make Sweep hit every living monster with full damage and its debuff"
```

---

### Task 4: `js/screens/battleScreen.js` — timing-meter "Press Space!" cue

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 — this task is fully independent of the combo/AOE work and could in principle be done in any order relative to them. Placed last among the logic/UI tasks purely so Task 5's manual verification checks everything in one pass.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add the hint element to the timing meter's markup**

Find `timingMeterHtml()`:

```js
function timingMeterHtml() {
  if (getUnlockedAbilities(state.player.level).length === 0) return '';
  return `
        <div class="battle-timing-meter" id="battle-timing-meter">
          <div class="battle-timing-track">
            <div class="battle-timing-sweet-spot" style="left: 80%; width: 20%;"></div>
            <div class="battle-timing-fill" id="battle-timing-fill"></div>
          </div>
        </div>`;
}
```

Replace it with:

```js
function timingMeterHtml() {
  if (getUnlockedAbilities(state.player.level).length === 0) return '';
  return `
        <div class="battle-timing-meter" id="battle-timing-meter">
          <div class="battle-timing-track">
            <div class="battle-timing-sweet-spot" style="left: 80%; width: 20%;"></div>
            <div class="battle-timing-fill" id="battle-timing-fill"></div>
          </div>
          <div class="battle-timing-hint" id="battle-timing-hint">Press Space!</div>
        </div>`;
}
```

- [ ] **Step 2: Wire the hint element into `elements` and toggle its visibility with the meter**

Find this line in `buildDom()`'s `elements = { ... }` assignment:

```js
    timingMeter: document.getElementById('battle-timing-meter'),
    timingFill: document.getElementById('battle-timing-fill'),
```

Change it to:

```js
    timingMeter: document.getElementById('battle-timing-meter'),
    timingFill: document.getElementById('battle-timing-fill'),
    timingHint: document.getElementById('battle-timing-hint'),
```

Find `runTimingMeter`'s inner `finish` function:

```js
    function finish(actedAtPercent) {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(rafId);
      elements.timingMeter.classList.remove('battle-timing-meter-active');
      elements.timingMeter.onclick = null;
      window.removeEventListener('keydown', onKeydown);
      elements.timingFill.style.width = '0%';
      resolve(resolveTimingHit(actedAtPercent, TIMING_SWEET_SPOT_START, TIMING_SWEET_SPOT_END));
    }
```

Replace it with:

```js
    function finish(actedAtPercent) {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(rafId);
      elements.timingMeter.classList.remove('battle-timing-meter-active');
      elements.timingMeter.onclick = null;
      window.removeEventListener('keydown', onKeydown);
      elements.timingFill.style.width = '0%';
      elements.timingHint.classList.remove('battle-timing-hint-visible');
      resolve(resolveTimingHit(actedAtPercent, TIMING_SWEET_SPOT_START, TIMING_SWEET_SPOT_END));
    }
```

Find `runTimingMeter`'s inner `frame` function:

```js
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
```

Replace it with:

```js
    function frame(now) {
      const elapsed = now - startedAt;
      const percent = Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100);
      elements.timingFill.style.width = `${percent}%`;
      elements.timingHint.classList.toggle('battle-timing-hint-visible', percent >= TIMING_SWEET_SPOT_START);
      if (percent >= 100) {
        finish(-1); // ran out with no input: always a miss, ability still resolves at base value
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
```

- [ ] **Step 3: Add CSS for the hint's fade in/out**

In `css/styles.css`, find the `.battle-timing-fill` block:

```css
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

Add this immediately after it:

```css
.battle-timing-hint {
  font-size: 0.8rem;
  color: #4ade80;
  text-align: center;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}
.battle-timing-hint-visible {
  opacity: 1;
}
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, same count as Task 3.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: show a Press Space! cue once the timing meter enters its sweet spot"
```

---

### Task 5: Manual verification and CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the complete feature from Tasks 1-4. This task performs no code changes beyond the CHANGELOG entry.

`js/screens/battleScreen.js` has no automated test coverage (established project convention). This task verifies the combo system, AOE Sweep, and the timing-meter cue live in a browser before considering the plan done, following the same pattern used for the parry mechanic and multi-mob-encounters plans.

- [ ] **Step 1: Start the local server and open the game**

```bash
python3 -m http.server 8973
```

Open `http://localhost:8973/index.html` in a browser. Create or load a save, then set the character's level to 8+ via the save's `localStorage` JSON (so Stab, Chop, Slash, and Sweep are all unlocked) — the same technique used for prior manual-verification tasks in this project (edit `state.player.level` and `state.player.xp` directly in the saved JSON, or use the in-game level-up path if faster).

- [ ] **Step 2: Solo-battle regression check**

Start a solo (1-monster) encounter. Confirm: Attack, Stab, Chop, Slash all work exactly as before this plan (same damage math, same cooldowns, no unexpected combo glow appears on any button before you've used anything). Confirm Sweep against a single monster still deals damage and applies its defense-shred debuff — this is the AOE branch running against a 1-element array, which should look identical to the old single-target behavior.

- [ ] **Step 3: Combo loop check**

In a solo battle, press Stab. Confirm: Chop's button gets the glow/border treatment and its label shows "Combo Ready". Press Chop *before* the swing timer bar is full — confirm it's still clickable/pressable (the swing-timer bypass) and its damage number is noticeably higher than a normal Chop hit (the 1.5x bonus). Confirm Chop's glow clears once used. Confirm Stab's button now shows "Bonus Ready". Press Stab again — confirm it deals a smaller but still-boosted amount (the 1.15x return bonus) and does **not** bypass the swing-timer wait (you have to wait for the bar to fill this time). Confirm the loop continues: Chop should be primed again after this second Stab.

Repeat the same check for the Slash → Sweep lane (Slash primes Sweep; Sweep's payoff includes both the 1.5x bonus and the swing-timer bypass; using Sweep primes Slash's return bonus).

- [ ] **Step 4: AOE Sweep in a group fight**

Force a group encounter (same technique used in the multi-mob-encounters plan's manual verification: set `state.monsterKillCounts.<species>` above the group-spawn threshold and walk into that species' territory until a group spawns). With 2-3 monsters alive, press Sweep. Confirm: every living monster takes damage in the same action (separate log lines, separate hit-effect animations on each), each monster's defense-shred debuff visibly applies (check via a following Attack/ability dealing more damage than usual), and if Sweep kills more than one monster at once, all of them are removed from the row correctly (reusing the existing deferred-hide mechanism from the multi-mob-encounters plan — no visual glitches expected, but confirm).

- [ ] **Step 5: Timing-meter cue check**

Trigger any ability's timing meter. Confirm "Press Space!" is not visible for the first ~80% of the bar's fill, then fades in once the fill crosses into the green sweet-spot zone. Press Space while it's visible — confirm "Perfect timing!" appears in the log and the timing bonus applies. Let the meter run out without pressing anything — confirm it resolves as a miss (as before) and the hint fades back out for the next use.

- [ ] **Step 6: Add the CHANGELOG entry**

Add a new bullet under `## [Unreleased]` → `### Added` in `CHANGELOG.md`, following the file's existing style (see the multi-mob-encounters and parry-mechanic entries immediately above it for the exact tone/format). Cover: Sweep is now a full-damage AOE hitting every living monster plus its debuff; Stab↔Chop and Slash↔Sweep are combo lanes where landing the setup primes the payoff for a 1.5x bonus and a swing-timer bypass, and landing the payoff returns a smaller 1.15x bonus to the setup, both shown via a glowing "Combo Ready"/"Bonus Ready" button state; the ability timing meter now shows a "Press Space!" cue once it enters its sweet spot.

- [ ] **Step 7: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add ability rotation redesign CHANGELOG entry"
```
