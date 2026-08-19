# Parry Mechanic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wind-up before every monster attack, with a parry-able zone near the end that fully negates the hit and reflects true damage back at the monster when landed.

**Architecture:** A new pure module `js/systems/parry.js` holds all timing/damage math (mirroring `abilities.js`'s style). `js/screens/battleScreen.js`'s existing `tick()` loop drives the wind-up as ordinary tick-advanced state (not an async pause, so Attack/abilities/Flee stay fully usable while a monster winds up) and reuses the monster's existing ATB bar element for the visual, rather than adding a new persistent widget.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, no build step.

**Spec:** `docs/superpowers/specs/2026-08-18-parry-mechanic-design.md`

## Global Constraints

- `PARRY_WINDUP_DURATION_MS = 1000` (matches the ability timing-meter's existing duration).
- `PARRY_ZONE_START_PERCENT = 80`, `PARRY_ZONE_END_PERCENT = 100` (matches the ability timing-meter's existing sweet spot).
- `PARRY_REFLECT_FRACTION = 0.5`.
- A successful parry: player takes **zero damage**, monster takes `round(incomingDamage * PARRY_REFLECT_FRACTION)` applied **directly to HP, bypassing monster defense entirely**, and the monster's ATB resets to **0** (not knocked back — see spec's "Mechanics" section for why a flat knockback from 100 would be wrong here).
- A failed/missed parry attempt, or no attempt at all, resolves as an ordinary unparried hit — must be byte-for-byte identical in effect to today's `monsterAttack()`.
- No cap, cooldown, or per-battle limit on parry attempts — every monster attack gets its own wind-up, unlimited attempts, per the explicit "ship as designed, tune later" decision.
- The parry key is **`s`**/**`S`** — `a`/`i`/`f` are already Attack/Item/Flee; must not collide.
- `js/systems/parry.js` is a pure module: no DOM, `rng` injectable and defaulting to `Math.random` wherever randomness is used, imports only from `combat.js` (mirroring `abilities.js`'s existing precedent).

---

### Task 1: `parry.js` pure module

**Files:**
- Create: `js/systems/parry.js`
- Test: `tests/parry.test.js`

**Interfaces:**
- Produces: `PARRY_WINDUP_DURATION_MS`, `PARRY_ZONE_START_PERCENT`, `PARRY_ZONE_END_PERCENT`, `PARRY_REFLECT_FRACTION` (constants); `createWindupState()` → `{ active: false, elapsedMs: 0 }`; `startWindup()` → `{ active: true, elapsedMs: 0 }`; `tickWindup(windupState, dt)` → advances `elapsedMs` on an active state, no-op on an inactive one; `isWindupComplete(windupState)` → bool; `windupElapsedPercent(windupState)` → number 0-100, clamped; `resolveParryAttempt(elapsedPercent)` → bool; `rollIncomingDamage(monster, player, rng = Math.random)` → `{ damage, isCrit }`; `resolveParrySuccess(monster, incomingDamage)` → `{ monsterHp, monsterAtb, reflectedDamage }`.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT,
  createWindupState, startWindup, tickWindup, isWindupComplete, windupElapsedPercent,
  resolveParryAttempt, rollIncomingDamage, resolveParrySuccess,
} from '../js/systems/parry.js';

test('createWindupState returns an inactive state', () => {
  assert.deepEqual(createWindupState(), { active: false, elapsedMs: 0 });
});

test('startWindup returns an active state at 0 elapsed', () => {
  assert.deepEqual(startWindup(), { active: true, elapsedMs: 0 });
});

test('tickWindup advances elapsedMs on an active state', () => {
  const state = tickWindup({ active: true, elapsedMs: 300 }, 300);
  assert.deepEqual(state, { active: true, elapsedMs: 600 });
});

test('tickWindup is a no-op on an inactive state', () => {
  const state = tickWindup({ active: false, elapsedMs: 0 }, 300);
  assert.deepEqual(state, { active: false, elapsedMs: 0 });
});

test('isWindupComplete is false before the duration elapses', () => {
  assert.equal(isWindupComplete({ active: true, elapsedMs: 900 }), false);
});

test('isWindupComplete is true once elapsedMs reaches the duration', () => {
  assert.equal(isWindupComplete({ active: true, elapsedMs: PARRY_WINDUP_DURATION_MS }), true);
});

test('isWindupComplete is false on an inactive state even past the duration', () => {
  assert.equal(isWindupComplete({ active: false, elapsedMs: PARRY_WINDUP_DURATION_MS + 100 }), false);
});

test('windupElapsedPercent computes the right percentage', () => {
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: 500 }), 50);
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: 0 }), 0);
});

test('windupElapsedPercent clamps at 100', () => {
  assert.equal(windupElapsedPercent({ active: true, elapsedMs: PARRY_WINDUP_DURATION_MS + 500 }), 100);
});

test('resolveParryAttempt is true at the zone start boundary', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT), true);
});

test('resolveParryAttempt is true at the zone end boundary', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_END_PERCENT), true);
});

test('resolveParryAttempt is true inside the zone', () => {
  assert.equal(resolveParryAttempt(90), true);
});

test('resolveParryAttempt is false just below the zone', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT - 1), false);
});

test('resolveParryAttempt is false above the zone (unreachable in practice, but must resolve false not throw)', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_END_PERCENT + 1), false);
});

function fixedRng(values) {
  let i = 0;
  return () => values[i++];
}

test('rollIncomingDamage returns a non-crit damage number using the injected rng', () => {
  // First rng() call is rollCrit's roll (>= CRIT_CHANCE 0.1 means no crit).
  // Second rng() call is calculateDamage's variance roll.
  const rng = fixedRng([0.99, 0.5]);
  const monster = { attack: 20, defense: 0 };
  const player = { defense: 5 };
  const result = rollIncomingDamage(monster, player, rng);
  assert.equal(result.isCrit, false);
  assert.equal(result.damage, 15); // base = 20-5 = 15, variance 0.85+0.5*0.3 = 1.0
});

test('rollIncomingDamage applies the crit multiplier when the crit roll hits', () => {
  const critRng = fixedRng([0.0, 0.5]); // 0.0 < CRIT_CHANCE 0.1: crit
  const nonCritRng = fixedRng([0.99, 0.5]);
  const monster = { attack: 20, defense: 0 };
  const player = { defense: 5 };
  const critResult = rollIncomingDamage(monster, player, critRng);
  const nonCritResult = rollIncomingDamage(monster, player, nonCritRng);
  assert.equal(critResult.isCrit, true);
  assert.ok(critResult.damage > nonCritResult.damage);
});

test('rollIncomingDamage defaults to Math.random when no rng is passed', () => {
  const result = rollIncomingDamage({ attack: 20, defense: 0 }, { defense: 5 });
  assert.equal(typeof result.damage, 'number');
  assert.ok(result.damage > 0);
});

test('resolveParrySuccess reflects half the incoming damage, bypassing monster defense entirely', () => {
  const monster = { hp: 100, defense: 50 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.reflectedDamage, 15);
  assert.equal(result.monsterHp, 85); // 100 - 15, defense (50) never subtracted
});

test('resolveParrySuccess floors monster HP at 0', () => {
  const monster = { hp: 5, defense: 0 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.monsterHp, 0);
});

test('resolveParrySuccess resets monster ATB to 0, not a flat knockback', () => {
  const monster = { hp: 100, defense: 0 };
  const result = resolveParrySuccess(monster, 30);
  assert.equal(result.monsterAtb, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/parry.test.js`
Expected: FAIL — `js/systems/parry.js` does not exist (module not found error).

- [ ] **Step 3: Write the implementation**

```js
import { calculateDamage, rollCrit, applyCritMultiplier } from './combat.js';

export const PARRY_WINDUP_DURATION_MS = 1000;
export const PARRY_ZONE_START_PERCENT = 80;
export const PARRY_ZONE_END_PERCENT = 100;
export const PARRY_REFLECT_FRACTION = 0.5;

export function createWindupState() {
  return { active: false, elapsedMs: 0 };
}

export function startWindup() {
  return { active: true, elapsedMs: 0 };
}

export function tickWindup(windupState, dt) {
  if (!windupState.active) return windupState;
  return { active: true, elapsedMs: windupState.elapsedMs + dt };
}

export function isWindupComplete(windupState) {
  return windupState.active && windupState.elapsedMs >= PARRY_WINDUP_DURATION_MS;
}

export function windupElapsedPercent(windupState) {
  return Math.min(100, (windupState.elapsedMs / PARRY_WINDUP_DURATION_MS) * 100);
}

export function resolveParryAttempt(elapsedPercent) {
  return elapsedPercent >= PARRY_ZONE_START_PERCENT && elapsedPercent <= PARRY_ZONE_END_PERCENT;
}

export function rollIncomingDamage(monster, player, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(monster, player, rng);
  damage = applyCritMultiplier(damage, isCrit);
  return { damage, isCrit };
}

export function resolveParrySuccess(monster, incomingDamage) {
  const reflectedDamage = Math.round(incomingDamage * PARRY_REFLECT_FRACTION);
  return {
    monsterHp: Math.max(0, monster.hp - reflectedDamage),
    monsterAtb: 0,
    reflectedDamage,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/parry.test.js`
Expected: PASS, all 19 tests green.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 245 prior tests still green plus the 19 new ones (264 total).

- [ ] **Step 6: Commit**

```bash
git add js/systems/parry.js tests/parry.test.js
git commit -m "feat: add parry pure module (wind-up timing + reflect-damage math)"
```

---

### Task 2: Wire the wind-up mechanic into `battleScreen.js`

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:**
- Consumes: from `js/systems/parry.js` (Task 1) — `createWindupState()`, `startWindup()`, `tickWindup(windupState, dt)`, `isWindupComplete(windupState)`, `windupElapsedPercent(windupState)`, `resolveParryAttempt(elapsedPercent)`, `rollIncomingDamage(monster, player, rng)`, `resolveParrySuccess(monster, incomingDamage)`.
- Produces: module-level `monsterWindup` state; `resolveMonsterWindup(parried)` function, callable from `tick()` (natural completion) and from a keydown/click handler (early resolution) — later tasks reuse this function unchanged.

This task makes the mechanic fully functional (parry math, timing, keyboard/click input) with minimal visual feedback (the monster's ATB bar width already reflects wind-up progress, since it's driven by the same element). Task 3 adds the color/zone-highlight/key-hint polish on top — this task does not touch CSS.

- [ ] **Step 1: Add the import**

In `js/screens/battleScreen.js`, add a new import line after the existing `abilities.js` import (currently line 5):

```js
import { createWindupState, startWindup, tickWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess } from '../systems/parry.js';
```

- [ ] **Step 2: Add the module-level state variable**

Add alongside the other module-level `let` declarations (currently lines 12-28), after `let abilityActionInFlight = false;`:

```js
let monsterWindup = createWindupState();
```

- [ ] **Step 3: Give the monster's ATB bar container an id**

In `buildDom()` (around line 91), the monster's ATB bar currently has no id on its outer container — only the inner fill does:

```js
            <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-monster-atb-fill"></div></div>
```

Change it to:

```js
            <div class="battle-atb-bar" id="battle-monster-atb-bar"><div class="battle-atb-fill" id="battle-monster-atb-fill"></div></div>
```

- [ ] **Step 4: Add the new element reference**

In the `elements = {...}` object inside `buildDom()` (around line 113-129), add a new entry. Insert it right after the existing `monsterAtbFill:` line:

```js
    monsterAtbFill: document.getElementById('battle-monster-atb-fill'),
    monsterAtbBar: document.getElementById('battle-monster-atb-bar'),
```

- [ ] **Step 5: Reset `monsterWindup` in `mount()`**

In `mount()` (around line 500-514), add the reset alongside the other per-battle state resets, right after `abilityActionInFlight = false;`:

```js
  abilityActionInFlight = false;
  monsterWindup = createWindupState();
```

Also wire the click handler on the monster's ATB bar, right after `buildDom();` (currently line 515):

```js
  buildDom();
  elements.monsterAtbBar.onclick = () => resolveMonsterWindup(true);
```

- [ ] **Step 6: Add `resolveMonsterWindup`**

Add this new function immediately after `monsterAttack()` (which ends around line 443), before `checkOutcome()`:

```js
function resolveMonsterWindup(parried) {
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
    playHitEffect(elements.monsterZone, elements.monsterEmoji, result.reflectedDamage, isCrit);
    checkOutcome();
  } else {
    monsterAttack();
  }
  updateAtbBars();
  updateMenu();
}
```

- [ ] **Step 7: Replace `tick()`'s instant-attack block**

In `tick()` (currently lines 453-485), replace:

```js
  if (isReady(monsterCombatant.atb)) {
    monsterAttack();
  }
  if (battleOver) return;
```

with:

```js
  if (isReady(monsterCombatant.atb) && !monsterWindup.active) {
    monsterWindup = startWindup();
  } else if (monsterWindup.active) {
    monsterWindup = tickWindup(monsterWindup, 300);
    if (isWindupComplete(monsterWindup)) {
      resolveMonsterWindup(false);
    }
  }
  if (battleOver) return;
```

Everything else in `tick()` (the `defenseDebuff`/`pendingDelayedHit`/`updateAtbBars`/`updateMenu`/`updateBuffIndicator` block below) is unchanged.

- [ ] **Step 8: Add the `'s'`/`'S'` keydown branch**

In `handleKeydown` (currently lines 285-305), add the parry branch before the existing `'i'`/`'I'` check, so it's reachable regardless of the player's own ATB readiness (parry depends on the monster's wind-up state, not the player's gauge — matching how `'i'`/`'I'` is already placed before the `if (!isReady(playerCombatant.atb)) return;` gate):

```js
function handleKeydown(event) {
  if (battleOver) return;
  const key = event.key;
  if (key === 's' || key === 'S') {
    resolveMonsterWindup(true);
    return;
  }
  if (key === 'i' || key === 'I') {
    playerUseItem();
    return;
  }
  if (!isReady(playerCombatant.atb)) return;
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
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

- [ ] **Step 9: Render wind-up progress on the monster's ATB bar**

In `updateAtbBars()` (currently lines 195-198), replace:

```js
function updateAtbBars() {
  elements.monsterAtbFill.style.width = `${percent(monsterCombatant.atb, ATB_MAX)}%`;
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}
```

with:

```js
function updateAtbBars() {
  const monsterAtbPercent = monsterWindup.active
    ? windupElapsedPercent(monsterWindup)
    : percent(monsterCombatant.atb, ATB_MAX);
  elements.monsterAtbFill.style.width = `${monsterAtbPercent}%`;
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}
```

- [ ] **Step 10: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 264 tests green (this task adds no new test file — `battleScreen.js` has no dedicated test file in this codebase, matching the existing convention for screen modules; Task 4 covers manual verification).

- [ ] **Step 11: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: wire monster attack wind-up and parry into battle screen"
```

---

### Task 3: Visual polish — wind-up color, parry zone highlight, key-hint

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `monsterWindup` state and `elements.monsterAtbBar`/`monsterAtbFill` from Task 2.
- Produces: no new exported interfaces — this task is purely visual, adding a CSS class toggle and two new DOM elements.

- [ ] **Step 1: Add the zone-highlight element to `buildDom()`**

In `buildDom()`, the monster's ATB bar (already given an id in Task 2) currently reads:

```js
            <div class="battle-atb-bar" id="battle-monster-atb-bar"><div class="battle-atb-fill" id="battle-monster-atb-fill"></div></div>
```

Change it to include a zone-highlight child, and add a key-hint element as a sibling right after the bar:

```js
            <div class="battle-atb-bar" id="battle-monster-atb-bar">
              <div class="battle-parry-zone"></div>
              <div class="battle-atb-fill" id="battle-monster-atb-fill"></div>
            </div>
            <div class="battle-parry-hint" id="battle-parry-hint"></div>
```

- [ ] **Step 2: Add the new element references**

In the `elements = {...}` object, add after the `monsterAtbBar:` line added in Task 2:

```js
    monsterAtbBar: document.getElementById('battle-monster-atb-bar'),
    parryHint: document.getElementById('battle-parry-hint'),
```

- [ ] **Step 3: Toggle the wind-up class and key-hint text in `updateAtbBars()`**

Replace the `updateAtbBars()` function (as left by Task 2) with:

```js
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

- [ ] **Step 4: Add the CSS**

In `css/styles.css`, the existing `.battle-atb-bar` rule (around line 103-110) currently reads:

```css
.battle-atb-bar {
  width: 200px;
  background: #222;
  border-radius: 4px;
  height: 6px;
  margin: 4px auto 0;
  overflow: hidden;
}
```

Add `position: relative;` to it (needed for the zone-highlight child to position itself against the bar, the same way `.battle-timing-track` already does for the ability meter's own sweet-spot):

```css
.battle-atb-bar {
  width: 200px;
  background: #222;
  border-radius: 4px;
  height: 6px;
  margin: 4px auto 0;
  overflow: hidden;
  position: relative;
}
```

Then add these new rules after the existing `.battle-atb-fill-hero` rule (around line 95-97):

```css
.battle-parry-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 80%;
  width: 20%;
  background: rgba(231, 76, 60, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.battle-atb-bar-windup .battle-parry-zone {
  opacity: 1;
}
.battle-atb-bar-windup .battle-atb-fill {
  background: #e74c3c;
}
.battle-parry-hint {
  font-size: 0.75rem;
  color: #e74c3c;
  min-height: 1.1em;
  margin-top: 2px;
  cursor: pointer;
}
```

(`.battle-atb-bar-windup .battle-atb-fill` overriding the base `.battle-atb-fill`'s `background: #f1c40f;` works via CSS specificity — two classes beat one, no `!important` needed.)

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test`
Expected: PASS, all 264 tests green (this task touches no test-covered code — pure DOM/CSS).

- [ ] **Step 6: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: add wind-up color, parry-zone highlight, and key-hint to battle screen"
```

---

### Task 4: Manual verification and CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the fully-wired feature from Tasks 1-3.
- Produces: no code interfaces — this task is verification plus documentation.

This task's manual-verification steps should be performed directly by whoever is driving implementation (via a real browser, e.g. claude-in-chrome tooling), not delegated to a code-only subagent — this codebase has no automated coverage for `battleScreen.js`'s live behavior, and "I read the code and it looks right" is not equivalent to confirming the feature actually works in play.

- [ ] **Step 1: Start the app locally**

Serve the repo root with any static file server (e.g. `python3 -m http.server <port>` from the repo root, then open `http://localhost:<port>/index.html`), or whatever local-serving approach is already established for this project.

- [ ] **Step 2: Manual verification — an unparried wind-up behaves exactly like today's combat**

Start or continue a battle. Let a monster's wind-up complete without pressing `s` or clicking the bar. Confirm: the hit lands, the log line reads `"${monster.name} hits you for ${damage}."` (or the crit variant), and the player's HP drops by the expected amount — i.e., behavior is indistinguishable from combat before this feature existed.

- [ ] **Step 3: Manual verification — a successful parry**

Time a press of `s` (or a click on the monster's ATB bar) to land inside the last 20% of the wind-up (the bar should visibly turn red/orange with a highlighted zone once Task 3's polish is in place). Confirm: the player's HP does NOT drop, the monster's HP drops by roughly half of what the incoming hit would have been, the log line reads `"You parry ${monster.name}'s attack and strike back for ${amount}!"`, and the monster's ATB bar resets to empty afterward (not partially full).

- [ ] **Step 4: Manual verification — a missed parry attempt**

Press `s` clearly too early (well before the last 20% of the bar). Confirm: the hit lands on the player exactly as in Step 2 — no special penalty beyond the miss itself.

- [ ] **Step 5: Manual verification — Attack/abilities remain usable during a monster wind-up**

While a monster's wind-up bar is visibly counting down, click Attack (or press `a`) and confirm it works normally — the wind-up continues counting down in the background, unaffected.

- [ ] **Step 6: Manual verification — no cross-triggering with the ability timing meter**

If the player's level unlocks at least one ability: trigger a damage ability (starting its own Space/Enter timing meter) at the same time a monster wind-up is active. Confirm pressing Space/Enter only resolves the ability's own meter (never the parry), and pressing `s` only resolves the parry (never the ability meter) — the two must never cross-trigger each other.

- [ ] **Step 7: Add the CHANGELOG entry**

In `CHANGELOG.md`, under `## [Unreleased]` → `### Added`, add an entry describing the shipped feature (see the existing entries in that section for tone/format). Cover: monster attacks now have a visible wind-up before landing; a parry-able zone near the end of the wind-up lets the player press `s` (or click the bar) to fully negate the hit and reflect half the incoming damage straight back at the monster, bypassing its defense; unlimited attempts, no cooldown.

- [ ] **Step 8: Commit the CHANGELOG entry**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG entry for the parry mechanic"
```

---

## Self-Review Notes

- **Spec coverage:** The spec's "Mechanics" section (wind-up timing, parry input, zone bounds, damage/negation math, ATB-reset-not-knockback) is covered by Task 1 (pure math) + Task 2 (wiring). The "Interaction with the ability timing meter" section is covered by Task 2 Step 8 (separate key, no shared state) and verified in Task 4 Step 6. The "Data model" section's exact function signatures are Task 1. The "Wiring changes" section's `battleScreen.js` bullets map to Task 2 (mechanic) and Task 3 (visual/CSS) respectively. The "Testing" section's `parry.test.js` cases are Task 1's tests; its manual-verification bullets are Task 4 Steps 2-6.
- **Placeholder scan:** No TBD/TODO; every step has literal code or an exact manual procedure.
- **Type consistency:** `{ active, elapsedMs }` windup shape, `{ damage, isCrit }` from `rollIncomingDamage`, and `{ monsterHp, monsterAtb, reflectedDamage }` from `resolveParrySuccess` are used identically across Task 1's implementation, its tests, and Task 2's `resolveMonsterWindup` — no renaming drift. `elements.monsterAtbBar` and `elements.parryHint` are introduced in Task 2/Task 3 respectively and referenced with the same names in both the element-registration step and the functions that use them.
- **Ordering:** Task 2 depends on Task 1 (imports its functions) — correctly sequenced after. Task 3 depends on Task 2 (`elements.monsterAtbBar`, `monsterWindup`, `updateAtbBars`'s windup-aware width calculation) — correctly sequenced after. Task 4 depends on all three being functionally complete.
