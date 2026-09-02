# Ability Rotation v2 — Design

## Purpose

Today's 4 damage abilities (`js/systems/abilities.js`: Stab, Chop,
Slash, Sweep, unlocking levels 2/4/6/8) are each just a bigger number
than the last, paired into two setup/payoff combos (Stab primes Chop,
Slash primes Sweep) via a live timing meter the player presses *during*
a wind-up bar (`runTimingMeter` in `js/screens/battleScreen.js`).
Raised 2026-09-02 (spun out of, but deliberately separate from, the
multi-mob parry cooldown rework — see that design's Purpose section and
`docs/superpowers/BACKLOG.md`'s "Ability rotation v2" entry): Timothy
wants the 4 slots to become distinct rotation roles instead of a
flat power ramp, all resolving instantly (no live wind-up bar to wait
through), plus new names for all four that don't read as lifted from
another game's ability kit.

Handoff prompt (`docs/superpowers/specs/2026-09-02-ability-rotation-v2-
handoff.md`) captured Timothy's own vision going in; this doc records
what that vision resolved to after brainstorming through the open
questions it flagged (slot mapping, the AOE-widen numbers, how the
re-timed buff trigger feels without a dedicated key, and the final
names).

Explicitly not part of this build, raised in the same conversation and
parked separately: "slow combat down, hit chunkier, maybe a big
buildable payoff move" — that territory belongs to the already-open
"slower combat / reconsider the timing-minigame" backlog thread
(`docs/superpowers/BACKLOG.md`, Combat pass ideas), which Timothy has
said he's not ready to design yet. Folding it into this build risked
half-deciding it as a side effect.

## Scope

In scope:
- Rename Stab → **Impale**, Chop → **Sever**, Slash → **Lacerate**,
  Sweep → **Faultline** (icon changes 🌪️ → 🪨 to match). The Sweep
  rename was added mid-brainstorm, 2026-09-02, once Timothy decided he
  wanted all 4 renamed rather than just 3. Went through several rounds:
  wanted something evoking "makes enemies dizzy" but bigger/scarier
  than that word — "Vertigo" was tried and rejected (too strongly
  associated with fear of heights, a mismatch for a ground attack);
  "Concuss" read as one hard single hit rather than a wide effect
  (wrong fit for an ability whose whole point is hitting *everyone*,
  weakly); landed on an earthquake/ground-crack direction instead,
  which keeps the "disorients everyone standing near it" idea without
  naming it directly. Super Scream is untouched entirely.
- Remove the cross-ability combo system: `comboRole`/`comboPartnerId`/
  `comboBonusMultiplier` on ability definitions, the `comboState`
  tracking object, and `runTimingMeter`'s live wind-up-bar UI. Nothing
  in the new design primes a *different* ability the way Stab→Chop and
  Slash→Sweep do today.
- Reassign the 4 slots to 4 distinct roles (unlock levels unchanged):
  - **Impale** (Lv 2, 🗡️): strong single-target hit, instant, no
    special mechanic beyond its own damage number.
  - **Sever** (Lv 4, 🪓): instant hit on the target plus one random
    *other* living enemy, chosen fresh each use. Still fully usable
    1-on-1 (the bonus target just doesn't exist to hit).
  - **Lacerate** (Lv 6, ⚔️): instant hit, keeps today's Slash delayed
    bleed tick (~20% bonus damage landing ~900ms later), and opens a
    short self-retrigger window afterward (see Mechanics).
  - **Faultline** (Lv 8, 🪨): unchanged base behavior (weak hit on
    every living enemy, 6s defense-shred on all of them) plus a new
    widen buff for that same 6s (see Mechanics).
- New widen-buff mechanic: while Faultline's buff is active, Impale, Sever,
  and Lacerate each hit **one additional random enemy**, on top of
  whatever they'd normally hit — so Sever goes from target+1 to
  target+2 during the window. Applies uniformly across all three;
  Sever isn't excluded just because it already hits extra.
- New self-retrigger mechanic on Lacerate: landing the re-press inside
  its sweet-spot window grants the same buffed state Super Scream
  already grants (`ROTATION_BONUS_MULTIPLIER`, 1.25x all ability
  damage), for roughly the same 8-10s ballpark as Super Scream's own
  `buffDurationMs`. If Super Scream's buff is already active, landing
  this refreshes/extends that one shared buff state — it does not
  stack multiplicatively into a second, bigger multiplier.
- Damage-multiplier tuning for the 4 renamed/repurposed abilities,
  starting from today's relative scale (the single-target hit stronger
  per-target than the multi-target one, matching how Stab/Chop compare
  today) and adjusted via the existing balance simulator
  (`scripts/simulate-balance.js`, exercised by
  `tests/simulateAbilityPolicy.test.js`) during implementation — not
  pinned to exact numbers here.
- `CHANGELOG.md` / `js/data/playerChangelog.js` entries per this repo's
  standing versioning checklist (`CLAUDE.md`), and a `docs/superpowers/
  BACKLOG.md` → `BACKLOG_SHIPPED.md` move once it ships.

Out of scope (deliberately, parked elsewhere):
- The "slow combat down / chunkier hits / buildable big payoff move"
  idea — stays with the open "slower combat / timing-minigame" thread.
- Any change to Super Scream, parry, or the multi-mob parry cooldown
  rework that shipped just before this.
- A new UI treatment beyond what's needed for the retrigger glow and
  updated tooltips — no broader battle-screen visual redesign.
- Re-validating existing dragon/NG+ matchup numbers beyond what the
  simulator naturally reflects from the new multipliers — same
  "ship and retune from real play" stance the parry cooldown design
  took, not pre-tuning blind.

## Mechanics

### Data model (`js/systems/abilities.js`)

The `ABILITIES` array's `comboRole`/`comboPartnerId`/
`comboBonusMultiplier` fields are removed from Impale/Sever/Lacerate/
Faultline entirely (nothing replaces them — the new mechanics below don't
reference a partner ability). `canUseAbility`'s `comboPrimed`/
`comboRole` parameters and the "a primed payoff bypasses cooldown"
branch go away with them — every ability's usability is just "off
cooldown and ready," full stop.

New fields:
- Lacerate keeps `delayedHitMultiplier`/`delayedHitDelayMs` (unchanged
  from today's Slash) and gains a `retrigger` config: a window duration
  (starting estimate ~1-1.5s, tunable) and a sweet-spot start/end within
  it, structurally parallel to today's `TIMING_SWEET_SPOT_START/END`
  constants but scoped to this one ability rather than a shared meter.
- Sever gains an `extraTargetCount: 1` (or equivalent flag) marking it
  as always hitting one bonus random target.
- Faultline gains a `widenBonusTargets: 1` and reuses its existing
  `defenseShredDurationMs` as the widen buff's own duration too (both
  6s, one timer).

`resolveAbilityUse` loses its `timingHit`/`comboBonusActive`
parameters (no more sweet-spot-during-cast or combo-partner bonus) and
gains a `widenActive` boolean — when true, the caller resolves against
one extra randomly-chosen living enemy alongside whatever targets the
ability already resolves against, using the same damage math as its
primary target(s). Lacerate's own retrigger success is resolved as a
call to the existing `activateBuff`-shaped flow (see below), not as a
`resolveAbilityUse` parameter — it doesn't change *this* use's damage,
only what happens after.

### Removing the live wind-up meter

`runTimingMeter` and its supporting battle-screen state
(`elements.timingMeter`/`timingFill`/`timingHint`/`timingSweetSpot`,
`TIMING_SWEET_SPOT_START/END`, `TIMING_METER_DURATION_MS`,
`activeTimingMeterHandle` and its pause/resume wiring) are deleted.
Every ability use in `battleScreen.js`'s action-handling path
(`useAbility`-shaped functions around today's lines 1520-1650) becomes
synchronous again — pressing an ability button resolves its damage
immediately, the same code shape `useAttack` already has today, since
nothing left needs to `await` a live meter before resolving.

### Lacerate's self-retrigger window

Using Lacerate resolves its hit (plus scheduling the delayed bleed
tick) exactly like any other ability use, then starts a short-lived
window tracked as new battle-screen state (e.g.
`lacerateRetriggerActive`/`lacerateRetriggerStartedAt`), independent of
`abilityCooldowns[lacerate.id]` (the ability's own real-time cooldown
keeps ticking in parallel — the retrigger window is shorter than the
cooldown, so the button is genuinely unusable again until the window
has already closed). While the window is open, Lacerate's action
button gets a CSS glow/pulse class (parallel to how
`.battle-ability-button-combo` marks a primed combo today, but a
self-timed animation rather than a state flag) with a distinct flash
keyed to the sweet-spot sub-range inside it (same visual language as
today's `battle-zone-pulse` used for the parry zone and timing meter,
reused rather than reinvented). Pressing Lacerate again is read
against the elapsed time since the window opened, exactly like
`resolveTimingHit` reads elapsed percent today — landing in the
sweet-spot activates the same shared buff state Super Scream uses today
(`buffState = activateBuff(...)`, called with Lacerate's own buff
duration rather than Super Scream's), landing outside it or letting the
window lapse does nothing extra. Because the button's own real cooldown
is still running, a "press again" here is a genuinely different input
than a normal reuse — the player is pressing a button that's still
mid-cooldown-looking, which the glow is what tells them "this one still
does something."

### Sever's bonus target

Sever's ability handler picks one random living enemy other than the
primary target (empty pool when solo — falls back to primary-only,
identical to how AOE-target selection already treats a single-monster
fight elsewhere in this codebase) and calls `resolveAbilityUse` against
both, matching how Sweep already resolves against every living monster
in a loop today.

### Faultline's widen buff

Faultline resolves its own weak all-enemies hit and defense-shred
exactly as today's Sweep does, then sets a new buff flag (e.g.
`widenBuffActive`, ticked down by the existing `tickDefenseDebuff`-
shaped 300ms loop, sharing Faultline's `defenseShredDurationMs` as its
duration so both expire together). Impale/Sever/Lacerate's action handlers check this flag when
resolving and, if active, add one more randomly-chosen living enemy
(beyond whatever they already target) to the `resolveAbilityUse` call
via the new `widenActive` parameter above. The buff indicator area
(`elements.buffIndicator`, which today only ever shows Super Scream's
"💪 Super Scream: Xs") gets a second line/badge for the widen buff
while it's active, following the same `Math.ceil(remainingMs / 1000)`
countdown pattern.

## Testing

`tests/abilities.test.js` (pure-function coverage): `resolveAbilityUse`
with `widenActive: true` hits the extra target at the same damage math
as the primary; Sever's target-selection helper never double-counts a
target or crashes with zero other enemies alive; the removed
`comboRole`/`comboPartnerId` fields and `resolveTimingHit`'s consumers
no longer appear on any of the 4 abilities. `simulateAbilityPolicy.test.js`
gets updated for the new roster shape (no more setup/payoff role
distinction to model) before re-tuning multipliers against it.

`tests/battleScreenDom.test.js` (real-time DOM coverage, same pattern
the parry cooldown rework used — poll actual timers rather than
hardcoded waits):
- Lacerate landing its own retrigger inside the sweet-spot window
  activates the shared buff state; missing the window (too early, too
  late, or letting it lapse) does not.
- Landing the retrigger while Super Scream's buff is already active
  refreshes the single buff's remaining time rather than compounding
  the multiplier.
- Sever against a single remaining monster still resolves (no crash,
  no phantom second target).
- Using Faultline, then Impale/Sever/Lacerate within the widen window, hits
  one extra random living enemy each; using any of them after the
  window has expired does not.
- The removed timing-meter DOM (`.battle-timing-meter`, its fill/hint/
  sweet-spot elements) and any tests exercising it are deleted, not
  left disabled.

## Follow-ups (explicitly not resolved by this build)

- "Slow combat down / chunkier hits / buildable big payoff move" —
  stays with the open "slower combat / timing-minigame" backlog
  thread; not designed here.
- Exact damage-multiplier values for all 4 abilities, and the widen/
  retrigger buff durations if the 6s/8-10s starting points above don't
  feel right in real play — tune after shipping, same stance the parry
  cooldown rework took.
- The multi-mob parry cooldown design's own follow-up note ("Ability
  rotation v2 may eventually want to trigger multi-mob parry from a
  specific ability instead of/alongside the standalone key") is still
  open and not addressed by this build either — nothing here ties any
  ability to the parry key.
