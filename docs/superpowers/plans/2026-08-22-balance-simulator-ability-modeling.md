# Balance Simulator Ability Modeling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `scripts/simulate-balance.js` to model the real ability rotation (Stab/Chop, Slash/Sweep combo lanes, Super Scream, post-exploit-fix Attack streak/cooldown) instead of plain-Attack-only, then produce a real diagnostic baseline report across every existing matchup plus all 3 boss tiers.

**Architecture:** A new pure decision function (`chooseAction`) picks what the simulated player does each tick, following a fixed priority order (free buff → primed combo payoff → best ready ability → Attack → nothing). `simulate-balance.js`'s battle loop calls it each tick and resolves the chosen action through the exact same shared functions the real game uses (`resolveAbilityUse`, `resolvePlayerAttack`, `tickCooldowns`, `tickBuff`) — no combat math is reimplemented, only the choice of what to do is new. `chooseAction` lives in its own file specifically so it can be unit-tested in isolation without triggering the stochastic simulator's side effects (it prints a full report on load today via an unconditional `main()` call).

**Tech Stack:** Plain Node.js (`node --test`), ES modules — matches the rest of this repo, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-balance-pass-design.md` (Phase A — this plan implements Phase A only; Phase B's actual tuning is a separate follow-up plan once this one's report is in hand, per the spec's explicit two-phase, data-driven structure).

## Global Constraints

- No changes to any shipped game file (`js/**`) in this plan — everything here is additive to `scripts/simulate-balance.js` and a new sibling module, plus one new test file. The real game is untouched.
- No monster-stat changes anywhere (per the spec's "player-power only" scope).
- `resolveAbilityUse`/`resolvePlayerAttack`/`tickCooldowns`/`tickBuff`/`activateBuff`/`createBuffState`/`getUnlockedAbilities` are called exactly as the real game calls them — never reimplemented.
- `npm run test` must stay green after every task.

---

### Task 1: `chooseAction` policy module, with unit tests

**Files:**
- Create: `scripts/simulateAbilityPolicy.js`
- Test: `tests/simulateAbilityPolicy.test.js`

**Interfaces:**
- Consumes: `getUnlockedAbilities` from `js/systems/abilities.js` (existing, unchanged).
- Produces: `chooseAction({ level, cooldowns, comboState, buffActive, ready, attackOnCooldown })` → `{ kind: 'ability', id: string } | { kind: 'attack' } | { kind: 'none' }`. `cooldowns` and `comboState` are plain objects keyed by ability id, same shape `battleScreen.js` already uses. Task 2 depends on this exact signature and return shape.

- [ ] **Step 1: Write the failing tests**

Create `tests/simulateAbilityPolicy.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../scripts/simulateAbilityPolicy.js';

test('chooseAction attacks when nothing is unlocked yet (level 1)', () => {
  const action = chooseAction({
    level: 1, cooldowns: {}, comboState: {}, buffActive: false,
    ready: true, attackOnCooldown: false,
  });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction uses Super Scream when unlocked, off cooldown, and not already active', () => {
  const action = chooseAction({
    level: 10, cooldowns: {}, comboState: {}, buffActive: false,
    ready: false, attackOnCooldown: false,
  });
  assert.deepEqual(action, { kind: 'ability', id: 'superScream' });
});

test('chooseAction does not re-trigger Super Scream while its buff is already active', () => {
  const action = chooseAction({
    level: 10, cooldowns: {}, comboState: {}, buffActive: true,
    ready: true, attackOnCooldown: false,
  });
  // Falls through to the best ready damage ability instead (sweep is the
  // highest-unlocked damage ability at level 10).
  assert.deepEqual(action, { kind: 'ability', id: 'sweep' });
});

test('chooseAction fires a primed combo payoff even when not ready (the instant-cast bypass)', () => {
  const action = chooseAction({
    level: 4, cooldowns: {}, comboState: { chop: true }, buffActive: false,
    ready: false, attackOnCooldown: false,
  });
  assert.deepEqual(action, { kind: 'ability', id: 'chop' });
});

test('chooseAction ignores a primed payoff that is still on cooldown', () => {
  const action = chooseAction({
    level: 4, cooldowns: { chop: 3000 }, comboState: { chop: true }, buffActive: false,
    ready: false, attackOnCooldown: false,
  });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction picks the highest-unlocked ready damage ability when nothing is primed', () => {
  const action = chooseAction({
    level: 6, cooldowns: {}, comboState: {}, buffActive: false,
    ready: true, attackOnCooldown: false,
  });
  // Level 6 unlocks stab/chop/slash - slash has the highest unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'slash' });
});

test('chooseAction skips damage abilities that are on cooldown even if ready', () => {
  const action = chooseAction({
    level: 6, cooldowns: { slash: 2000 }, comboState: {}, buffActive: false,
    ready: true, attackOnCooldown: false,
  });
  // slash is excluded (on cooldown); of the remaining unlocked candidates
  // (stab, chop), chop has the higher unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'chop' });
});

test('chooseAction attacks when ready but every unlocked ability is on cooldown', () => {
  const action = chooseAction({
    level: 4, cooldowns: { stab: 1000, chop: 1000 }, comboState: {}, buffActive: false,
    ready: true, attackOnCooldown: false,
  });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction does nothing when not ready, nothing primed, and Attack is on cooldown', () => {
  const action = chooseAction({
    level: 4, cooldowns: {}, comboState: {}, buffActive: false,
    ready: false, attackOnCooldown: true,
  });
  assert.deepEqual(action, { kind: 'none' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: FAIL — `Cannot find module '../scripts/simulateAbilityPolicy.js'`

- [ ] **Step 3: Write the implementation**

Create `scripts/simulateAbilityPolicy.js`:

```js
import { getUnlockedAbilities } from '../js/systems/abilities.js';

/**
 * Decides what the simulated player does on one tick, in priority order:
 *   1. Super Scream, if unlocked/off cooldown/not already active - free and
 *      strictly beneficial, so a reasonable player always takes it.
 *   2. A primed combo payoff (Chop/Sweep) that's off its own cooldown - the
 *      biggest available action, and instant-cast (bypasses `ready`) per the
 *      real combo-priming rules.
 *   3. Otherwise, if the swing timer is ready, the highest-unlocked damage
 *      ability that's off cooldown.
 *   4. Otherwise, Attack - unless it's still on its own short cooldown, in
 *      which case there's nothing to do this tick.
 *
 * Pure and side-effect-free on purpose: this is unit-tested directly, kept
 * in its own module so importing it never runs simulate-balance.js's own
 * unconditional report-printing `main()`.
 */
