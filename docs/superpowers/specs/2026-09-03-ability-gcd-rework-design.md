# Ability global-cooldown rework — design

**Status:** approved, ready for planning
**Raised:** 2026-09-03, in the same session that shipped the in-battle
mechanic explainer system (0.22.0). See `docs/superpowers/BACKLOG.md`'s
"Combat pass ideas" section for the raw ask this replaces.

## Motivation

Timothy's own words: "I meant to remove our 1,2,3,4 abilities from the
swing timer. I actually don't even think we need a swing timer any longer
except for when we do the ability that needs the timing minigame to do
more damage if you time it right. Everything else is just on a 1 second
global cooldown which is sped up with whatever our hate/agility/speed stat
is."

Today, Impale/Sever/Lacerate/Faultline (the four abilities bound to keys
1-4) are gated by `isReady(playerCombatant.atb)` — a shared 0-100 gauge
that fills at the player's speed stat (`tickGauge`, `ATB_MAX` in
`js/systems/combat.js`) and resets to 0 after any player action. Waiting
for that gauge to refill is "the swing timer." This rework removes it for
abilities 1-4, replacing it with a flat, speed-scaled cooldown shared
across all of them.

## Goals

- Abilities 1-4 stop waiting on the player ATB gauge.
- A shared "global cooldown" (GCD) applies across all 4 after any one of
  them is used, scaled down by the player's speed stat.
- Start with all 4 abilities sharing exactly the bare GCD (no individual
  cooldown on top); use the balance simulator to find out which (if any)
  need more room, rather than guessing up front.
- Check whether monster stats need retuning now that ability damage can
  come out faster than before.

## Non-goals / explicitly unchanged

- **Attack** keeps its existing spam-decay system (`attackStreakMultiplier`,
  `attackCooldownMsForStreak`, the damage floor) completely as-is — Timothy
  wants to keep it around for a future "clear the decay" or "buff Attack"
  mechanic. It does not participate in the new ability GCD in either
  direction: using an ability never touches Attack's cooldown, and vice
  versa.
- **Monsters'** own ATB/windup timing (`tickGauge`/`isReady` on
  `monsterCombatants`) is untouched — only the player's ability-readiness
  check is changing.
- **Super Scream** stays exactly as it is today: bound to Space, exempt
  from any readiness gate via `alwaysReady`, its own fixed 30s cooldown.
  It's not one of "1,2,3,4" and isn't part of the shared-GCD propagation.
- **Lacerate's retrigger** (the sweet-spot re-press for a buff) is
  unaffected — it's Timothy's explicit exception ("the ability that needs
  the timing minigame to do more damage if you time it right"). It still
  layers on top of Lacerate's own cooldown, whatever that ends up being
  after balance testing.
- **Parry's** own windup/timing minigame is untouched.
- The mid-battle attack-falloff explainer shipped this session
  (`js/screens/battleScreen.js`'s `openFalloffExplainer`, gated behind
  `mechanicExplainersBeta`) is built entirely on Attack's decay system, so
  it needs no changes here.

## Mechanism

**Approach chosen: reuse the existing per-ability cooldown field**, rather
than introduce a separate GCD timer. When any of the 4 abilities resolves:

1. Compute the current GCD duration from the player's speed via a new
   pure function in `js/systems/combat.js`:

   ```js
   export const ABILITY_GCD_BASE_MS = 1150;
   export const ABILITY_GCD_MS_PER_SPEED = 30;
   export const ABILITY_GCD_FLOOR_MS = 500;

   export function abilityGcdMsForSpeed(speed) {
     return Math.max(ABILITY_GCD_FLOOR_MS, ABILITY_GCD_BASE_MS - speed * ABILITY_GCD_MS_PER_SPEED);
   }
   ```

   At the player's starting speed (5), this is exactly 1000ms. It floors at
   500ms around speed 22 (just past `SPEED_DAMAGE_BONUS_THRESHOLD`, 20).
   These three constants are a starting point, not final — see "Balance
   and retuning workflow" below.

2. A new pure function in `js/systems/abilities.js` applies the GCD to
   every unlocked non-buff ability at once, letting an ability's own
   `overrideCooldownMs` (new field, unset/0 for all 4 to start) act as a
   floor for itself specifically:

   ```js
   export function applyAbilityGcd(abilityCooldowns, unlockedAbilities, usedAbilityId, gcdMs) {
     const next = { ...abilityCooldowns };
     for (const ability of unlockedAbilities) {
       if (ability.type === 'buff') continue; // Super Scream stays independent
       const floor = ability.id === usedAbilityId ? (ability.overrideCooldownMs || 0) : 0;
       const target = Math.max(gcdMs, floor);
       next[ability.id] = Math.max(next[ability.id] || 0, target);
     }
     return next;
   }
   ```

   `js/screens/battleScreen.js`'s `playerUseAbility` calls this (for the
   damage-ability branches only — buff/Lacerate-retrigger-press stay on
   their own existing paths) instead of the current single-line
   `abilityCooldowns[abilityId] = ability.cooldownMs;`.

   **Cooldown-percentage tracking:** today's `cooldownPct` (in
   `abilityButtonEntries()`) divides `abilityCooldowns[id]` by the ability's
   static `cooldownMs` config value. Under this design the duration actually
   applied to a given ability varies per use (sometimes the GCD, sometimes
   its own `overrideCooldownMs`, whichever was larger) — dividing by a fixed
   config value would show a wrong wipe animation. Mirror the pattern
   `attackCooldownMs`/`attackCooldownTotalMs` already uses for Attack: track
   a parallel `abilityCooldownTotals` map (the actual duration applied,
   returned alongside `abilityCooldowns` from `applyAbilityGcd`, or set
   next to it in `playerUseAbility`) and compute
   `cooldownPct = cooldownRemaining / abilityCooldownTotals[id]`.

