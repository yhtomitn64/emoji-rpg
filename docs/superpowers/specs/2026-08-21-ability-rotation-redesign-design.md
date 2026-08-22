# Ability Rotation Redesign: AOE Sweep, Combo Chains, and Timing Cues

**Status:** Approved, ready to plan.

## Background

The Phase 1 abilities system (`docs/superpowers/specs/2026-08-17-combat-abilities-design.md`,
shipped 2026-08-18) added five fixed-order, independently-cooldowned abilities
— Stab, Chop, Slash, Sweep, Super Scream — with no interaction between them
beyond Super Scream's rotation-wide damage buff. It was deliberately scoped to
single-monster battles, with Slash and Sweep specifically built (delayed hit,
defense-shred debuff) so a future multi-target pass could extend them without
rework.

Multi-mob encounters (`docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md`,
shipped 2026-08-21) landed that multi-target foundation for Attack, but left
abilities single-target.

Timothy's own reaction after playing the shipped Phase 1 system (raised
2026-08-20, captured in `docs/superpowers/BACKLOG.md`'s "Ability rotation
redesign" item): "the combat feels good but a little clunky. I don't really
understand the different power levels of the abilities... not sure why I
would use different single target or different multi target. Does one buff
the other or what?" Several distinct asks came out of that note and a
follow-up conversation (2026-08-21): abilities that can hit multiple
monsters, abilities that "proc" so a follow-up press feels instant/quicker,
and a clearer on-screen cue for the ability timing-meter's sweet spot (raised
concretely after Timothy pressed the wrong key during the green zone — the
ability's own number key instead of Space).

This spec covers all three together, since they interact: the combo/proc
mechanic and the AOE ability share the same button-state and damage-formula
code paths, and the timing-meter cue and the combo-ready indicator are the
same kind of "tell the player what to press" UI problem.

## Goals

- Give Sweep a distinct, clearly-differentiated role as the group-fight
  ability, now that group fights exist.
- Turn the fixed, non-interacting ability order into two combo lanes with a
  setup/payoff relationship, so landing one ability visibly and mechanically
  sets up another — answering "does one buff the other" directly.
- Make the timing-meter's sweet spot self-explanatory in the moment, not
  something you have to already know.
- Keep the change scoped to `js/systems/abilities.js` and
  `js/screens/battleScreen.js`'s ability-handling code — no new files, no
  changes to the multi-mob targeting/selection system, no changes to Attack,
  Super Scream's binding, or `js/systems/combat.js`.

## Non-Goals (explicitly out of scope for this pass)

- Ability button icons, per-ability damage-number previews, and a
  press-animation on the button itself. Real requests (from the same backlog
  note), deferred to their own future polish pass so this spec stays focused
  on the rotation mechanics.
- Moving Super Scream off key `5` onto Space, or exempting it from the shared
  swing-timer gate. Considered and explicitly declined for this pass — Super
  Scream stays exactly as shipped.
- Changing Attack's role. Considered (auto-attack, folding it into the combo
  web as a third light setup) and explicitly declined — Attack stays the
  free, no-cooldown, no-combo baseline hit it is today.
- Extending AOE or combo behavior to Super Scream, or to any ability beyond
  the four damage abilities.
- Any pre-emptive damage rebalancing beyond what's specified below. This
  project's established pattern (parry, the Phase 1 abilities system itself)
  is to ship a mechanic at a deliberately strong value and tune it against
  real play rather than pre-balance from theory — see "Balance risk" below.

## Design

### 1. Sweep becomes an AOE ability

Sweep (`ABILITIES` id `'sweep'`) gains `aoe: true`. Stab, Chop, and Slash are
unaffected — they remain single-target against whichever monster is
currently selected, exactly as today.

When the active ability has `aoe: true`, `playerUseAbility()` resolves it
against **every living monster** in `monsterCombatants` instead of just
`monsterCombatants[selectedMonsterIndex]`:

- Each monster takes Sweep's **full** damage independently — its own crit
  roll, its own timing-hit bonus, its own combo bonus (see below) if
  applicable. This is not a shared/split damage pool.
- Each hit monster gets the existing defense-shred debuff
  (`createDefenseDebuff`), independently timed per monster (reusing the
  per-monster `defenseDebuff` field the multi-mob rework already added to
  each `monsterCombatant`).