export function chooseAction({ level, cooldowns, comboState, buffActive, ready, attackOnCooldown }) {
  const unlocked = getUnlockedAbilities(level);
  const offCooldown = (id) => (cooldowns[id] || 0) <= 0;

  const superScream = unlocked.find((a) => a.type === 'buff');
  if (superScream && offCooldown(superScream.id) && !buffActive) {
    return { kind: 'ability', id: superScream.id };
  }

  const primedPayoff = unlocked.find(
    (a) => a.comboRole === 'payoff' && comboState[a.id] && offCooldown(a.id)
  );
  if (primedPayoff) {
    return { kind: 'ability', id: primedPayoff.id };
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/simulateAbilityPolicy.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm run test`
Expected: all tests pass (previous 300 + 9 new = 309)

- [ ] **Step 6: Commit**

```bash
git add scripts/simulateAbilityPolicy.js tests/simulateAbilityPolicy.test.js
git commit -m "feat: add ability-choice policy for the balance simulator, with tests"
```

---

### Task 2: Wire the policy into `simulate-balance.js`'s battle loop

**Files:**
- Modify: `scripts/simulate-balance.js`

**Interfaces:**
- Consumes: `chooseAction` from Task 1 (exact signature above). `tickCooldowns`, `createBuffState`, `activateBuff`, `tickBuff`, `resolveAbilityUse` from `js/systems/abilities.js` (existing, unchanged). `attackStreakMultiplier`, `attackKnockbackMultiplier` from `js/systems/combat.js` (existing, unchanged - shipped with the exploit fix).
- Produces: `simulateBattle`'s return shape is unchanged (`{ outcome, hpLeft, potionsUsed, ticks }`) - Task 3/4 don't need to know about the internal policy state.

- [ ] **Step 1: Update the imports**

In `scripts/simulate-balance.js`, change:

```js
import { tickGauge, isReady, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse } from '../js/systems/combat.js';
```

to:

```js
import { tickGauge, isReady, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, attackStreakMultiplier, attackKnockbackMultiplier } from '../js/systems/combat.js';
import { ABILITIES, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveAbilityUse } from '../js/systems/abilities.js';
import { chooseAction } from './simulateAbilityPolicy.js';
```

- [ ] **Step 2: Add the timing-hit-rate constant**

Near the top of the file, alongside the existing `MAX_TICKS`/`POTION_THRESHOLD` constants:

```js
// Stands in for a human's real meter timing, since the simulator has no
// input timing to model. 0.7 = a reasonably-attentive player hits the
// sweet spot most of the time, not always. Only setup abilities (Stab/
// Slash) still have the timing meter post-combo-rework - payoffs (Chop/
// Sweep) never roll this. See docs/superpowers/specs/2026-08-22-balance-
// pass-design.md for why 0.7 and what to re-check if results feel overly
// sensitive to it.
const TIMING_HIT_RATE = 0.7;
const ATTACK_COOLDOWN_MS = 500; // matches battleScreen.js's ATTACK_COOLDOWN_MS
```

- [ ] **Step 3: Replace the player-action block in `simulateBattle`**

Find this block in `simulateBattle(build, monsterStats)`:

```js
function simulateBattle(build, monsterStats) {
  const player = {
    hp: build.maxHp, maxHp: build.maxHp,
    attack: build.attack, defense: build.defense, speed: build.speed, atb: 0,
  };
  const monster = {
    hp: monsterStats.hp, maxHp: monsterStats.hp,
    attack: monsterStats.attack, defense: monsterStats.defense, speed: monsterStats.speed, atb: 0,
  };

  let potions = build.potions;
  let potionsUsed = 0;

  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    player.atb = tickGauge(player.atb, player.speed, 1);
    monster.atb = tickGauge(monster.atb, monster.speed, 1);

    if (potions > 0 && player.hp < player.maxHp * POTION_THRESHOLD) {
      potions--;
      potionsUsed++;
      player.hp = resolvePotionUse(player, ITEMS.potion.heal).playerHp;
    }

    if (isReady(monster.atb)) {
      const result = resolveMonsterAttack(monster, player);
      player.hp = result.playerHp;
      player.atb = result.playerAtb;
      monster.atb = result.monsterAtb;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
    }

    if (isReady(player.atb)) {
      const result = resolvePlayerAttack(player, monster);
      monster.hp = result.monsterHp;
      monster.atb = result.monsterAtb;
      player.atb = result.playerAtb;
      if (monster.hp <= 0) {
        return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
      }
    }
  }
  return { outcome: 'stalemate', hpLeft: player.hp / player.maxHp, potionsUsed, ticks: MAX_TICKS };
}
```

Replace the whole function with:

```js
function simulateBattle(build, monsterStats) {
  const player = {
    hp: build.maxHp, maxHp: build.maxHp,
    attack: build.attack, defense: build.defense, speed: build.speed, atb: 0,
  };
  const monster = {
    hp: monsterStats.hp, maxHp: monsterStats.hp,
    attack: monsterStats.attack, defense: monsterStats.defense, speed: monsterStats.speed, atb: 0,
  };

  let potions = build.potions;
  let potionsUsed = 0;

  // Real-time-style state, same shape battleScreen.js keeps at module scope
  // - reset fresh per simulated battle here since each trial is independent.
  let abilityCooldowns = {};
  let comboState = {};
  let buffState = createBuffState();
  let attackStreak = 0;
  let attackCooldownMs = 0;

  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    player.atb = tickGauge(player.atb, player.speed, 1);
    monster.atb = tickGauge(monster.atb, monster.speed, 1);
    if (isReady(player.atb)) attackStreak = 0;
    attackCooldownMs = Math.max(0, attackCooldownMs - 300);
    abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
    buffState = tickBuff(buffState, 300);

    if (potions > 0 && player.hp < player.maxHp * POTION_THRESHOLD) {
      potions--;
      potionsUsed++;
      player.hp = resolvePotionUse(player, ITEMS.potion.heal).playerHp;
    }

    if (isReady(monster.atb)) {
      const result = resolveMonsterAttack(monster, player);
      player.hp = result.playerHp;
      player.atb = result.playerAtb;
      monster.atb = result.monsterAtb;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
    }

    const action = chooseAction({
      level: build.level,
      cooldowns: abilityCooldowns,
      comboState,
      buffActive: buffState.active,
      ready: isReady(player.atb),
      attackOnCooldown: attackCooldownMs > 0,
    });

    if (action.kind === 'ability') {
      const ability = ABILITIES.find((a) => a.id === action.id);
      if (ability.type === 'buff') {
        buffState = activateBuff(ability);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
      } else {
        const timingHit = ability.comboRole === 'setup' ? Math.random() < TIMING_HIT_RATE : false;
        const comboBonusActive = !!comboState[ability.id];
        const result = resolveAbilityUse(player, monster, ability, buffState.active, timingHit, comboBonusActive);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        player.atb = result.playerAtb;
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        comboState[ability.id] = false;
        if (ability.comboPartnerId && (ability.comboRole === 'payoff' || timingHit)) {
          comboState[ability.comboPartnerId] = true;
        }
        if (monster.hp <= 0) {
          return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
        }
      }
    } else if (action.kind === 'attack') {
      const result = resolvePlayerAttack(
        player, monster, Math.random,
        attackStreakMultiplier(attackStreak), attackKnockbackMultiplier(attackStreak)
      );
      attackStreak += 1;
      attackCooldownMs = ATTACK_COOLDOWN_MS;
      monster.hp = result.monsterHp;
      monster.atb = result.monsterAtb;
      player.atb = result.playerAtb;
      if (monster.hp <= 0) {
        return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
      }
    }
  }
  return { outcome: 'stalemate', hpLeft: player.hp / player.maxHp, potionsUsed, ticks: MAX_TICKS };
}
```

Note what's deliberately NOT modeled here (matches the spec's stated scope): Slash's delayed bleed tick, and the parry wind-up (already noted as unmodeled in this file's existing header comment before this plan). Both are known simplifications, not oversights - re-check if Phase B's numbers look off specifically for Slash-heavy builds.

- [ ] **Step 4: Manual spot-check (no automated test - matches the file's existing "stochastic report, no assertions" nature)**

Run: `node scripts/simulate-balance.js --trials 200`

Confirm by reading the output:
- The `L1 (starter sword only, no armor)` build's numbers move (it now uses Stab/Chop from level 2/4 onward as it levels within a multi-level build like `L5`/`L7`/`L9` - single-digit trial win rates should generally trend upward vs. a hypothetical plain-Attack-only run, since abilities add real damage).
- No crash, no `NaN` in the output table.

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: all tests still pass (309) - Task 1's tests are unaffected by this change since they only import the policy module, not `simulate-balance.js` itself.

- [ ] **Step 6: Commit**

```bash
git add scripts/simulate-balance.js
git commit -m "feat: model the real ability rotation in the balance simulator"
```

---

### Task 3: Add all 3 boss tiers to the dragon matchup

**Files:**
- Modify: `scripts/simulate-balance.js`

**Interfaces:**
- Consumes: `getBossTierStats(baseMonster, tier)` from `js/systems/bossTiers.js` (existing, unchanged) - returns `{ hp, attack, defense, speed, xp }`.
- Produces: the `monsters` map built in `main()` gains `dragonTier0`/`dragonTier1`/`dragonTier2` keys instead of (or alongside) the flat `dragon` key, each mapped to a real display name for the report table.

- [ ] **Step 1: Update the import**

Add to the top of `scripts/simulate-balance.js`:

```js
import { getBossTierStats, MAX_BOSS_TIER } from '../js/systems/bossTiers.js';
```

- [ ] **Step 2: Replace the `MATCHUPS` handling for the dragon**

Find:

```js
const MATCHUPS = ['boar', 'bat', 'snake', 'goblin', 'direWolf', 'spider', 'orc', 'wraith', 'dragon'];
```

Replace with:

```js
const MATCHUPS = ['boar', 'bat', 'snake', 'goblin', 'direWolf', 'spider', 'orc', 'wraith'];
const BOSS_TIER_MATCHUP_IDS = Array.from({ length: MAX_BOSS_TIER + 1 }, (_, tier) => `dragonTier${tier}`);
```

- [ ] **Step 3: Build the boss-tier monster stats in `main()`**

Find this block in `main()`:

```js
  const monsters = {};
  for (const id of MATCHUPS) {
    monsters[id] = { ...MONSTERS[id], ...(overrides[id] || {}) };
  }