3. `canUseAbility`'s `ready` param (currently `isReady(playerCombatant.atb)`)
   is removed — cooldown state (now GCD-aware) is the only gate left for
   the 4 abilities, same as it already is for Attack.

4. `playerCombatant.atb`, `ATB_MAX`, and `tickGauge` stop being read or
   written for the player anywhere in `battleScreen.js` (monsters keep
   their own separate `.atb`, untouched).

## UI changes

- The player's ATB bar (`battle-hero-atb-fill`, the player half of
  `updateAtbBars()`) is removed — it no longer represents anything once
  the player stops using the gauge. Monster ATB bars are untouched.
- Each ability button's existing cooldown-wipe animation (`cooldownPct` in
  `actionButtonHtml`) becomes the sole "when can I act again" indicator,
  now also reflecting GCD time on abilities that aren't individually on a
  longer cooldown. No new visual language needed.

## Balance and retuning workflow

`scripts/simulate-balance.js` already drives the real
`combat.js`/`abilities.js` code headlessly and reports win rates per
dungeon/boss tier — it's the tool for the "do we need to retune enemies"
question, not guesswork. Its own header warns that
`scripts/simulateAbilityPolicy.js`'s `chooseAction()` (and the
`ready: isReady(player.atb)` wiring inside `simulate-balance.js` itself)
must be hand-updated whenever ability-readiness logic changes, or the
report is simulating stale rules.

Order of operations for the implementation plan:

1. Capture a baseline `simulate-balance.js` report on current `main`
   (default trial count) before touching any code, so there's something
   real to diff against.
2. Implement the mechanism above.
3. Update `simulateAbilityPolicy.js`'s `chooseAction()` and
   `simulate-balance.js`'s own ability-readiness check to use
   `abilityGcdMsForSpeed`/`applyAbilityGcd` instead of `isReady(player.atb)`.
4. Re-run the simulator at the same trial count and compare against the
   baseline, tier by tier.
5. Only retune monster HP/attack/defense where win rates clearly moved out
   of an acceptable range (using `--set` overrides to explore candidates,
   same workflow the file's own header already documents) — not
   preemptively, and not for tiers that didn't move.
6. Separately, look at per-tier DPS/ability-usage output for any of the 4
   abilities that stands out (e.g. clearly dominates a rotation, or never
   gets used) as a candidate for its own `overrideCooldownMs` above the
   bare GCD. This is a judgment call to make together from the simulator's
   actual numbers, not decided in this spec.

## Testing

- Unit tests for `abilityGcdMsForSpeed` (`tests/combat.test.js`) and
  `applyAbilityGcd` (`tests/abilities.test.js`) — pure functions, TDD as
  normal.
- `tests/battleScreenDom.test.js` updates: remove/replace any assertions
  tied to the player ATB bar or `isReady(playerCombatant.atb)` gating
  abilities; add coverage that using one ability puts the *other* 3 on
  cooldown too (the actual new behavior), and that Attack/Super
  Scream/Lacerate's retrigger are all unaffected.
- `npm run test` must stay green throughout, per this repo's standing
  rules.

## Open questions (deferred to the implementation plan / balance pass, not this spec)

- Final values for `ABILITY_GCD_BASE_MS` / `ABILITY_GCD_MS_PER_SPEED` /
  `ABILITY_GCD_FLOOR_MS` — the numbers above are a reasoned starting point
  (1s at starting speed, floors around speed 22), to be confirmed or
  adjusted from the simulator's output.
- Whether any ability ends up with an `overrideCooldownMs` above the bare
  GCD, and what value — explicitly a "see what the data says" decision.
