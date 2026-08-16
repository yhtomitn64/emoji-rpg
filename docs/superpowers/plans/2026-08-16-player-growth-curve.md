# Player Growth Curve Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the root cause of the game trivializing at higher levels — unbounded flat per-level stat growth against a static monster roster — by tapering stat gains, steepening the XP curve, and switching to a partial level-up heal, all starting exactly at level 10, with levels 2-9 left completely untouched.

**Architecture:** This is a single-file rework of `js/systems/leveling.js`'s two exported functions (`xpForLevel`, `applyXp`) plus a small new internal helper for the tiered stat gains. No other file changes — no DOM, no screens, no save-schema changes, no wiring. Correctness is validated two ways: exact-value unit tests (the formulas are deterministic, so specific numbers can be asserted directly) and a real run of the project's existing `scripts/simulate-balance.js`, which drives these same functions against the real monster data to confirm the intended difficulty shift actually shows up in simulated fights, not just in isolated formula output.

**Tech Stack:** Vanilla JS ES modules, no build tooling, no npm deps. Tests via Node's built-in `node:test` + `node:assert/strict`, run with `npm test`.

## Global Constraints

- Levels 2-9 must be byte-identical to today's behavior: `xpForLevel` unchanged, stat gains `+4 maxHp/+2 attack/+1 defense/+1 speed` per level, full heal on level-up. The existing pre-rework tests for level 1→2 must keep passing unmodified — this is the concrete proof the "1-9 unchanged" guarantee holds.
- From level 10 on: stat gains become `+2 maxHp/+1 attack/+1 defense` per level, plus `+1 speed` only on even levels (odd levels get `+0` speed).
- `xpForLevel(level)` for `level < 10` stays exactly `Math.round(10 * Math.pow(level, 1.5))`. For `level >= 10`, it becomes `Math.round(base * (1 + (level - 9) * 0.08))` where `base` is that same unchanged formula — a compounding ramp, not a discontinuous exponent swap, so there's no XP cliff exactly at level 10.
- Level-up HP recovery: for a level-up that reaches level `< 10`, full heal (`hp = maxHp`), unchanged. For a level-up that reaches level `>= 10`, partial heal: `hp = Math.round(oldHp + (newMaxHp - oldHp) * 0.5)`, using the player's HP from *before* this level-up and the *new* (post-level-up) max.
- Multi-level XP awards (the existing `while` loop can cross several levels in one `applyXp` call) decide full-vs-partial heal ONCE, after the loop, based on the *final* level reached — matching the existing single-computation-after-the-loop shape already in the code today.
- No save-schema changes, no migration needed — only the formulas change, not the player object's shape.

---

### Task 1: Rework `js/systems/leveling.js`

**Files:**
- Modify: `js/systems/leveling.js`
- Modify: `tests/leveling.test.js`

**Interfaces:**
- Produces: `xpForLevel(level)` — same signature as today, new piecewise behavior above `level >= 10`. `applyXp(player, xpGained)` — same signature and same `{ player, leveledUp }` return shape as today; the returned `player` object has the same fields as before (`level, xp, maxHp, attack, defense, speed, hp`, plus whatever else was already on the input `player` via spread). No other module in this codebase needs to change — every caller of `applyXp`/`xpForLevel` (e.g. `js/main.js`'s `handleBattleEnd`, `scripts/simulate-balance.js`) already treats these as opaque functions and needs no changes to keep working.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/leveling.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, applyXp } from '../js/systems/leveling.js';

test('xpForLevel increases with level', () => {
  assert.ok(xpForLevel(2) > xpForLevel(1));
});

test('xpForLevel is unchanged below level 10', () => {
  assert.equal(xpForLevel(5), 112);
  assert.equal(xpForLevel(8), 226);
  assert.equal(xpForLevel(9), 270);
});

test('xpForLevel ramps up starting at level 10', () => {
  assert.equal(xpForLevel(10), 341);
  assert.equal(xpForLevel(15), 860);
});

test('applyXp accumulates xp without leveling when below threshold', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next, leveledUp } = applyXp(player, 1);
  assert.equal(leveledUp, false);
  assert.equal(next.level, 1);
  assert.equal(next.xp, 1);
});