```

Replace with:

```js
  const monsters = {};
  for (const id of MATCHUPS) {
    monsters[id] = { ...MONSTERS[id], ...(overrides[id] || {}) };
  }
  for (const [tier, id] of BOSS_TIER_MATCHUP_IDS.entries()) {
    const tierStats = getBossTierStats(MONSTERS.dragon, tier);
    monsters[id] = { ...MONSTERS.dragon, ...tierStats, name: `Dragon (tier ${tier})`, ...(overrides[id] || {}) };
  }
```

- [ ] **Step 4: Include the boss tiers in every place `MATCHUPS` is iterated for output**

Find both remaining loops over `MATCHUPS` in `main()` (the "Monster stats under test" printout and the main report table's inner loop over `for (const id of MATCHUPS)`), and change each to iterate `[...MATCHUPS, ...BOSS_TIER_MATCHUP_IDS]` instead of `MATCHUPS` alone. There are two such loops - the stats printout and the report table.

- [ ] **Step 5: Manual spot-check**

Run: `node scripts/simulate-balance.js --trials 200`

Confirm the output table now includes three separate `Dragon (tier 0)` / `Dragon (tier 1)` / `Dragon (tier 2)` rows per build, with tier 2's win rate visibly lower than tier 0's for the same build (since tier 2 monster stats are stronger per `getBossTierStats`).

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: all tests still pass (309)

- [ ] **Step 7: Commit**

```bash
git add scripts/simulate-balance.js
git commit -m "feat: simulate all 3 boss tiers instead of only the dragon's base stats"
```

---

### Task 4: Produce and record the real baseline report

**Files:**
- Modify: `docs/superpowers/specs/2026-08-22-balance-pass-design.md` (append findings)

**Interfaces:**
- Consumes: the fully-extended `scripts/simulate-balance.js` from Tasks 1-3.
- Produces: a checked-in "Phase A findings" addendum to the spec, giving Phase B's future planning pass real numbers to start from instead of re-running the simulator cold.

- [ ] **Step 1: Run the real report**

Run: `node scripts/simulate-balance.js --trials 3000 | tee /tmp/balance-baseline.txt`

(3000 trials matches this project's established precedent for "real" balance findings, per every prior simulator-backed decision in the CHANGELOG.)

- [ ] **Step 2: Read the output and identify the headline numbers**

For each of these, read the report table and note the actual values:
- Win rate for `reasonable L7 (iron sword + full cloth)` against `boar`/`bat`/`snake`/`goblin` (near-town) and `direWolf`/`spider` (far-corner).
- Win rate for `prepared L9 (full iron)` against `orc`/`wraith` (dungeon-tier) and all 3 `Dragon (tier N)` rows.
- The delta between `L1 (starter sword only, no armor)` and `L1 (starter sword + cloth tunic)` against near-town monsters - this is the concrete "does gear matter" measurement the spec calls for.
- Average potions used (`avgPotions` column) for the mid-tier builds - this is the concrete "does potion use matter" measurement.

- [ ] **Step 3: Append the findings to the spec**

Add a new section at the end of `docs/superpowers/specs/2026-08-22-balance-pass-design.md`:

```markdown
## Phase A findings (real data, recorded YYYY-MM-DD)