- A solo encounter (the array-shaped combat model's 1-element case) sees no
  behavior change — Sweep hitting "every living monster" against a
  1-monster array is identical to today's single-target Sweep.
- Targeting/selection (click, arrow keys, Tab) is unaffected. Sweep ignores
  `selectedMonsterIndex` entirely when it fires; the selection still governs
  Attack, Stab, Chop, and Slash as before.
- The hit-effect visuals (damage number, flash, shake) play on every hit
  monster's own zone, reusing the same `playHitEffect`/deferred-hide
  mechanism the multi-mob rework already built for simultaneous
  monster-vs-monster hits.

### 2. Combo chains: two independent setup/payoff lanes

Two lanes, matching the ability unlock order:

- **Lane A:** Stab (setup) → Chop (payoff)
- **Lane B:** Slash (setup) → Sweep (payoff)

`ABILITIES` entries gain combo metadata (exact shape decided at plan time,
e.g. `comboRole: 'setup' | 'payoff'`, `comboPartnerId`). Battle-local state
(alongside the existing `buffState`/`abilityCooldowns` module state in
`battleScreen.js`) tracks which payoffs are currently primed:

```
comboState = { chop: false, sweep: false, stabReturn: false, slashReturn: false }
```

**Landing a setup ability** (Stab or Slash) sets its payoff's flag to `true`.
No expiration — the primed state persists until the payoff is actually used,
regardless of what else happens in between (pressing Attack, using the other
lane, waiting through several ATB cycles). The two lanes are fully
independent: landing Stab never affects `comboState.sweep`, and vice versa.

**Pressing a primed payoff** (Chop while `comboState.chop`, or Sweep while
`comboState.sweep`):

- Bypasses the swing-timer-full requirement for that button only — it's
  pressable even while `playerCombatant.atb` hasn't finished refilling. This
  is the "instant" / "quicker button" feel. It still respects its own
  real-time ability cooldown (`abilityCooldowns[id]`) — if Chop/Sweep is
  still cooling down from a recent use, being primed doesn't override that.
- Deals bonus damage: the existing multiplicative-bonus pattern in
  `resolveAbilityUse` (which already stacks `buffActive` at 1.25x and
  `timingHit` at 1.30x) gains a third multiplier, `comboBonus`, applied the
  same way. Proposed value: **1.5x** for a primed payoff.
- Only the *wait* is skipped, not the normal post-use reset: like every
  other ability use, resolving a primed payoff still resets the player's
  swing timer to empty afterward (`resolveAbilityUse` already always
  returns `playerAtb: 0`), so the next action — whatever it is — waits for
  a normal refill same as today. The bypass is strictly "this one press
  doesn't need to wait for a full gauge," not "the gauge stops mattering."
- On resolution, clears its own primed flag (`comboState.chop = false` /
  `comboState.sweep = false`) and, per the return leg below, sets the return
  bonus on its setup ability.

**Return leg — landing a payoff also primes a smaller bonus on its setup:**
after Chop resolves (whether or not it was primed), the next Stab gets a
damage-only bonus (no swing-timer skip). Same for Sweep → next Slash.
Proposed value: **1.15x**. This is what keeps a lane a sustained loop
(Stab↔Chop, Slash↔Sweep) rather than a single one-shot combo. Tracked the
same way as the forward primed state (e.g. `comboState.stabReturn`,
`comboState.slashReturn`), same no-expiration rule.

Both bonus multipliers (1.5x forward, 1.15x return) are proposed starting
values, explicitly expected to need tuning once played — see "Balance risk"
below.

### 3. UI: combo-ready indicator and timing-meter cue

**Combo-ready button state:** when a payoff is primed, its ability button
gets a distinct visual treatment (glow/border, consistent with the existing
ability-button disabled/cooldown/ready states already in
`abilityButtonsHtml()`) and its label changes to surface the bonus, e.g.
`Chop (2) ⚡ Combo Ready`. The indicator clears the instant the payoff is
used.

**Timing-meter sweet-spot cue:** the existing timing meter (`runTimingMeter`,
`TIMING_SWEET_SPOT_START`/`TIMING_SWEET_SPOT_END` in `battleScreen.js`) shows
`Press Space!` directly on or beside the meter bar once it enters the sweet
spot — the same window that currently only changes the bar's visual fill
with no textual explanation. This directly addresses the reported confusion
(pressing the ability's own number key again, instead of Space, during that
window).

## Data model changes

- `js/systems/abilities.js`: `ABILITIES` entries for Stab/Chop/Slash/Sweep
  gain combo-lane metadata; Sweep's entry gains `aoe: true`.
- `js/systems/abilities.js`: `resolveAbilityUse` gains a `comboBonus`
  parameter/multiplier alongside the existing `buffActive`/`timingHit`
  parameters, following the same multiplicative-stacking pattern.
- `js/screens/battleScreen.js`: new module-local `comboState`, reset on
  `mount()` same as `buffState`/`abilityCooldowns` today (combo state does
  not persist between battles).
- `js/screens/battleScreen.js`: `playerUseAbility` branches on `ability.aoe`
  to loop over `monsterCombatants` instead of resolving against a single
  target, and consults/updates `comboState` before and after resolving.
- `js/screens/battleScreen.js`: `abilityButtonsHtml()`'s `disabled`
  computation drops the `!ready` (swing-timer) condition specifically for a
  primed payoff button.

No changes to `js/state.js`, `js/systems/combat.js`, `js/systems/parry.js`,
`js/systems/groupEncounters.js`, or `js/screens/mapScreen.js`.

## Testing

Pure-logic unit tests in `tests/abilities.test.js` (extending the existing
suite), covering:

- Combo state transitions: landing a setup primes only its own payoff, not
  the other lane; landing a payoff clears its own flag and sets the return
  bonus on its setup; a primed flag survives an unrelated action (e.g. a
  simulated Attack) in between.
- `resolveAbilityUse`'s new `comboBonus` multiplier stacks correctly
  alongside `buffActive` and `timingHit` (order-independent, matching the
  existing multiplication chain).
- AOE resolution: given a 3-monster array, Sweep's damage/debuff applies
  independently and fully to each living monster and skips any already-dead
  monster; against a 1-monster array, behavior is identical to non-AOE
  single-target resolution (the solo-battle regression check).
- The swing-timer-bypass condition: a primed payoff is usable while
  `!isReady(atb)`, and a non-primed ability is not.

`battleScreen.js`'s DOM/keyboard wiring (the combo-ready button visuals, the
timing-meter label) is manually verified live in-browser, per this project's
established convention for that file — it currently has no automated test
coverage of its own.

## Balance risk (known, accepted for this pass)

Sweep as a full-damage AOE, on a combo lane, with an instant-follow-up skip
and a 1.5x bonus, stacked on top of the already-approved "full damage to
each monster" scaling from the multi-mob spec, is expected to be a
significant damage spike in any group fight once Slash→Sweep is available
(level 8+). This is a deliberate choice, consistent with how parry and the
Phase 1 abilities system both shipped: strong first, tuned against real
play. Worth watching once played; the 1.5x/1.15x multipliers and Sweep's
existing 12s cooldown are the levers to adjust if it needs reeling in.