test('applyXp levels up, increases stats, and refills hp to max (level 1->2, unchanged)', () => {
  const player = { level: 1, xp: 0, hp: 5, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const needed = xpForLevel(1);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 2);
  assert.equal(next.maxHp, 24);
  assert.equal(next.attack, 7);
  assert.equal(next.hp, next.maxHp);
});

test('applyXp can trigger multiple level ups from a large xp gain', () => {
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 0 };
  const { player: next } = applyXp(player, 1000);
  assert.ok(next.level > 2);
});

test('applyXp reaching level 9 still uses the unchanged pre-rework gains and a full heal', () => {
  const player = { level: 8, xp: 0, hp: 5, maxHp: 36, attack: 18, defense: 9, speed: 11, gold: 0 };
  const needed = xpForLevel(8);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 9);
  assert.equal(next.maxHp, 40);
  assert.equal(next.attack, 20);
  assert.equal(next.defense, 10);
  assert.equal(next.speed, 12);
  assert.equal(next.hp, next.maxHp);
});

test('applyXp reaching level 10 applies tapered gains and a partial heal, not full', () => {
  const player = { level: 9, xp: 0, hp: 10, maxHp: 40, attack: 20, defense: 10, speed: 12, gold: 0 };
  const needed = xpForLevel(9);
  const { player: next, leveledUp } = applyXp(player, needed);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 10);
  assert.equal(next.maxHp, 42);
  assert.equal(next.attack, 21);
  assert.equal(next.defense, 11);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 26);
});

test('applyXp reaching an odd level in the tapered tier grants no speed gain', () => {
  const player = { level: 10, xp: 0, hp: 30, maxHp: 42, attack: 21, defense: 11, speed: 13, gold: 0 };
  const needed = xpForLevel(10);
  const { player: next } = applyXp(player, needed);
  assert.equal(next.level, 11);
  assert.equal(next.maxHp, 44);
  assert.equal(next.attack, 22);
  assert.equal(next.defense, 12);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 37);
});