Ran `node scripts/simulate-balance.js --trials 3000` against the fully
ability-modeled simulator (Tasks 1-3 of the implementation plan). Full
output archived at [wherever /tmp/balance-baseline.txt got saved, or
paste the relevant rows directly here].

- [Fill in with the actual win rates/deltas/potion-usage numbers read in
  Step 2 - this is the concrete input Phase B's follow-up planning pass
  starts from.]

Phase B (actual tuning of ability multipliers/cooldowns, XP curve, and
conditionally gear/potion stats) is a separate follow-up plan, per this
spec's original two-phase structure.
```

Fill in the bracketed parts with the real numbers from Step 2 - this step is not complete until real numbers replace the placeholder text (the placeholder above is for this plan document only, describing what to do; the committed spec addendum itself must contain no placeholders, per this project's own no-placeholder convention for shipped docs).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-22-balance-pass-design.md
git commit -m "docs: record Phase A balance-simulator baseline findings [skip ci]"
```

---

## Self-Review Notes

- **Spec coverage:** Phase A's simulator-extension requirement (spec section "Phase A — see the real numbers") is covered by Tasks 1-3; the diagnostic-report requirement is covered by Task 4. Phase B is explicitly out of this plan's scope, matching the spec's own two-phase structure - it becomes a new plan once Task 4's real numbers exist.
- **Placeholder scan:** Task 4's spec-addendum template contains bracketed fill-in text, but Step 3 explicitly requires those brackets be replaced with real numbers before committing - the plan step itself is fully specified (exact command, exact section header, exact what-to-read), only the *outcome* (which depends on a simulation run that hasn't happened yet) is deferred, which is unavoidable for a data-collection task.
- **Type/signature consistency:** `chooseAction`'s signature and return shape (Task 1) match exactly what Task 2 calls it with. `simulateBattle`'s external signature and return shape (Task 2) are unchanged, so Task 3/4 don't need to know about its internals.
