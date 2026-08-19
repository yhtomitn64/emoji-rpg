# Parry Mechanic — Design

## Purpose

Monster attacks currently fire the instant a monster's ATB gauge fills,
with zero player-visible warning — there is no telegraph of any kind to
react to. This build adds a **wind-up** before every monster attack and
lets the player attempt to **parry** it: land the input inside a short
window near the end of the wind-up, and the hit is fully negated and a
portion of it is reflected straight back at the monster, bypassing its
defense.

The stated goal (Timothy's own framing) is for the parry window itself to
be *easy* — the real difficulty should come from attempting it while also
juggling the ability system's own cooldowns and timing meter
(`docs/superpowers/specs/2026-08-17-combat-abilities-design.md`), not from
the parry timing being hard in isolation.

This is a balance-risky mechanic (full negation + true damage back, with
no cap, on every monster attack) shipping before the just-added ability
system has been playtested at all. Per explicit decision: ship the full
version now with every tunable number as a clearly-named constant, and
adjust those numbers later based on actual play — not guess at a cap
today with no data.

## Scope

In scope:
- A wind-up phase before every monster attack, replacing the current
  instant-fire behavior.
- A parry-able zone near the end of the wind-up; landing an input inside
  it negates the hit and reflects part of it back at the monster.
- Missing the zone (or not pressing at all) resolves as an ordinary,
  unparried hit — identical to today's behavior.
- New pure module `js/systems/parry.js` with all tunable constants
  (duration, zone bounds, reflect fraction) exported and easily changed.

Out of scope (deliberately):
- Any cap, cooldown, or diminishing-returns on parry attempts — ship
  unlimited, tune later if playtesting shows it's needed.
- Multiple monster attack types / special moves — there is currently only
  one monster attack path (`resolveMonsterAttack` in `combat.js`); this
  design wraps that single path, not a hypothetical future one.
- Multi-mob encounters — separate future backlog item.
- Any change to the player's own ATB gauge, Attack action, or the ability
  timing meter's own mechanics — those are untouched.

## Mechanics

### The wind-up

When `tick()` sees the monster's ATB gauge is ready
(`isReady(monsterCombatant.atb)`), instead of calling `monsterAttack()`
immediately as it does today, it starts a **1000ms wind-up**
(`PARRY_WINDUP_DURATION_MS`, matching the ability timing-meter's existing
duration for visual consistency between the two systems).

Critically, the wind-up is **tick-driven state, not an async pause**. The
player must remain free to Attack, use an ability, or Flee while a
monster wind-up is counting down — blocking those would remove the
"juggling" difficulty that's the entire point. The wind-up advances by
300ms on every `tick()` call alongside the player's ATB, ability
cooldowns, buff timer, and any pending delayed hit — exactly the same
tick cadence everything else in battle already uses.

The last 20% of the wind-up (`PARRY_ZONE_START_PERCENT = 80` through
`PARRY_ZONE_END_PERCENT = 100`) is the parry-able zone — the same
proportions already tuned for the ability system's own timing meter
(`TIMING_SWEET_SPOT_START`/`END` in `battleScreen.js`), reused here for
visual/mechanical consistency between the two meters the player has
already learned.

### Attempting a parry

Pressing **`s`** (chosen to avoid the already-bound `a`/`i`/`f` keys), or
clicking the monster's ATB bar directly, resolves an *active* wind-up
immediately — whichever comes first, a press or the wind-up's natural
1000ms completion:

- **Input lands inside the zone** → parry succeeds. The player takes
  **zero damage** from this hit. The monster takes
  `round(incomingDamage * PARRY_REFLECT_FRACTION)` (`PARRY_REFLECT_FRACTION
  = 0.5`) applied **directly to its HP, bypassing its defense stat
  entirely** — true damage, calculated from the raw hit the player would
  otherwise have taken, before any mitigation. The monster's ATB resets
  to 0, exactly like a normal, landed monster attack resets it — its
  attack cycle is spent whether the hit connected or was parried. (Note:
  this is deliberately *not* `ATB_KNOCKBACK`, the flat reduction applied
  when the player damages the monster mid-charge — at the moment a parry
  resolves the monster's ATB is already at 100, the value that triggered
  the wind-up in the first place, so a flat knockback would barely dent
  it and leave the monster ready to attack again almost immediately. A
  full reset is the only reading consistent with "its attack just
  happened, parried or not.")
- **Input lands outside the zone** (too early or too late) → parry fails.
  The hit lands exactly as an unparried one would (see below) — pressing
  early/late costs nothing beyond simply not landing the parry; there is
  no additional penalty for a bad attempt.
- **No input at all** → the wind-up completes naturally at 1000ms and
  resolves as an ordinary, unparried hit.

An unparried hit (missed window or no attempt) calls the existing
`monsterAttack()` function unchanged — full damage, normal ATB reset, no
new code path. This means the "normal" outcome of this feature is
byte-for-byte identical to today's combat before this feature existed.

There is no cap on attempts and no cooldown — every single monster attack
gets its own wind-up, every time, per the explicit decision to ship
unlimited and tune later.

### Interaction with the ability timing meter

Both meters can be active simultaneously and operate fully independently:
the ability timing meter uses Space/Enter or a click on its own bar and
continues to block Attack/Flee exactly as it does today
(`abilityActionInFlight`); the parry wind-up uses `s` or a click on the
monster's bar and does **not** block Attack/Flee/abilities at all — a
monster wind-up completing (parried or not) has no effect on whether the
player can act. The two systems share no state and no key bindings, so a
press of `s` can never be mistaken for a press of Space/Enter or vice
versa.

If the player is mid-ability-timing-meter when a monster wind-up
completes unparried, `monsterAttack()` fires exactly as monster attacks
already can today during an active ability meter (see the existing
comment in `battleScreen.js`'s `playerUseAbility` about this exact
interleaving) — no new interaction to handle there.

## Data model

New pure module `js/systems/parry.js`, mirroring `abilities.js`'s style
(pure functions, `rng` injectable where randomness is involved, no DOM):

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

`js/systems/parry.js` imports from `combat.js` — the same precedent
`abilities.js` already establishes (it imports `rollCrit, calculateDamage,
applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK`
from the same file, though `parry.js` only needs the first three: no
knockback helper is used here, per the ATB-reset reasoning above). No
changes to `combat.js` itself are needed — `resolveMonsterAttack` stays
exactly as it is today and is reused unchanged for the unparried-hit
path.

`windupState` shape: `{ active: boolean, elapsedMs: number }` — module-level
state in `battleScreen.js` (new `monsterWindup` variable, initialized via
`createWindupState()` in `mount()`, alongside the existing
`abilityCooldowns`/`buffState`/`defenseDebuff`/`pendingDelayedHit`
pattern), reset to `createWindupState()` every time a wind-up resolves
(parried, missed, or completed naturally).

## Wiring changes

- **New:** `js/systems/parry.js` — pure, all constants and functions
  above.
- **Modify:** `js/screens/battleScreen.js`:
  - New module-level `let monsterWindup = createWindupState();`
  - `tick()`: replace the current `if (isReady(monsterCombatant.atb)) { monsterAttack(); }`
    with wind-up-starting logic (guarded so a wind-up already in progress
    is never restarted) plus wind-up-advancing logic that resolves the
    hit unparried when `isWindupComplete` becomes true.
  - New `resolveMonsterWindup(parried)` function: guards against
    double-resolution (`if (!monsterWindup.active) return;`), computes
    `windupElapsedPercent`, resets `monsterWindup`, then either applies
    the parry-success path (rolls damage via `rollIncomingDamage`,
    applies `resolveParrySuccess`, logs, plays a hit effect on the
    monster, calls `checkOutcome()`) or falls through to the existing
    `monsterAttack()` for the unparried path. Followed by the same
    `updateAtbBars()`/`updateMenu()` calls every other action in this
    file already makes.
  - New keydown branch for `'s'`/`'S'`: calls
    `resolveMonsterWindup(true)` only if `monsterWindup.active`; a no-op
    otherwise (mirrors how Attack/Item/Flee are already guarded when
    their action isn't currently valid).
  - New click handler on the monster's `.battle-atb-bar` element,
    calling the same `resolveMonsterWindup(true)` path.
  - `updateAtbBars()`: while `monsterWindup.active`, render the monster's
    ATB fill using `windupElapsedPercent(monsterWindup)` instead of the
    normal `percent(monsterCombatant.atb, ATB_MAX)`, and add a CSS class
    marking it as a wind-up (distinct color) plus a zone-highlight
    element positioned at `PARRY_ZONE_START_PERCENT`–`PARRY_ZONE_END_PERCENT`
    (parallel to how `.battle-timing-sweet-spot` is already positioned for
    the ability meter).
  - A small key-hint element near the monster, visible only while
    `monsterWindup.active`, reading `"Parry! (s)"` — same visibility
    pattern as `.battle-buff-indicator`, which only shows text when
    relevant.
  - Log messages: parry success →
    `` `You parry ${monsterCombatant.name}'s attack and strike back for ${reflectedDamage}!` ``;
    everything else is the existing, unchanged
    `` `${monsterCombatant.name} hits you for ${damage}.` `` /
    `` `Critical! ${monsterCombatant.name} hits you for ${damage}!` `` from
    `monsterAttack()`.
- **Modify:** `css/styles.css` — new classes for the wind-up-colored ATB
  fill, the parry-zone highlight (parallel to
  `.battle-timing-sweet-spot`), and the parry key-hint text.

## Testing

- `parry.test.js` (new): `createWindupState`/`startWindup` initial
  shapes; `tickWindup` advances `elapsedMs` and is a no-op on an inactive
  state; `isWindupComplete` true only once `elapsedMs >=
  PARRY_WINDUP_DURATION_MS` and only when active; `windupElapsedPercent`
  clamps at 100 and computes the right percentage at a few sample
  elapsed values; `resolveParryAttempt` — true at the zone boundaries (80
  and 100), true inside, false just below 80, false above 100 (shouldn't
  be reachable but should still resolve false, not throw);
  `rollIncomingDamage` — with an injected rng, verify crit and non-crit
  paths produce the same shape `combat.js`'s own crit/damage functions
  would; `resolveParrySuccess` — reflect fraction math with a known
  input, confirms defense is NOT subtracted (compare against what
  `calculateDamage` would have produced, to prove they differ), confirms
  `monsterHp` floors at 0, confirms `monsterAtb` is reset to 0 (not
  knocked back from 100 by a flat amount).
- `battleScreen.js` changes have no dedicated test file, matching this
  codebase's existing convention (screen modules are DOM-driving and
  verified manually — same treatment `mapScreen.js` and the ability
  timing meter's UI already received).
- Manual verification (no automated test covers actual battle feel): 
  fight a monster and let a wind-up complete without pressing anything —
  confirm the hit lands exactly as before this feature; press `s` inside
  the zone — confirm zero player damage, a log line naming the reflected
  amount, and the monster's HP bar drops by roughly half the would-be
  hit; press `s` early/late — confirm the hit lands normally with no
  penalty beyond the miss itself; confirm Attack/abilities remain usable
  while a monster wind-up is active; confirm using an ability's own
  timing meter at the same time a monster wind-up is active doesn't
  cross-trigger either system on a Space/Enter or `s` press.