test('applyXp on a multi-level jump crossing the level-10 boundary uses partial heal based on the final level', () => {
  const player = { level: 7, xp: 0, hp: 5, maxHp: 32, attack: 16, defense: 8, speed: 10, gold: 0 };
  const total = xpForLevel(7) + xpForLevel(8) + xpForLevel(9) + xpForLevel(10);
  const { player: next, leveledUp } = applyXp(player, total);
  assert.equal(leveledUp, true);
  assert.equal(next.level, 11);
  assert.equal(next.maxHp, 44);
  assert.equal(next.attack, 22);
  assert.equal(next.defense, 12);
  assert.equal(next.speed, 13);
  assert.equal(next.hp, 25);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the new/changed assertions (xpForLevel at 10/15, the level-9/10/11/multi-jump tests) don't match today's unmodified formulas.

- [ ] **Step 3: Rework `js/systems/leveling.js`**

Replace the full contents of `js/systems/leveling.js` with:

```js
export const LATE_GAME_LEVEL_THRESHOLD = 10;
export const LATE_GAME_XP_RAMP_PER_LEVEL = 0.08;
export const LEVEL_UP_PARTIAL_HEAL_FRACTION = 0.5;

export function xpForLevel(level) {
  const base = Math.round(10 * Math.pow(level, 1.5));
  if (level < LATE_GAME_LEVEL_THRESHOLD) return base;
  return Math.round(base * (1 + (level - (LATE_GAME_LEVEL_THRESHOLD - 1)) * LATE_GAME_XP_RAMP_PER_LEVEL));
}

function statGainsForLevel(newLevel) {
  if (newLevel < LATE_GAME_LEVEL_THRESHOLD) {
    return { maxHp: 4, attack: 2, defense: 1, speed: 1 };
  }
  return { maxHp: 2, attack: 1, defense: 1, speed: newLevel % 2 === 0 ? 1 : 0 };
}

export function applyXp(player, xpGained) {
  let { level, attack, defense, speed, maxHp } = player;
  let xp = player.xp + xpGained;
  let leveledUp = false;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    const gains = statGainsForLevel(level);
    maxHp += gains.maxHp;
    attack += gains.attack;
    defense += gains.defense;
    speed += gains.speed;
    leveledUp = true;
  }

  let hp = player.hp;
  if (leveledUp) {
    hp = level >= LATE_GAME_LEVEL_THRESHOLD
      ? Math.round(player.hp + (maxHp - player.hp) * LEVEL_UP_PARTIAL_HEAL_FRACTION)
      : maxHp;
  }

  return {
    player: { ...player, level, xp, maxHp, attack, defense, speed, hp },
    leveledUp,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. `tests/leveling.test.js` now has 10 tests (up from 4 before this task); the full suite was 137 tests before this task, so it should read 143 after, with 0 failures.

- [ ] **Step 5: Validate against the real balance simulator**

Run: `node scripts/simulate-balance.js`

This script drives the real, just-reworked `applyXp`/`xpForLevel` (via its own `playerAtLevel` helper) against the real monster data — it needs no changes to pick up this rework. Compare the output to the design doc's stated expectations:

- The `prepared L9 (full iron)` and earlier builds should show **no change** from before this task (level 9 and below are untouched by this rework) — confirm their win rates and HP-left percentages match what you'd get on the pre-rework code (if in doubt, you can check out the previous commit and re-run the script to diff, but this should not be necessary since the constants are provably unchanged below level 10).
- The `veteran L11 (full iron)` build should show a **visible reduction** from its pre-rework result (100% win / 52% HP-left vs. the dragon) — some win-rate or HP-left drop, since it's now under the tapered growth for 2 levels.
- If `veteran L11` still looks nearly as dominant as before, or if it swings so far the other way that leveling past 10 stops feeling worthwhile at all, that's a signal the `LATE_GAME_XP_RAMP_PER_LEVEL` (currently `0.08`) or the tapered stat values in `statGainsForLevel` need adjusting — this script is the tool for iterating on those constants, the same way it was originally used to tune the monster stats it already contains data for.

Record the actual simulator output (both before-this-task numbers if available and after) in your task report so the whole-branch reviewer and the human can see the real before/after, not just a claim that it was run.

- [ ] **Step 6: Commit**

```bash
git add js/systems/leveling.js tests/leveling.test.js
git commit -m "feat: taper player growth curve starting at level 10"
```

---

## Self-Review Notes

- **Spec coverage:** stat-gain tapering table (Global Constraints + `statGainsForLevel`, tested at levels 9/10/11), XP ramp formula (Global Constraints + `xpForLevel`, tested at 5/8/9/10/15), partial-vs-full heal split at the level-10 boundary (tested at levels 9/10/11 and the multi-level-jump case), multi-level-jump heal decided by final level (dedicated test), levels 2-9 byte-identical to today (the unmodified level-1→2 test still passes unchanged, plus the dedicated level-9 test), simulator validation (Step 5) — all covered.
- **Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code and exact expected numeric values (independently computed and verified before writing this plan, not estimated).
- **Type consistency:** `applyXp(player, xpGained)` keeps the exact same parameter and return shape (`{ player, leveledUp }`) as today — verified no caller elsewhere in the codebase (`js/main.js`, `scripts/simulate-balance.js`) needs any change. `xpForLevel(level)` keeps the exact same single-argument signature. The three new exported constants (`LATE_GAME_LEVEL_THRESHOLD`, `LATE_GAME_XP_RAMP_PER_LEVEL`, `LEVEL_UP_PARTIAL_HEAL_FRACTION`) are used consistently within the same file and aren't referenced by name in any test (tests assert on outcomes, not on the constants directly, so the exact constant names have no cross-file coupling to get wrong).
